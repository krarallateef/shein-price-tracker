// منطق الفحص: جلب صفحة المنتج → استخراج السعر/المخزون → مقارنة → تسجيل تغيّر + تنبيه.
import { notify } from './notify.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

export function extractGoodsId(url) {
  const m = String(url).match(/-p-(\d+)/) || String(url).match(/[?&](?:goods_id|goodsId)=(\d+)/);
  return m ? m[1] : null;
}

// سلسلة الجلب: مباشر ثم jina. يُعيد نصّ HTML أو يرمي.
async function fetchHtml(url, env) {
  // 1) مباشر بترويسات متصفح
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Cache-Control': 'no-cache',
      },
      cf: { cacheTtl: 0 },
    });
    if (r.ok) {
      const t = await r.text();
      if (t.length > 2000 && /application\/ld\+json|productIntroData|__NEXT_DATA__|"price"/.test(t)) return t;
    }
  } catch { /* المرور للاحتياطي */ }

  // 2) بروكسي قراءة jina (مجاني)
  const headers = { 'X-Return-Format': 'html' };
  if (env.JINA_API_KEY) headers.Authorization = `Bearer ${env.JINA_API_KEY}`;
  const jr = await fetch(`https://r.jina.ai/${url}`, { headers });
  if (!jr.ok) throw new Error(`jina ${jr.status}`);
  return jr.text();
}

// يستخرج { price, currency, inStock } من HTML. سلسلة بدائل.
export function parsePrice(html) {
  // أ) JSON-LD
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1].trim());
      const nodes = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
      for (const n of nodes) {
        if (!n || !/product/i.test(n['@type'] || '')) continue;
        const offer = Array.isArray(n.offers) ? n.offers[0] : n.offers;
        if (!offer) continue;
        const price = parseFloat(offer.price ?? offer.lowPrice ?? (offer.priceSpecification && offer.priceSpecification.price));
        if (Number.isFinite(price) && price > 0) {
          const avail = String(offer.availability || '').toLowerCase();
          return { price, currency: offer.priceCurrency || null, inStock: avail ? avail.includes('instock') : null };
        }
      }
    } catch { /* التالي */ }
  }

  // ب) كتلة شي إن الداخلية
  const sp = html.match(/"salePrice"\s*:\s*\{[^}]*?"amount"\s*:\s*"([\d.]+)"/)
    || html.match(/"retailPrice"\s*:\s*\{[^}]*?"amount"\s*:\s*"([\d.]+)"/)
    || html.match(/"price"\s*:\s*"?([\d.]+)"?/);
  if (sp) {
    const cur = html.match(/"currency"\s*:\s*"([A-Z]{3})"/) || html.match(/priceCurrency["\s:]+"([A-Z]{3})"/);
    const soldOut = /"is_on_sale"\s*:\s*0[\s\S]{0,200}"stock"\s*:\s*0|out.?of.?stock|SOLD\s*OUT/i.test(html);
    return { price: parseFloat(sp[1]), currency: cur ? cur[1] : null, inStock: !soldOut };
  }

  // ج) وسم meta عام
  const mp = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([\d.]+)["']/i);
  if (mp) {
    const mc = html.match(/<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([A-Z]{3})["']/i);
    return { price: parseFloat(mp[1]), currency: mc ? mc[1] : null, inStock: null };
  }

  return null;
}

// يفحص منتجاً واحداً ويحدّث القاعدة. لا يرمي — يُرجِع ملخّصاً.
async function checkOne(env, p) {
  const now = new Date().toISOString();
  try {
    const html = await fetchHtml(p.url, env);
    const parsed = parsePrice(html);
    if (!parsed || !Number.isFinite(parsed.price)) throw new Error('price_not_found');

    const goodsId = p.goods_id || extractGoodsId(p.url);
    const oldPrice = p.last_price;
    const oldStock = p.last_in_stock;
    const newPrice = +parsed.price.toFixed(2);
    const newStock = parsed.inStock == null ? oldStock : parsed.inStock ? 1 : 0;

    await env.DB.prepare(
      `UPDATE products SET goods_id=COALESCE(goods_id,?), currency=COALESCE(currency,?),
       last_price=?, last_in_stock=?, last_checked_at=?, consecutive_failures=0, last_error=NULL WHERE id=?`
    ).bind(goodsId, parsed.currency, newPrice, newStock, now, p.id).run();

    const events = [];
    const minPct = parseFloat(env.MIN_CHANGE_PCT) || 3;

    if (oldPrice != null && newPrice !== oldPrice) {
      const pct = +(((newPrice - oldPrice) / oldPrice) * 100).toFixed(2);
      if (Math.abs(pct) >= minPct) {
        events.push({ type: pct < 0 ? 'price_drop' : 'price_rise', old: oldPrice, new: newPrice, pct });
      }
    }
    if (oldStock === 0 && newStock === 1) events.push({ type: 'back_in_stock', old: oldPrice, new: newPrice, pct: null });
    if (oldStock === 1 && newStock === 0) events.push({ type: 'out_of_stock', old: oldPrice, new: newPrice, pct: null });
    if (p.target_price != null && oldPrice != null && oldPrice > p.target_price && newPrice <= p.target_price) {
      events.push({ type: 'target_hit', old: oldPrice, new: newPrice, pct: null });
    }

    for (const e of events) {
      await env.DB.prepare(
        `INSERT INTO price_events (product_id, old_price, new_price, pct_change, in_stock, event_type) VALUES (?,?,?,?,?,?)`
      ).bind(p.id, e.old, e.new, e.pct, newStock, e.type).run();
      await sendAlert(env, p, e, parsed.currency);
    }

    return { id: p.id, ok: true, price: newPrice, events: events.length };
  } catch (err) {
    const fails = (p.consecutive_failures || 0) + 1;
    await env.DB.prepare(
      `UPDATE products SET last_checked_at=?, consecutive_failures=?, last_error=? WHERE id=?`
    ).bind(now, fails, String(err.message || err).slice(0, 300), p.id).run();
    const max = parseInt(env.MAX_FAILURES) || 5;
    if (fails === max) {
      await notify(env, p.notify_channel, {
        title: `⚠️ تعذّر فحص منتج`,
        text: `⚠️ تعذّر فحص «${p.label || p.url}» ${max} مرات متتالية.\nآخر خطأ: ${err.message || err}\n${p.url}`,
      }).catch(() => {});
    }
    return { id: p.id, ok: false, error: String(err.message || err) };
  }
}

function fmt(n, cur) {
  return n == null ? '—' : `${n}${cur ? ' ' + cur : ''}`;
}

async function sendAlert(env, p, e, currency) {
  const cur = p.currency || currency || '';
  const name = p.label || `منتج #${p.id}`;
  let head;
  if (e.type === 'price_drop') head = `📉 <b>نزل السعر</b> ${e.pct}%`;
  else if (e.type === 'price_rise') head = `📈 ارتفع السعر +${e.pct}%`;
  else if (e.type === 'back_in_stock') head = `✅ <b>رجع للمخزون</b>`;
  else if (e.type === 'out_of_stock') head = `⛔️ نفد المخزون`;
  else if (e.type === 'target_hit') head = `🎯 <b>وصل سعرك المستهدف</b>`;
  const text = `${head}\n\n<b>${name}</b>\n${fmt(e.old, cur)} ← <b>${fmt(e.new, cur)}</b>\n\n${p.url}`;
  await notify(env, p.notify_channel, { title: `${head.replace(/<[^>]+>/g, '')} — ${name}`, text }).catch(() => {});
}

// يُشغَّل من الكرون ومن زر «افحص الآن». يأخذ أقدم BATCH_SIZE منتجاً نشطاً.
export async function runChecks(env, { limit } = {}) {
  const batch = limit || parseInt(env.BATCH_SIZE) || 6;
  const { results } = await env.DB.prepare(
    `SELECT * FROM products WHERE active=1 ORDER BY (last_checked_at IS NULL) DESC, last_checked_at ASC LIMIT ?`
  ).bind(batch).all();
  const out = [];
  for (const p of results || []) out.push(await checkOne(env, p));
  return { checked: out.length, results: out };
}
