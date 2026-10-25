import { json } from '../../../lib/auth.js';
import { getCatalog, saveCatalog, toClient, newId, MAX_FILE_BYTES } from '../../../lib/catalog.js';

function text(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Sube un PDF a una sección y lo publica de inmediato (queda primero en la lista de su sección).
export async function onRequestPost({ request, env, data }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'formato' }, 400);
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ ok: false, error: 'archivo' }, 400);
  if (file.size > MAX_FILE_BYTES) return json({ ok: false, error: 'grande' }, 413);

  const buf = await file.arrayBuffer();
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(5, buf.byteLength)));
  if (head !== '%PDF-') return json({ ok: false, error: 'pdf' }, 415);

  const catalog = await getCatalog(env);
  const cat = catalog.categorias.find(c => c.id === form.get('categoriaId'));
  if (!cat) return json({ ok: false, error: 'seccion' }, 400);

  const id = newId('k');
  const nombre = text(file.name, 120);
  await env.AUTH_KV.put(`file:${id}`, buf, { metadata: { nombre, bytes: file.size } });

  cat.docs.unshift({
    id,
    titulo: text(form.get('titulo'), 160) || nombre.replace(/\.pdf$/i, ''),
    descripcion: text(form.get('descripcion'), 300),
    periodo: text(form.get('periodo'), 40),
    kv: true,
    bytes: file.size,
    addedAt: Date.now(),
    addedBy: data.email,
  });
  catalog.rev += 1;
  await saveCatalog(env, catalog);
  return json({ ok: true, catalog: toClient(catalog) });
}
