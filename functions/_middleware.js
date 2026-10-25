import { isConfigured, getCookieEmail } from '../lib/auth.js';

// Lo único que se entrega sin sesión: la página (con su pantalla de ingreso), el logo y la API de ingreso.
const PUBLIC_PATHS = new Set(['/', '/index.html', '/docs/logo.png']);

export async function onRequest({ request, env, next }) {
  const path = new URL(request.url).pathname;
  if (PUBLIC_PATHS.has(path) || path.startsWith('/api/')) return next();

  // Todo lo demás (PDF y otros archivos) exige haber completado correo + código + clave
  if (!isConfigured(env)) return text('Portal no configurado', 503);
  if (!(await getCookieEmail(request, 'session', env))) return text('No autorizado', 401);

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'private, no-store');
  return out;
}

function text(body, status) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
