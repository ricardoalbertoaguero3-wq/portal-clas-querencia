const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /api/docs — lista todos los documentos en la nube
      if (path === '/api/docs' && request.method === 'GET') {
        const list = await env.DOCS_META.list({ prefix: 'doc:' });
        const docs = await Promise.all(
          list.keys.map(k => env.DOCS_META.get(k.name, { type: 'json' }))
        );
        return json(docs.filter(Boolean));
      }

      // GET /api/docs/:id/file — sirve el PDF desde R2
      const fileMatch = path.match(/^\/api\/docs\/([^/]+)\/file$/);
      if (fileMatch && request.method === 'GET') {
        const meta = await env.DOCS_META.get(`doc:${fileMatch[1]}`, { type: 'json' });
        if (!meta) return notFound();
        const object = await env.DOCS_BUCKET.get(meta.r2Key);
        if (!object) return notFound();
        return new Response(object.body, {
          headers: {
            ...CORS,
            'Content-Type': 'application/pdf',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      // POST /api/upload — sube un PDF (requiere autenticación)
      if (path === '/api/upload' && request.method === 'POST') {
        if (!checkAuth(request, env)) return unauthorized();
        const form = await request.formData();
        const file = form.get('file');
        if (!file) return new Response('No file', { status: 400, headers: CORS });
        const id = crypto.randomUUID();
        const r2Key = `docs/${id}.pdf`;
        await env.DOCS_BUCKET.put(r2Key, file.stream(), {
          httpMetadata: { contentType: 'application/pdf' },
        });
        const meta = {
          id,
          catNombre: (form.get('catNombre') || '').trim(),
          titulo: (form.get('titulo') || file.name).trim(),
          descripcion: (form.get('descripcion') || '').trim(),
          periodo: (form.get('periodo') || String(new Date().getFullYear())).trim(),
          addedAt: Date.now(),
          r2Key,
        };
        await env.DOCS_META.put(`doc:${id}`, JSON.stringify(meta));
        return json(meta);
      }

      // DELETE /api/docs/:id — elimina un documento (requiere autenticación)
      const delMatch = path.match(/^\/api\/docs\/([^/]+)$/);
      if (delMatch && request.method === 'DELETE') {
        if (!checkAuth(request, env)) return unauthorized();
        const id = delMatch[1];
        const meta = await env.DOCS_META.get(`doc:${id}`, { type: 'json' });
        if (meta) await env.DOCS_BUCKET.delete(meta.r2Key);
        await env.DOCS_META.delete(`doc:${id}`);
        return new Response('OK', { headers: CORS });
      }

      return new Response('Not found', { status: 404, headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  },
};

function checkAuth(request, env) {
  return (request.headers.get('Authorization') || '') === `Bearer ${env.UPLOAD_SECRET}`;
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function unauthorized() {
  return new Response('Unauthorized', { status: 401, headers: CORS });
}

function notFound() {
  return new Response('Not found', { status: 404, headers: CORS });
}
