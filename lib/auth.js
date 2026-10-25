// Autenticación del portal (Cloudflare Pages Functions), en tres pasos:
//   1. Correo: debe estar en ALLOWED_EMAILS; se envía un código de 6 dígitos (Google Apps Script).
//   2. Código: se valida contra el guardado en KV (vence en 10 min, 5 intentos) → cookie "pre" de 15 min.
//   3. Clave: se compara con PORTAL_PASSWORD → cookie de sesión de 8 h.
//
// Configuración (Pages → Settings):
//   Variables y secretos: ALLOWED_EMAILS, PORTAL_PASSWORD, SESSION_SECRET, MAIL_WEBHOOK_URL, MAIL_WEBHOOK_SECRET
//   Enlace KV (Bindings): AUTH_KV

const enc = new TextEncoder();
const dec = new TextDecoder();

export const CODE_MINUTES = 10;
export const CODE_ATTEMPTS = 5;
const COOKIES = {
  pre: { name: 'claq_pre', seconds: 15 * 60 },
  session: { name: 'claq_session', seconds: 8 * 3600 },
};

export function isConfigured(env) {
  return !!(env.ALLOWED_EMAILS && env.PORTAL_PASSWORD && env.SESSION_SECRET &&
    env.MAIL_WEBHOOK_URL && env.MAIL_WEBHOOK_SECRET && env.AUTH_KV);
}

export function now() {
  return Math.floor(Date.now() / 1000);
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// ALLOWED_EMAILS admite correos separados por comas, espacios, punto y coma o saltos de línea
export function isAllowed(email, env) {
  return String(env.ALLOWED_EMAILS).split(/[\s,;]+/).map(normalizeEmail).includes(email);
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'local';
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function bytesToB64url(bytes) {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToString(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return dec.decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// La firma depende también de la clave: al cambiar PORTAL_PASSWORD se invalidan todas las sesiones.
async function sign(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(`${env.SESSION_SECRET}|${env.PORTAL_PASSWORD}`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToB64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(value))));
}

// Comparación en tiempo constante (sobre los SHA-256, para que el largo no filtre información).
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function codeHash(email, code, env) {
  return bytesToB64url(await sha256(`${env.SESSION_SECRET}|${email}|${code}`));
}

export function newCode() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
}

// Cookie firmada "tipo.correo.vencimiento.firma"; el tipo impide usar la cookie "pre" como sesión
export async function createCookie(kind, email, env) {
  const { name, seconds } = COOKIES[kind];
  const data = `${kind}.${bytesToB64url(enc.encode(email))}.${now() + seconds}`;
  return `${name}=${data}.${await sign(env, data)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
}

export function clearCookie(kind) {
  return `${COOKIES[kind].name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

// Correo de una cookie vigente del tipo indicado, o null. Si el correo salió de la lista, deja de valer.
export async function getCookieEmail(request, kind, env) {
  const value = getCookie(request, COOKIES[kind].name);
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== kind) return null;
  const [, emailPart, exp, sig] = parts;
  if (Number(exp) < now()) return null;
  if (!(await safeEqual(await sign(env, `${kind}.${emailPart}.${exp}`), sig))) return null;
  let email;
  try {
    email = b64urlToString(emailPart);
  } catch {
    return null;
  }
  return isAllowed(email, env) ? email : null;
}

// Contador con vencimiento en KV. Devuelve false si ya se alcanzó el límite.
export async function hit(env, key, limit, ttlSeconds) {
  const count = Number(await env.AUTH_KV.get(key)) || 0;
  if (count >= limit) return false;
  await env.AUTH_KV.put(key, String(count + 1), { expirationTtl: ttlSeconds });
  return true;
}

export async function overLimit(env, key, limit) {
  return (Number(await env.AUTH_KV.get(key)) || 0) >= limit;
}

export function json(data, status = 200, cookies = []) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  cookies.forEach(c => headers.append('Set-Cookie', c));
  return new Response(JSON.stringify(data), { status, headers });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
