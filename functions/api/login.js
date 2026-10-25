import {
  isConfigured, getCookieEmail, hit, overLimit, safeEqual, createCookie, clearCookie,
  clientIp, sleep, json, readJson,
} from '../../lib/auth.js';

// Paso 3: valida la clave institucional para el correo ya verificado y abre la sesión del portal.
export async function onRequestPost({ request, env }) {
  if (!isConfigured(env)) return json({ ok: false, error: 'config' }, 503);

  const email = await getCookieEmail(request, 'pre', env);
  if (!email) return json({ ok: false, error: 'sesion' }, 401);

  const failKey = `rl:pw:${email}`;
  if (await overLimit(env, failKey, 10)) return json({ ok: false, error: 'limite' }, 429);

  const body = await readJson(request);
  const clave = String((body && body.clave) || '');
  if (!clave || !(await safeEqual(clave, env.PORTAL_PASSWORD))) {
    await hit(env, failKey, Infinity, 3600);
    await sleep(800);
    return json({ ok: false, error: 'clave' }, 401);
  }

  // Registro de ingresos (se ve en el panel de administración; se conserva 90 días).
  // La clave invierte la hora para que KV liste primero los ingresos más recientes.
  const ts = Date.now();
  await env.AUTH_KV.put(`acc:${String(9999999999999 - ts).padStart(13, '0')}:${email}`, '', {
    expirationTtl: 90 * 86400,
    metadata: { fecha: new Date(ts).toISOString(), correo: email, ip: clientIp(request) },
  });

  return json({ ok: true, email }, 200, [await createCookie('session', email, env), clearCookie('pre')]);
}
