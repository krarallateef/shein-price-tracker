// الجالب المحلي — يعمل على جهاز أندرويد (Termux) بـ IP منزلي غير محظور.
// يسأل الـ Worker عن المنتجات، يجلب كل صفحة، يستخرج السعر، يرسل النتائج.
// Node 18+ فقط (fetch مدمج). بلا تبعيات.
//
//   node check.mjs
//
// يقرأ WORKER_URL و INGEST_TOKEN من متغيّرات البيئة أو من fetcher/.env

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePrice, isBlockPage } from '../src/parse.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// تحميل .env البسيط (KEY=VALUE بكل سطر)
try {
  for (const line of readFileSync(join(HERE, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* لا .env — نعتمد على البيئة */ }

const WORKER_URL = (process.env.WORKER_URL || '').replace(/\/$/, '');
const TOKEN = process.env.INGEST_TOKEN;
if (!WORKER_URL || !TOKEN) {
  console.error('✗ WORKER_URL و INGEST_TOKEN مطلوبان (fetcher/.env)');
  process.exit(1);
}

const UA = 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36';
const LANG_BY_REGION = { ar: 'ar-IQ,ar;q=0.9,en-US;q=0.8,en;q=0.7', www: 'en-US,en;q=0.9' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString();

// ترويسات متصفّح Chrome كاملة — Akamai يفحص وجودها وترتيبها.
function browserHeaders(lang, referer) {
  const h = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': lang,
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
  if (referer) h['Referer'] = referer;
  return h;
}

// يجمع كوكيز Set-Cookie من استجابة (undici يعطيها مفصولة بـ getSetCookie).
function collectCookies(res, jar) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of list) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
}
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

async function fetchOne(p) {
  const region = p.region || 'ar';
  const lang = LANG_BY_REGION[region] || LANG_BY_REGION.ar;
  const origin = `https://${region === 'www' ? 'www' : region}.shein.com`;
  const jar = {};
  try {
    // ١) تسخين: زيارة الصفحة الرئيسية للحصول على كوكيز الجلسة/الحماية.
    try {
      const home = await fetch(origin + '/', { headers: browserHeaders(lang), redirect: 'follow' });
      collectCookies(home, jar);
      await home.text().catch(() => {});
      await sleep(500 + Math.random() * 800);
    } catch { /* نكمل بلا تسخين */ }

    // ٢) صفحة المنتج بنفس الكوكيز + Referer.
    const headers = browserHeaders(lang, origin + '/');
    if (Object.keys(jar).length) headers['Cookie'] = cookieHeader(jar);
    const res = await fetch(p.url, { headers, redirect: 'follow' });
    const html = await res.text();
    if (isBlockPage(html)) return { id: p.id, error: `block_page (${res.status})` };
    if (!res.ok && html.length < 3000) return { id: p.id, error: `http_${res.status}` };
    const parsed = parsePrice(html);
    if (!parsed) return { id: p.id, error: 'price_not_found — قد يحتاج parse.js تحديثاً' };
    return { id: p.id, price: parsed.price, currency: parsed.currency, in_stock: parsed.inStock, image: parsed.image, sku: parsed.sku };
  } catch (e) {
    return { id: p.id, error: String(e.message || e).slice(0, 200) };
  }
}

async function main() {
  const dueRes = await fetch(`${WORKER_URL}/api/due`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!dueRes.ok) throw new Error(`/api/due → ${dueRes.status}`);
  const { products } = await dueRes.json();
  if (!products.length) { console.log(`${stamp()} لا منتجات نشطة`); return; }

  const results = [];
  for (const p of products) {
    results.push(await fetchOne(p));
    await sleep(300 + Math.random() * 600); // فاصل بشري
  }

  const ingRes = await fetch(`${WORKER_URL}/api/ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  });
  const summary = await ingRes.json().catch(() => ({}));
  const okCount = results.filter((r) => r.price != null).length;
  const errs = results.filter((r) => r.error);
  console.log(`${stamp()} فُحص ${results.length} · نجح ${okCount} · تغيّرات ${summary.changes ?? '?'}` +
    (errs.length ? ` · أخطاء ${errs.length}: ${errs.map((e) => `#${e.id}:${e.error}`).join(' | ')}` : ''));
}

main().catch((e) => { console.error(`${stamp()} ✗`, e.message || e); process.exit(1); });
