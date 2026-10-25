// Catálogo de documentos del portal: secciones, documentos y jefes de servicio.
// Se guarda en KV (clave "catalog"); si aún no existe, se usa el catálogo inicial de abajo.
// Cada documento es estático (path: "docs/archivo.pdf", publicado con el repositorio)
// o subido desde el panel de administración (kv: true, archivo en KV bajo "file:<id>").

const CATALOG_KEY = 'catalog';
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // límite de un valor en Cloudflare KV

const DEFAULT_CATALOG = {
  rev: 0,
  categorias: [
    {
      id: 'c-administrativo',
      nombre: 'Administrativo',
      docs: [
        { id: 's-plan-mantenimiento-2026', titulo: 'Plan de Mantenimiento Preventivo y Correctivo', descripcion: 'Equipos informáticos y biomédicos del CLAS.', periodo: '2026', path: 'docs/plan-mantenimiento-2026.pdf' },
        { id: 's-inventario-2025', titulo: 'Inventario CLAS Querencia', descripcion: 'Inventario de bienes y equipos del CLAS Agregado La Querencia.', periodo: '2025', path: 'docs/inventario-2025.pdf' },
        { id: 's-situacion-institucional-2025', titulo: 'Informe de Situación Institucional', descripcion: 'Informe de situación institucional del CLAS Agregado La Querencia.', periodo: '2025', path: 'docs/informe-situacion-institucional-2025.pdf' },
      ],
    },
    {
      id: 'c-sanitaria',
      nombre: 'Intervención Sanitaria / Epidemiológico / Brechas',
      docs: [
        { id: 's-asis-2026', titulo: 'ASIS — Análisis de Situación de Salud', descripcion: 'Análisis de Situación de Salud del CLAS Agregado La Querencia.', periodo: '2026', path: 'docs/asis-2026.pdf' },
        { id: 's-morbilidad-agregado-i-sem-2026', titulo: 'Informe de Morbilidad y Producción — CLAS Agregado (I Semestre)', descripcion: 'Reporte de producción de servicios del CLAS Agregado, I Semestre acumulado.', periodo: 'I Sem. 2026', path: 'docs/morbilidad-clas-agregado-i-sem-2026.pdf' },
        { id: 's-morbilidad-cs-i-sem-2026', titulo: 'Informe de Morbilidad y Producción — C.S. La Querencia (I Semestre)', descripcion: 'Reporte de producción de servicios del establecimiento sede, I Semestre acumulado.', periodo: 'I Sem. 2026', path: 'docs/morbilidad-cs-querencia-i-sem-2026.pdf' },
        { id: 's-morbilidad-cs-julio-2026', titulo: 'Informe de Morbilidad y Producción — C.S. La Querencia (Julio)', descripcion: 'Reporte mensual de producción de servicios del establecimiento sede.', periodo: 'Julio 2026', path: 'docs/morbilidad-cs-querencia-julio-2026.pdf' },
      ],
    },
    {
      id: 'c-rrhh',
      nombre: 'Programación del Rol (RR.HH.)',
      docs: [
        { id: 's-rol-agosto-2026', titulo: 'Rol del Personal — Agosto 2026', descripcion: 'Programación mensual de turnos del personal.', periodo: 'Agosto 2026', path: 'docs/rol-personal-agosto-2026.pdf' },
      ],
    },
  ],
  jefes: [
    { servicio: 'Enfermería', nombre: 'Lic. Enf. Veronika G. Salvador Rojas' },
    { servicio: 'Obstetricia', nombre: 'Obst. Verónica M. Fabian Canales' },
    { servicio: 'Odontología', nombre: 'C.D. Pedro Rojas Sovero' },
    { servicio: 'Laboratorio', nombre: 'Lic. Guisela E. Cantú Lagos' },
    { servicio: 'Psicología', nombre: 'Lic. Ps. Sofia Balcazar Saenz' },
    { servicio: 'Gerencia', nombre: 'M.C. Sindy Aguirre Cueva' },
    { servicio: 'Nutrición', nombre: 'Lic. Nut. Jackeline R. Carrillo Espinoza' },
    { servicio: 'Servicio Social', nombre: 'Lic. Mabella J. Tafur Andrade' },
    { servicio: 'Farmacia', nombre: 'Tec. Farm. Evelyn M. Calcina Cruz' },
    { servicio: 'Transporte', nombre: 'Pil. Javier Lopez Guevara' },
    { servicio: 'Administración', nombre: 'Lic. Adm. Ricardo A. Agüero Angulo' },
    { servicio: 'RR.HH.', nombre: 'Tec. Adm. Carmen R. Chavarria Bonifacio' },
    { servicio: 'Estadística', nombre: 'Tec. Adm. Lisbet Villanueva Alegría' },
  ],
};

export async function getCatalog(env) {
  const stored = await env.AUTH_KV.get(CATALOG_KEY, { type: 'json' });
  return stored || JSON.parse(JSON.stringify(DEFAULT_CATALOG));
}

export async function saveCatalog(env, catalog) {
  await env.AUTH_KV.put(CATALOG_KEY, JSON.stringify(catalog));
}

export function isAdmin(email, env) {
  return !!env.ADMIN_EMAILS && String(env.ADMIN_EMAILS).split(/[\s,;]+/)
    .map(e => e.trim().toLowerCase()).includes(email);
}

export function newId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return prefix + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Versión para el navegador: cada documento lleva la dirección desde la que se abre
export function toClient(catalog) {
  return {
    rev: catalog.rev,
    jefes: catalog.jefes,
    categorias: catalog.categorias.map(c => ({
      id: c.id,
      nombre: c.nombre,
      docs: c.docs.map(d => ({
        id: d.id, titulo: d.titulo, descripcion: d.descripcion || '', periodo: d.periodo || '',
        addedAt: d.addedAt || null, subido: !!d.kv,
        url: d.kv ? `/api/file/${d.id}` : `/${d.path}`,
      })),
    })),
  };
}

function text(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Aplica una edición del administrador (orden, títulos, secciones, jefes) sobre el catálogo actual.
// Solo se aceptan documentos que ya existen: los nuevos entran únicamente por la subida de archivos.
// Devuelve el catálogo nuevo y los documentos que dejaron de figurar.
export function applyEdit(current, input) {
  const existing = new Map();
  current.categorias.forEach(c => c.docs.forEach(d => existing.set(d.id, d)));

  const seenDocs = new Set();
  const seenCats = new Set();
  const categorias = (Array.isArray(input.categorias) ? input.categorias : []).slice(0, 40).map(c => {
    const nombre = text(c && c.nombre, 80);
    if (!nombre) throw new Error('seccion-vacia');
    let id = String((c && c.id) || '');
    if (!/^[\w-]{1,40}$/.test(id) || seenCats.has(id)) id = newId('c');
    seenCats.add(id);
    const docs = (Array.isArray(c.docs) ? c.docs : []).map(d => {
      const old = d && existing.get(d.id);
      if (!old || seenDocs.has(old.id)) return null;
      seenDocs.add(old.id);
      return {
        ...old,
        titulo: text(d.titulo, 160) || old.titulo,
        descripcion: text(d.descripcion, 300),
        periodo: text(d.periodo, 40),
      };
    }).filter(Boolean);
    return { id, nombre, docs };
  });

  const jefes = (Array.isArray(input.jefes) ? input.jefes : current.jefes).slice(0, 80)
    .map(j => ({ servicio: text(j && j.servicio, 80), nombre: text(j && j.nombre, 120) }))
    .filter(j => j.servicio || j.nombre);

  const removed = [...existing.values()].filter(d => !seenDocs.has(d.id));
  return { catalog: { rev: current.rev + 1, categorias, jefes }, removed };
}
