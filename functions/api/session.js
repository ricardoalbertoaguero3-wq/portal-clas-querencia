import { isConfigured, getCookieEmail, json } from '../../lib/auth.js';

// Paso en el que está el usuario: "correo" (sin verificar), "clave" (código validado) o "listo" (sesión abierta).
export async function onRequestGet({ request, env }) {
  if (!isConfigured(env)) return json({ ok: false, error: 'config' });
  const sessionEmail = await getCookieEmail(request, 'session', env);
  if (sessionEmail) return json({ ok: true, stage: 'listo', email: sessionEmail });
  const preEmail = await getCookieEmail(request, 'pre', env);
  if (preEmail) return json({ ok: true, stage: 'clave', email: preEmail });
  return json({ ok: true, stage: 'correo' });
}
