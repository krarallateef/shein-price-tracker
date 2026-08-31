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

const UA_BY_REGION = {
  ar: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Mobile Safari/537.36',
};
const LANG_BY_REGION = { ar: 'ar,en;q=0.8', www: 'en-US,en;q=0.9' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString();

async function fetchOne(p) {
  const region = p.region || 'ar';
  const ua = UA_BY_REGION[region] || UA_BY_REGION.ar;
  const lang = LANG_BY_REGION[region] || LANG_BY_REGION.ar;
  try {
    const res = await fetch(p.url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': lang,
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });
    const html = await res.text();
    if (isBlockPage(html)) return { id: p.id, error: `block_page (${res.status}) — IP قد يكون محظوراً` };
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
