// جلسة لوحة التحكم: كوكي موقّع HMAC-SHA256 (بلا مكتبة). كلمة المرور تُقارَن
// بثبات زمني نسبي عبر مقارنة تجزئتها.

const COOKIE = 'spt_session';
const TTL_SEC = 60 * 60 * 24 * 14; // أسبوعان

const enc = new TextEncoder();

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// مقارنة ثابتة الزمن
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function checkPassword(env, password) {
  if (!env.ADMIN_PASSWORD) return false;
  const a = await sha256hex(String(password || ''));
  const b = await sha256hex(env.ADMIN_PASSWORD);
  return safeEqual(a, b);
}

export async function issueCookie(env) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const payload = `${exp}`;
  const sig = await hmac(env.AUTH_SECRET, payload);
  const value = `${payload}.${sig}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL_SEC}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function isAuthed(env, request) {
  const raw = (request.headers.get('Cookie') || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const value = raw.slice(COOKIE.length + 1);
  const dot = value.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = await hmac(env.AUTH_SECRET, payload);
  if (!safeEqual(sig, expected)) return false;
  const exp = parseInt(payload, 10);
  return Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000);
}
