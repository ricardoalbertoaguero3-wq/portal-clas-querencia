import {
  isConfigured, normalizeEmail, isValidEmail, isAllowed, clientIp, hit, newCode, codeHash,
  now, json, readJson, CODE_MINUTES,
} from '../../lib/auth.js';

// Paso 1: genera un código de 6 dígitos y lo envía al correo, si está autorizado.
export async function onRequestPost({ request, env }) {
  if (!isConfigured(env)) return json({ ok: false, error: 'config' }, 503);

  const body = await readJson(request);
  const email = normalizeEmail(body && body.email);
  if (!isValidEmail(email)) return json({ ok: false, error: 'correo' }, 400);

  if (!(await hit(env, `rl:ip:${clientIp(request)}`, 20, 3600))) return json({ ok: false, error: 'limite' }, 429);

  // Misma respuesta para correos no autorizados: no se revela quién está en la lista
  if (!isAllowed(email, env)) return json({ ok: true });

  if (await env.AUTH_KV.get(`rl:last:${email}`)) return json({ ok: false, error: 'espera' }, 429);
  if (!(await hit(env, `rl:send:${email}`, 5, 3600))) return json({ ok: false, error: 'limite' }, 429);

  const code = newCode();
  const exp = now() + CODE_MINUTES * 60;
  await env.AUTH_KV.put(`otp:${email}`, JSON.stringify({ hash: await codeHash(email, code, env), exp, attempts: 0 }), { expiration: exp });
  await env.AUTH_KV.put(`rl:last:${email}`, '1', { expirationTtl: 60 });

  let sent = false;
  try {
    const r = await fetch(env.MAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.MAIL_WEBHOOK_SECRET, to: email, code, minutos: CODE_MINUTES }),
    });
    sent = !!(await r.json()).ok;
  } catch {
    sent = false;
  }
  if (!sent) {
    await env.AUTH_KV.delete(`otp:${email}`);
    await env.AUTH_KV.delete(`rl:last:${email}`);
    return json({ ok: false, error: 'envio' }, 502);
  }
  return json({ ok: true });
}
