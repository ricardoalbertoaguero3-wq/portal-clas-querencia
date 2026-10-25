import { clearCookie, json } from '../../lib/auth.js';

// Cierra la sesión del portal y descarta un correo verificado a medio ingreso.
export async function onRequestPost() {
  return json({ ok: true }, 200, [clearCookie('session'), clearCookie('pre')]);
}
