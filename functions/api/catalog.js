import { isConfigured, getCookieEmail, json } from '../../lib/auth.js';
import { getCatalog, toClient, isAdmin } from '../../lib/catalog.js';

// Lista de documentos y jefes de servicio, solo para quien tiene sesión abierta.
export async function onRequestGet({ request, env }) {
  if (!isConfigured(env)) return json({ ok: false, error: 'config' }, 503);
  const email = await getCookieEmail(request, 'session', env);
  if (!email) return json({ ok: false, error: 'sesion' }, 401);
  return json({ ok: true, admin: isAdmin(email, env), catalog: toClient(await getCatalog(env)) });
}
