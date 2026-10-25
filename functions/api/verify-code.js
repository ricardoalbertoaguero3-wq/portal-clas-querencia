import {
  isConfigured, normalizeEmail, isAllowed, clientIp, hit, overLimit, codeHash, safeEqual,
  createCookie, now, sleep, json, readJson, CODE_ATTEMPTS,
} from '../../lib/auth.js';

// Paso 2: valida el código recibido por correo y deja pasar al paso de la clave (cookie "pre" de 15 min).
export async function onRequestPost({ request, env }) {
  if (!isConfigured(env)) return json({ ok: false, error: 'config' }, 503);

  const body = await readJson(request);
  const email = normalizeEmail(body && body.email);
  const code = String((body && body.code) || '').trim();
  const failKey = `rl:fail:${clientIp(request)}`;
  if (await overLimit(env, failKey, 30)) return json({ ok: false, error: 'limite' }, 429);

  const key = `otp:${email}`;
  const rec = email ? await env.AUTH_KV.get(key, { type: 'json' }) : null;
  if (!rec || rec.exp < now() || !isAllowed(email, env)) return json({ ok: false, error: 'expirado' }, 400);

  if (!/^\d{6}$/.test(code) || !(await safeEqual(await codeHash(email, code, env), rec.hash))) {
    rec.attempts += 1;
    if (rec.attempts >= CODE_ATTEMPTS) await env.AUTH_KV.delete(key);
    else await env.AUTH_KV.put(key, JSON.stringify(rec), { expiration: Math.max(rec.exp, now() + 60) });
    await hit(env, failKey, Infinity, 3600);
    await sleep(800);
    if (rec.attempts >= CODE_ATTEMPTS) return json({ ok: false, error: 'intentos' }, 401);
    return json({ ok: false, error: 'codigo', restantes: CODE_ATTEMPTS - rec.attempts }, 401);
  }

  await env.AUTH_KV.delete(key);
  return json({ ok: true, email }, 200, [await createCookie('pre', email, env)]);
}
