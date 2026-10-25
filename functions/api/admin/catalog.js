import { json, readJson } from '../../../lib/auth.js';
import { getCatalog, saveCatalog, applyEdit, toClient } from '../../../lib/catalog.js';

// Guarda los cambios del administrador: orden, títulos, secciones, jefes y documentos quitados.
export async function onRequestPut({ request, env }) {
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: 'formato' }, 400);

  const current = await getCatalog(env);
  // Evita pisar cambios hechos al mismo tiempo desde otro equipo
  if (Number(body.rev) !== current.rev) return json({ ok: false, error: 'conflicto' }, 409);

  let result;
  try {
    result = applyEdit(current, body);
  } catch (e) {
    return json({ ok: false, error: e.message === 'seccion-vacia' ? 'seccion-vacia' : 'formato' }, 400);
  }

  await saveCatalog(env, result.catalog);
  // Los PDF subidos que se quitaron se borran; los del repositorio (docs/) solo dejan de listarse
  await Promise.all(result.removed.filter(d => d.kv).map(d => env.AUTH_KV.delete(`file:${d.id}`)));
  return json({ ok: true, catalog: toClient(result.catalog) });
}
