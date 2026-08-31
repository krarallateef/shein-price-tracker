// العقل: تطبيق نتيجة جلب (من الجالب المحلي) على القاعدة — مقارنة، تسجيل تغيّر،
// تنبيه. لا يجلب شيئاً (شي إن يحظر عناوين مراكز البيانات).
import { notify } from './notify.js';
import { extractGoodsId } from './parse.js';

function fmt(n, cur) {
  return n == null ? '—' : `${n}${cur ? ' ' + cur : ''}`;
}

async function sendAlert(env, p, e, currency) {
  const cur = p.currency || currency || '';
  const name = p.label || `منتج #${p.id}`;
  const head =
    e.type === 'price_drop' ? `📉 <b>نزل السعر</b> ${e.pct}%` :
    e.type === 'price_rise' ? `📈 ارتفع السعر +${e.pct}%` :
    e.type === 'back_in_stock' ? `✅ <b>رجع للمخزون</b>` :
    e.type === 'out_of_stock' ? `⛔️ نفد المخزون` :
    e.type === 'target_hit' ? `🎯 <b>وصل سعرك المستهدف</b>` : e.type;
  const text = `${head}\n\n<b>${name}</b>\n${fmt(e.old, cur)} ← <b>${fmt(e.new, cur)}</b>\n\n${p.url}`;
  await notify(env, p.notify_channel, { title: `${head.replace(/<[^>]+>/g, '')} — ${name}`, text }).catch(() => {});
}

// نتيجة واحدة من الجالب: { id, price?, currency?, in_stock?, error? }
export async function applyResult(env, r) {
  const now = new Date().toISOString();
  const p = await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(r.id).first();
  if (!p) return { id: r.id, ok: false, error: 'product_not_found' };

  // خطأ جلب من الجالب
  if (r.error || r.price == null || !Number.isFinite(+r.price)) {
    const fails = (p.consecutive_failures || 0) + 1;
    await env.DB.prepare('UPDATE products SET last_checked_at=?, consecutive_failures=?, last_error=? WHERE id=?')
      .bind(now, fails, String(r.error || 'price_not_found').slice(0, 300), p.id).run();
    const max = parseInt(env.MAX_FAILURES) || 5;
    if (fails === max) {
      await notify(env, p.notify_channel, {
        title: '⚠️ تعذّر فحص منتج',
        text: `⚠️ تعذّر استخراج سعر «${p.label || p.url}» ${max} مرات متتالية.\nآخر خطأ: ${r.error || 'price_not_found'}\n${p.url}`,
      }).catch(() => {});
    }
    return { id: p.id, ok: false, error: r.error || 'price_not_found' };
  }

  const newPrice = +(+r.price).toFixed(2);
  const oldPrice = p.last_price;
  const oldStock = p.last_in_stock;
  const newStock = r.in_stock == null ? oldStock : r.in_stock ? 1 : 0;
  const currency = r.currency || p.currency || null;

  await env.DB.prepare(
    `UPDATE products SET goods_id=COALESCE(goods_id,?), currency=COALESCE(currency,?),
     last_price=?, last_in_stock=?, last_checked_at=?, consecutive_failures=0, last_error=NULL WHERE id=?`
  ).bind(p.goods_id || extractGoodsId(p.url), currency, newPrice, newStock, now, p.id).run();

  const minPct = parseFloat(env.MIN_CHANGE_PCT) || 3;
  const events = [];
  if (oldPrice != null && newPrice !== oldPrice) {
    const pct = +(((newPrice - oldPrice) / oldPrice) * 100).toFixed(2);
    if (Math.abs(pct) >= minPct) events.push({ type: pct < 0 ? 'price_drop' : 'price_rise', old: oldPrice, new: newPrice, pct });
  }
  if (oldStock === 0 && newStock === 1) events.push({ type: 'back_in_stock', old: oldPrice, new: newPrice, pct: null });
  if (oldStock === 1 && newStock === 0) events.push({ type: 'out_of_stock', old: oldPrice, new: newPrice, pct: null });
  if (p.target_price != null && oldPrice != null && oldPrice > p.target_price && newPrice <= p.target_price) {
    events.push({ type: 'target_hit', old: oldPrice, new: newPrice, pct: null });
  }

  for (const e of events) {
    await env.DB.prepare(
      'INSERT INTO price_events (product_id, old_price, new_price, pct_change, in_stock, event_type) VALUES (?,?,?,?,?,?)'
    ).bind(p.id, e.old, e.new, e.pct, newStock, e.type).run();
    await sendAlert(env, p, e, currency);
  }
  return { id: p.id, ok: true, price: newPrice, events: events.length };
}

export async function applyResults(env, results) {
  const out = [];
  for (const r of results || []) out.push(await applyResult(env, r));
  return { applied: out.length, changes: out.filter((x) => x.events).length, results: out };
}

// حارس الكرون: إذا لم يصل تحديث من الجالب منذ فترة (جهاز الأندرويد مطفأ/متوقّف)
// يُرسل تنبيهاً واحداً. staleMinutes يُقرأ من settings (افتراضي 60).
export async function watchdog(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key='watchdog_minutes'").first();
  const mins = parseInt(row?.value) || 60;
  const cutoff = new Date(Date.now() - mins * 60000).toISOString();

  const stale = await env.DB.prepare(
    `SELECT COUNT(*) n, MAX(last_checked_at) latest FROM products WHERE active=1`
  ).first();
  if (!stale || !stale.n) return { ok: true, note: 'no_active_products' };
  if (stale.latest && stale.latest >= cutoff) {
    await env.DB.prepare("INSERT INTO settings (key,value) VALUES ('watchdog_fired','0') ON CONFLICT(key) DO UPDATE SET value='0'").run();
    return { ok: true, note: 'fresh' };
  }

  const fired = await env.DB.prepare("SELECT value FROM settings WHERE key='watchdog_fired'").first();
  if (fired?.value === '1') return { ok: true, note: 'already_alerted' };

  await notify(env, 'telegram', {
    title: '📵 الجالب متوقّف',
    text: `📵 لم يصل أي تحديث أسعار منذ أكثر من ${mins} دقيقة.\nتأكّد أن جهاز الأندرويد شغّال وTermux يعمل.\nآخر تحديث: ${stale.latest || 'لا يوجد'}`,
  }).catch(() => {});
  await env.DB.prepare("INSERT INTO settings (key,value) VALUES ('watchdog_fired','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
  return { ok: true, note: 'alerted' };
}
