import { Hono } from 'hono';
import { DASHBOARD_HTML } from './dashboard.js';
import { checkPassword, issueCookie, clearCookie, isAuthed } from './auth.js';
import { applyResults, watchdog } from './checker.js';
import { extractGoodsId } from './parse.js';
import { sendTelegram } from './notify.js';

const app = new Hono();

app.get('/', (c) => c.html(DASHBOARD_HTML));

// ══ مصادقة اللوحة (كوكي) ══
app.post('/api/login', async (c) => {
  const { password } = await c.req.json().catch(() => ({}));
  if (!(await checkPassword(c.env, password))) return c.json({ ok: false }, 401);
  c.header('Set-Cookie', await issueCookie(c.env));
  return c.json({ ok: true });
});
app.post('/api/logout', (c) => { c.header('Set-Cookie', clearCookie()); return c.json({ ok: true }); });
app.get('/api/me', async (c) => c.json({ authed: await isAuthed(c.env, c.req.raw) }));

// ══ مسارات الجالب المحلي (توكن مشترك، منفصل عن كوكي اللوحة) ══
function ingestAuthed(c) {
  const h = c.req.header('Authorization') || '';
  return c.env.INGEST_TOKEN && h === `Bearer ${c.env.INGEST_TOKEN}`;
}
app.get('/api/due', (c, next) => (ingestAuthed(c) ? next() : c.json({ error: 'unauthorized' }, 401)));
app.get('/api/due', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, url, region, goods_id FROM products WHERE active=1 ORDER BY (last_checked_at IS NULL) DESC, last_checked_at ASC'
  ).all();
  return c.json({ products: results || [] });
});
app.post('/api/ingest', (c, next) => (ingestAuthed(c) ? next() : c.json({ error: 'unauthorized' }, 401)));
app.post('/api/ingest', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const results = Array.isArray(body.results) ? body.results : body.id ? [body] : [];
  return c.json(await applyResults(c.env, results));
});

// ══ حارس: كل /api/* آخر يتطلّب كوكي اللوحة ══
app.use('/api/*', async (c, next) => {
  if (!(await isAuthed(c.env, c.req.raw))) return c.json({ error: 'unauthorized' }, 401);
  await next();
});

// ── المنتجات ──
app.get('/api/products', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM products ORDER BY id DESC').all();
  return c.json({ products: results || [] });
});
app.post('/api/products', async (c) => {
  const b = await c.req.json();
  if (!b.url || !/^https?:\/\//.test(b.url)) return c.json({ error: 'رابط غير صالح' }, 400);
  const region = (b.url.match(/https?:\/\/([a-z0-9-]+)\.shein\.com/i) || [])[1] || 'www';
  await c.env.DB.prepare(
    'INSERT INTO products (url, goods_id, label, region, target_price, notify_channel) VALUES (?,?,?,?,?,?)'
  ).bind(b.url.trim(), extractGoodsId(b.url), b.label || null, region, b.target_price ?? null, b.notify_channel || 'telegram').run();
  return c.json({ ok: true });
});
app.patch('/api/products/:id', async (c) => {
  const b = await c.req.json();
  const fields = [], vals = [];
  for (const k of ['label', 'target_price', 'notify_channel', 'active']) if (k in b) { fields.push(`${k}=?`); vals.push(b[k]); }
  if (fields.length) { vals.push(c.req.param('id')); await c.env.DB.prepare(`UPDATE products SET ${fields.join(',')} WHERE id=?`).bind(...vals).run(); }
  return c.json({ ok: true });
});
app.delete('/api/products/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM price_events WHERE product_id=?').bind(c.req.param('id')).run();
  await c.env.DB.prepare('DELETE FROM products WHERE id=?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// ── سجلّ التغيّرات ──
app.get('/api/events', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT e.*, p.label FROM price_events e LEFT JOIN products p ON p.id=e.product_id ORDER BY e.detected_at DESC LIMIT 200'
  ).all();
  return c.json({ events: results || [] });
});

// ── الإعدادات ──
const SETTING_KEYS = ['telegram_token', 'telegram_chat_id', 'resend_api_key', 'resend_from', 'resend_to', 'default_channel', 'watchdog_minutes'];
app.get('/api/settings', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key,value FROM settings').all();
  const s = {};
  for (const r of results || []) s[r.key] = r.value;
  return c.json({ settings: s });
});
app.put('/api/settings', async (c) => {
  const b = await c.req.json();
  for (const k of SETTING_KEYS) {
    if (!(k in b)) continue;
    await c.env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, String(b[k] ?? '')).run();
  }
  return c.json({ ok: true });
});
app.post('/api/test-telegram', async (c) => c.json(await sendTelegram(c.env, '✅ اختبار من متتبّع أسعار شي إن — الإعداد يعمل.')));

export default {
  fetch: app.fetch,
  // الكرون = حارس فقط (لا جلب). ينبّه لو توقّف الجالب المحلي.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(watchdog(env).then((r) => console.log('watchdog:', JSON.stringify(r))).catch((e) => console.error('watchdog error:', e)));
  },
};
