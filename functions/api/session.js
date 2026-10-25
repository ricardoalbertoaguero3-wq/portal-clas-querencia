import { isConfigured, getAccessEmail, getSessionEmail, json } from '../../lib/auth.js';

// Estado del ingreso: correo verificado por Access y si ya se validó la clave.
export async function onRequestGet({ request, env }) {
  if (!isConfigured(env)) return json({ ok: false, error: 'config' });
  try {
    const email = await getAccessEmail(request, env);
    if (!email) return json({ ok: false, error: 'access' });
    const sessionEmail = await getSessionEmail(request, env);
    return json({ ok: true, email, unlocked: sessionEmail === email });
  } catch (e) {
    return json({ ok: false, error: 'verify' }, 503);
  }
}
