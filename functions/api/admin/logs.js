import { json } from '../../../lib/auth.js';

// Últimos ingresos al portal (los más recientes primero), registrados por /api/login.
export async function onRequestGet({ env }) {
  const list = await env.AUTH_KV.list({ prefix: 'acc:', limit: 200 });
  return json({ ok: true, ingresos: list.keys.map(k => k.metadata).filter(Boolean) });
}
