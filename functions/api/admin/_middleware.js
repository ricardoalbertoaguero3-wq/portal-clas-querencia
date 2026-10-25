import { isConfigured, getCookieEmail, json } from '../../../lib/auth.js';
import { isAdmin } from '../../../lib/catalog.js';

// Todo /api/admin/* exige sesión abierta de un correo incluido en ADMIN_EMAILS.
export async function onRequest(context) {
  const { request, env, next, data } = context;
  if (!isConfigured(env)) return json({ ok: false, error: 'config' }, 503);
  const email = await getCookieEmail(request, 'session', env);
  if (!email) return json({ ok: false, error: 'sesion' }, 401);
  if (!isAdmin(email, env)) return json({ ok: false, error: 'admin' }, 403);
  data.email = email;
  return next();
}
