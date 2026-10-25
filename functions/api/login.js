import { isConfigured, getAccessEmail, safeEqual, createSessionCookie, json } from '../../lib/auth.js';

// Valida la clave institucional para el correo ya verificado por Access y abre la sesión del portal.
export async function onRequestPost({ request, env }) {
  if (!isConfigured(env)) return json({ ok: false, error: 'config' }, 503);

  let email;
  try {
    email = await getAccessEmail(request, env);
  } catch (e) {
    return json({ ok: false, error: 'verify' }, 503);
  }
  if (!email) return json({ ok: false, error: 'access' }, 401);

  let clave = '';
  try {
    clave = String((await request.json()).clave || '');
  } catch {
    return json({ ok: false, error: 'formato' }, 400);
  }

  if (!clave || !(await safeEqual(clave, env.PORTAL_PASSWORD))) {
    // Pausa ante una clave incorrecta para frenar intentos repetidos
    await new Promise(r => setTimeout(r, 800));
    return json({ ok: false, error: 'clave' }, 401);
  }

  return json({ ok: true, email }, 200, { 'Set-Cookie': await createSessionCookie(email, env) });
}
