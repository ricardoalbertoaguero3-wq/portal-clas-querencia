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

  // Registro de ingresos: se consulta en el panel de Cloudflare (KV → claves "log:"), se conserva 90 días
  await env.AUTH_KV.put(`log:${new Date().toISOString()}:${email}`,
    JSON.stringify({ ip: clientIp(request), agente: request.headers.get('User-Agent') || '' }),
    { expirationTtl: 90 * 86400 });

  return json({ ok: true, email }, 200, [await createCookie('session', email, env), clearCookie('pre')]);
}
