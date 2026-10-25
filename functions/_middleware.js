import { isConfigured, getAccessEmail, getSessionEmail } from '../lib/auth.js';

// Lo único que se entrega sin sesión: la página (con su pantalla de ingreso) y el logo.
const PUBLIC_PATHS = new Set(['/', '/index.html', '/docs/logo.png']);

export async function onRequest({ request, env, next }) {
  const path = new URL(request.url).pathname;
  if (PUBLIC_PATHS.has(path) || path.startsWith('/api/')) return next();

  // Todo lo demás (PDF y otros archivos) exige correo verificado por Access + clave validada, del mismo usuario
  if (!isConfigured(env)) return text('Portal no configurado', 503);
  try {
    const email = await getAccessEmail(request, env);
    const sessionEmail = await getSessionEmail(request, env);
    if (!email || sessionEmail !== email) return text('No autorizado', 401);
  } catch (e) {
    return text('No se pudo verificar el acceso', 503);
  }

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'private, no-store');
  return out;
}

function text(body, status) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
