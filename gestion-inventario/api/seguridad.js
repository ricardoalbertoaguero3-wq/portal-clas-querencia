/* =====================================================================
 * seguridad.js — Claves (PBKDF2-SHA256) y comparación en tiempo constante
 * ===================================================================== */
// Cloudflare Workers admite como máximo 100 000 iteraciones de PBKDF2.
export const ITERACIONES = 100000;

const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
const deHex = (h) => new Uint8Array(h.match(/.{2}/g).map((x) => parseInt(x, 16)));

export function nuevaSal() {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function derivarClave(clave, salHex, iteraciones = ITERACIONES) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deHex(salHex), iterations: iteraciones }, base, 256);
  return hex(bits);
}

/** Compara dos cadenas sin filtrar por tiempo cuántos caracteres coinciden */
export function igualesSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function sha256Hex(buffer) {
  return hex(await crypto.subtle.digest('SHA-256', buffer));
}

/** Política mínima de clave */
export function validarClave(clave, usuario) {
  const c = String(clave || '');
  if (c.length < 8) return 'La clave debe tener al menos 8 caracteres.';
  if (!/[A-Za-z]/.test(c) || !/\d/.test(c)) return 'La clave debe combinar letras y números.';
  if (usuario && c.toLowerCase().includes(String(usuario).toLowerCase())) return 'La clave no debe contener el nombre de usuario.';
  return null;
}
