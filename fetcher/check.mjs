// الجالب المحلي — يعمل على جهاز أندرويد (Termux) بـ IP منزلي غير محظور.
// يسأل الـ Worker عن المنتجات، يجلب كل صفحة، يستخرج السعر، يرسل النتائج.
//
//   node check.mjs
//
// شي إن تحظر طلبات غير المتصفّح (بصمة TLS). لذلك إذا وُجد Chromium على الجهاز
// نستخدمه (متصفّح حقيقي = يتجاوز الحظر). وإلا نرجع لطلب fetch عادي.
// يقرأ WORKER_URL و INGEST_TOKEN من fetcher/.env

import { readFileSync, existsSync } from 'node:fs';
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

// ── العثور على Chromium ─────────────────────────────────────────────
function findChromium() {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const prefix = process.env.PREFIX || '/data/data/com.termux/files/usr';
  const cands = [
    `${prefix}/bin/chromium`,
    `${prefix}/bin/chromium-browser`,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  return cands.find((c) => existsSync(c)) || null;
}

// ── المسار ١: متصفّح حقيقي (Chromium + puppeteer-core) ──────────────
async function fetchViaBrowser(products, chromePath) {
  let puppeteer;
  try {
    const [{ addExtra }, pcore, { default: Stealth }] = await Promise.all([
      import('puppeteer-extra'), import('puppeteer-core'), import('puppeteer-extra-plugin-stealth'),
    ]);
    puppeteer = addExtra(pcore.default || pcore);
    puppeteer.use(Stealth());
  } catch {
    puppeteer = (await import('puppeteer-core')).default; // بلا stealth
  }
  const headless = process.env.HEADLESS ? 'new' : false;
  const launch = () => puppeteer.launch({
    executablePath: chromePath,
    headless,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--no-zygote', '--disable-extensions', '--window-size=412,915',
      '--disable-blink-features=AutomationControlled',
      '--lang=ar-EG,ar', '--mute-audio',
    ],
  });

  // جلب منتج واحد داخل متصفّح جديد (جلسة نظيفة = زيارة أولى لكل منتج).
  async function fetchOneFresh(p) {
    const region = p.region || 'ar';
    const lang = LANG_BY_REGION[region] || LANG_BY_REGION.ar;
    const origin = `https://${region === 'www' ? 'www' : region}.shein.com`;
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': lang });
      if (process.env.FORCE_UA) {
        await page.setUserAgent(UA);
        await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
      }
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['ar-EG', 'ar', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        window.chrome = { runtime: {}, app: {}, csi: () => {}, loadTimes: () => {} };
        const q = window.navigator.permissions && window.navigator.permissions.query;
        if (q) window.navigator.permissions.query = (x) =>
          x && x.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : q(x);
      });
      const humanize = async () => {
        try {
          for (let i = 0; i < 5; i++) {
            await page.mouse.move(60 + Math.random() * 300, 100 + Math.random() * 500, { steps: 8 });
            await sleep(200 + Math.random() * 400);
          }
          await page.evaluate(() => new Promise((res) => {
            let y = 0; const t = setInterval(() => { y += 250; window.scrollTo(0, y); if (y > 2500) { clearInterval(t); res(); } }, 250);
          }));
        } catch { /* تجاهل */ }
      };
      // تسخين: زيارة الصفحة الرئيسية أولاً للحصول على كوكيز Akamai بشكل طبيعي.
      try {
        await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
        await humanize();
        await sleep(2000 + Math.random() * 2000);
      } catch { /* نكمل */ }
      // صفحة المنتج.
      await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 60000 });
      await humanize();
      await sleep(3000 + Math.random() * 2000);
      let html = await page.content();
      for (let attempt = 0; attempt < 4 && isBlockPage(html); attempt++) {
        await sleep(5000 + attempt * 4000);
        await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
        await humanize();
        await sleep(3000 + Math.random() * 2000);
        html = await page.content();
      }
      if (process.env.DUMP) { const { writeFileSync } = await import('node:fs'); writeFileSync(join(HERE, 'debug.html'), html); console.error(`  ↳ dumped ${html.length}b → debug.html`); }
      if (isBlockPage(html)) return { id: p.id, error: 'block_page (browser)' };
      const parsed = parsePrice(html);
      if (!parsed) return { id: p.id, error: 'price_not_found — قد يحتاج parse.js تحديثاً' };
      return { id: p.id, price: parsed.price, currency: parsed.currency, in_stock: parsed.inStock, image: parsed.image, sku: parsed.sku, name: parsed.name };
    } catch (e) {
      return { id: p.id, error: String(e.message || e).slice(0, 200) };
    } finally {
      await browser.close().catch(() => {});
    }
  }

  const results = [];
  for (const p of products) {
    let r = await fetchOneFresh(p);
    if (r.error === 'block_page (browser)') {           // محاولة ثانية بمتصفّح جديد تماماً
      await sleep(15000 + Math.random() * 15000);
      r = await fetchOneFresh(p);
    }
    results.push(r);
    await sleep(8000 + Math.random() * 8000);
  }
  return results;
}

// ── المسار ٢: fetch عادي (احتياطي — غالباً محظور) ──────────────────
function browserHeaders(lang, referer) {
  const h = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': lang,
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none', 'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
  if (referer) h['Referer'] = referer;
  return h;
}
function collectCookies(res, jar) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of list) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
}
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

async function fetchOneHttp(p) {
  const region = p.region || 'ar';
  const lang = LANG_BY_REGION[region] || LANG_BY_REGION.ar;
  const origin = `https://${region === 'www' ? 'www' : region}.shein.com`;
  const jar = {};
  try {
    try {
      const home = await fetch(origin + '/', { headers: browserHeaders(lang), redirect: 'follow' });
      collectCookies(home, jar);
      await home.text().catch(() => {});
      await sleep(500 + Math.random() * 800);
    } catch { /* نكمل بلا تسخين */ }
    const headers = browserHeaders(lang, origin + '/');
    if (Object.keys(jar).length) headers['Cookie'] = cookieHeader(jar);
    const res = await fetch(p.url, { headers, redirect: 'follow' });
    const html = await res.text();
    if (isBlockPage(html)) return { id: p.id, error: `block_page (${res.status})` };
    if (!res.ok && html.length < 3000) return { id: p.id, error: `http_${res.status}` };
    const parsed = parsePrice(html);
    if (!parsed) return { id: p.id, error: 'price_not_found — قد يحتاج parse.js تحديثاً' };
    return { id: p.id, price: parsed.price, currency: parsed.currency, in_stock: parsed.inStock, image: parsed.image, sku: parsed.sku, name: parsed.name };
  } catch (e) {
    return { id: p.id, error: String(e.message || e).slice(0, 200) };
  }
}

async function main() {
  // NEW_ONLY=1 → يجلب فقط المنتجات المضافة حديثاً (لم تُفحص بعد) — للحلقة السريعة.
  const newOnly = !!process.env.NEW_ONLY;
  const dueRes = await fetch(`${WORKER_URL}/api/due${newOnly ? '?new=1' : ''}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!dueRes.ok) throw new Error(`/api/due → ${dueRes.status}`);
  const { products } = await dueRes.json();
  if (!products.length) { if (!newOnly) console.log(`${stamp()} لا منتجات نشطة`); return; }

  const chromePath = findChromium();
  let results;
  if (chromePath) {
    try {
      results = await fetchViaBrowser(products, chromePath);
    } catch (e) {
      console.error(`${stamp()} ⚠ فشل المتصفّح (${e.message || e}) — أجرّب fetch`);
    }
  }
  if (!results) {
    results = [];
    for (const p of products) {
      results.push(await fetchOneHttp(p));
      await sleep(300 + Math.random() * 600);
    }
  }

  const ingRes = await fetch(`${WORKER_URL}/api/ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  });
  const summary = await ingRes.json().catch(() => ({}));
  const okCount = results.filter((r) => r.price != null).length;
  const errs = results.filter((r) => r.error);
  console.log(`${stamp()} [${chromePath ? 'browser' : 'fetch'}] فُحص ${results.length} · نجح ${okCount} · تغيّرات ${summary.changes ?? '?'}` +
    (errs.length ? ` · أخطاء ${errs.length}: ${errs.map((e) => `#${e.id}:${e.error}`).join(' | ')}` : ''));
}

main().catch((e) => { console.error(`${stamp()} ✗`, e.message || e); process.exit(1); });
