import { isConfigured, getCookieEmail } from '../../../lib/auth.js';

// Entrega un PDF subido desde el panel de administración (guardado en KV), solo con sesión abierta.
export async function onRequestGet({ request, env, params }) {
  if (!isConfigured(env)) return text('Portal no configurado', 503);
  if (!(await getCookieEmail(request, 'session', env))) return text('No autorizado', 401);

  const id = String(params.id || '');
  if (!/^k[0-9a-f]{12}$/.test(id)) return text('No encontrado', 404);
  const { value } = await env.AUTH_KV.getWithMetadata(`file:${id}`, { type: 'stream' });
  if (!value) return text('No encontrado', 404);

  return new Response(value, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function text(body, status) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
