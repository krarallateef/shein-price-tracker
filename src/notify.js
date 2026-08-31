// قنوات التنبيه: تلغرام (مجاني، فوري) + إيميل عبر Resend (اختياري).
// كل الإعدادات في جدول settings.

async function getSettings(env, keys) {
  const ph = keys.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${ph})`).bind(...keys).all();
  const out = {};
  for (const r of results || []) out[r.key] = r.value;
  return out;
}

export async function sendTelegram(env, text) {
  const s = await getSettings(env, ['telegram_token', 'telegram_chat_id']);
  if (!s.telegram_token || !s.telegram_chat_id) return { ok: false, reason: 'telegram_not_configured' };
  const res = await fetch(`https://api.telegram.org/bot${s.telegram_token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: s.telegram_chat_id, text, parse_mode: 'HTML', disable_web_page_preview: false }),
  });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok && j.ok !== false, reason: j.description };
}

export async function sendEmail(env, subject, html) {
  const s = await getSettings(env, ['resend_api_key', 'resend_from', 'resend_to']);
  if (!s.resend_api_key || !s.resend_from || !s.resend_to) return { ok: false, reason: 'email_not_configured' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.resend_api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: s.resend_from, to: [s.resend_to], subject, html }),
  });
  return { ok: res.ok, reason: res.ok ? undefined : await res.text() };
}

// يوجّه التنبيه حسب قناة المنتج + القناة الافتراضية.
export async function notify(env, channel, { title, text, html }) {
  const s = await getSettings(env, ['default_channel']);
  const ch = channel && channel !== 'default' ? channel : s.default_channel || 'telegram';
  const jobs = [];
  if (ch === 'telegram' || ch === 'both') jobs.push(sendTelegram(env, text));
  if (ch === 'email' || ch === 'both') jobs.push(sendEmail(env, title, html || `<pre>${text}</pre>`));
  return Promise.all(jobs);
}
