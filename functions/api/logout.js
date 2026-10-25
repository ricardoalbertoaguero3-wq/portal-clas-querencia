import { clearSessionCookie, json } from '../../lib/auth.js';

// Cierra la sesión del portal; el navegador luego cierra la de Access en /cdn-cgi/access/logout.
export async function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}
