// Autenticación del portal (Cloudflare Pages Functions).
// Paso 1: Cloudflare Access verifica el correo con un código de un solo uso; aquí se valida su JWT.
// Paso 2: la clave institucional se valida en el servidor y se emite una sesión firmada (cookie HttpOnly).
//
// Variables de entorno (Pages → Settings → Variables and Secrets):
//   ACCESS_TEAM_DOMAIN  ej. "claslaquerencia.cloudflareaccess.com"
//   ACCESS_AUD          "Application Audience (AUD) Tag" de la aplicación de Access
//   PORTAL_PASSWORD     clave institucional (secreto)
//   SESSION_SECRET      cadena aleatoria larga para firmar sesiones (secreto)

const enc = new TextEncoder();
const dec = new TextDecoder();
const SESSION_COOKIE = 'claq_session';
const SESSION_HOURS = 8;

let certsCache = { url: '', keys: null, at: 0 };

export function isConfigured(env) {
  return !!(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD && env.PORTAL_PASSWORD && env.SESSION_SECRET);
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function bytesToB64url(bytes) {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function teamDomain(env) {
  return String(env.ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

async function getAccessKeys(env) {
  const url = `https://${teamDomain(env)}/cdn-cgi/access/certs`;
  if (certsCache.url === url && certsCache.keys && Date.now() - certsCache.at < 3600e3) return certsCache.keys;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudieron obtener las llaves de Access (${r.status})`);
  const { keys } = await r.json();
  certsCache = { url, keys, at: Date.now() };
  return keys;
}

// Correo verificado por Cloudflare Access, o null si no hay un JWT válido para esta aplicación.
export async function getAccessEmail(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || getCookie(request, 'CF_Authorization');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let header, payload;
  try {
    header = JSON.parse(dec.decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(dec.decode(b64urlToBytes(parts[1])));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256') return null;

  const jwk = (await getAccessKeys(env)).find(k => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (!payload.exp || payload.exp < now) return null;
  if (payload.iss && payload.iss !== `https://${teamDomain(env)}`) return null;
  return payload.email ? String(payload.email).toLowerCase() : null;
}

// La firma depende también de la clave: al cambiar PORTAL_PASSWORD se invalidan todas las sesiones.
async function sign(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(`${env.SESSION_SECRET}|${env.PORTAL_PASSWORD}`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToB64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

// Comparación en tiempo constante (sobre los SHA-256, para que el largo no filtre información).
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function createSessionCookie(email, env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
  const data = `${bytesToB64url(enc.encode(email))}.${exp}`;
  const sig = await sign(env, data);
  return `${SESSION_COOKIE}=${data}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

// Correo de la sesión del portal (clave ya validada), o null si no hay sesión vigente.
export async function getSessionEmail(request, env) {
  const value = getCookie(request, SESSION_COOKIE);
  if (!value) return null;
  const [emailPart, exp, sig] = value.split('.');
  if (!emailPart || !exp || !sig) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  if (!(await safeEqual(await sign(env, `${emailPart}.${exp}`), sig))) return null;
  try {
    return dec.decode(b64urlToBytes(emailPart));
  } catch {
    return null;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}
