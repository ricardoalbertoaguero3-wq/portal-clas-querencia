/* =====================================================================
 * API — Gestión de Inventario CLAS Agregado La Querencia
 * Plataforma: Cloudflare Workers (Hono) + D1 (SQL) + R2 (archivos)
 *
 * Principios:
 *  - El servidor valida todo con las mismas reglas de core.js que usa el
 *    navegador (Directiva N° 0006-2021-EF/54.01 y D.S. N° 017-2008-SA).
 *  - Cada operación se guarda en una sola transacción (batch de D1) junto
 *    con su registro de bitácora.
 *  - Concurrencia optimista: si otro usuario modificó un bien, se rechaza.
 * ===================================================================== */
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import Core from '../js/core.js';
import { ITERACIONES, nuevaSal, derivarClave, igualesSeguro, sha256Hex, validarClave } from './seguridad.js';

const VERSION = '2.0.0';
const COOKIE = 'gi_sesion';
const DURACION_SESION = 8 * 3600;           // 8 horas
const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;
const MAX_ADJUNTO = 10 * 1024 * 1024;

const OCP = ['ADMIN', 'PATRIMONIO'];
const INV = ['ADMIN', 'PATRIMONIO', 'COMISION'];
const ADM = ['ADMIN'];
const ROLES = ['ADMIN', 'PATRIMONIO', 'COMISION', 'CONSULTA'];

const CONFIG_DEFECTO = {
  entidad: 'CLAS AGREGADO LA QUERENCIA', sigla: 'CLAS LA QUERENCIA', establecimiento: 'CENTRO DE SALUD CLAS QUERENCIA', direccion: '',
  ubigeo: 'Huaral — Huaral — Lima', red: 'Red de Salud Huaral – Chancay / DIRESA Lima', ruc: '', jefe: '', presidente_cd: '',
  oga_nombre: 'Oficina de Administración de la Unidad Ejecutora', oga_responsable: '', responsable_patrimonio: '', responsable_patrimonio_dni: '',
  responsable_contabilidad: '', plan_mantenimiento: '', plan_aseguramiento: '', uit: 5350, uit_anio: 2025
};
const CAMPOS_INVENTARIO = { plan_fecha: 'ABIERTO', plan_comunicacion: 'ABIERTO', tipo_verificacion: 'ABIERTO', conciliacion: 'ABIERTO', informe: 'ABIERTO', oficio: '*', presentado: '*' };

class Rechazo extends Error {
  constructor(estado, errores, extra) { super(errores.join(' ')); this.estado = estado; this.errores = errores; this.extra = extra || {}; }
}
const ahora = () => new Date().toISOString();
const json = JSON.stringify;
const leer = (fila) => (fila ? JSON.parse(fila.datos) : null);

// ---------------------------------------------------------------
// Acceso a datos
// ---------------------------------------------------------------
const sqlBitacora = (db, usuario, accion, detalle, ip) =>
  db.prepare('INSERT INTO bitacora (fecha, usuario, accion, detalle, ip) VALUES (?, ?, ?, ?, ?)').bind(ahora(), usuario || 'sistema', accion, String(detalle || '').slice(0, 2000), ip || null);

/** Guardia de concurrencia: aborta la transacción si alguna versión cambió */
const sqlGuardia = (db, versiones) => db.prepare(`INSERT INTO control_concurrencia (ok)
  SELECT (SELECT COUNT(*) FROM bienes b JOIN json_each(?1) j ON b.codigo = json_extract(j.value, '$[0]') AND b.version = json_extract(j.value, '$[1]')) = ?2`)
  .bind(json(versiones), versiones.length);
const sqlFinGuardia = (db) => db.prepare('DELETE FROM control_concurrencia');

const sqlInsertarBien = (db, b) => db.prepare(`INSERT INTO bienes (codigo, descripcion, situacion, estado, ubicacion, responsable, origen, valor, datos, version, actualizado)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).bind(b.codigo, b.descripcion, b.situacion, b.estado, b.ubicacion || '', b.responsable || '', b.origen || '', Number(b.valor) || 0, json(b), ahora());
const sqlActualizarBien = (db, b) => db.prepare(`UPDATE bienes SET descripcion = ?, situacion = ?, estado = ?, ubicacion = ?, responsable = ?, origen = ?, valor = ?, datos = ?,
  version = version + 1, actualizado = ? WHERE codigo = ?`).bind(b.descripcion, b.situacion, b.estado, b.ubicacion || '', b.responsable || '', b.origen || '', Number(b.valor) || 0, json(b), ahora(), b.codigo);

async function bienesPorCodigos(db, codigos) {
  if (!codigos.length) return { mapa: {}, versiones: {} };
  const { results } = await db.prepare('SELECT datos, version FROM bienes WHERE codigo IN (SELECT value FROM json_each(?))').bind(json(codigos)).all();
  const mapa = {}; const versiones = {};
  results.forEach((r) => { const b = JSON.parse(r.datos); mapa[b.codigo] = b; versiones[b.codigo] = r.version; });
  return { mapa, versiones };
}
async function configuracion(db) {
  const { results } = await db.prepare('SELECT clave, valor FROM config').all();
  const c = Object.assign({}, CONFIG_DEFECTO);
  results.forEach((r) => { c[r.clave] = JSON.parse(r.valor); });
  return c;
}
/** Ejecuta un batch; traduce los errores de restricción a mensajes de negocio */
async function transaccion(db, sentencias) {
  try { return await db.batch(sentencias); } catch (e) {
    const m = String(e.message || e);
    if (m.includes('control_concurrencia') || m.includes('CHECK constraint failed')) throw new Rechazo(409, ['Otro usuario modificó estos bienes mientras usted trabajaba. Recargue la página y vuelva a intentarlo.']);
    if (m.includes('UNIQUE constraint failed: movimientos.numero')) throw new Rechazo(409, ['__NUMERO_DUPLICADO__']);
    if (m.includes('UNIQUE constraint failed: bienes.codigo')) throw new Rechazo(400, ['El código patrimonial ya existe (art. 20.3).']);
    if (m.includes('UNIQUE constraint failed: personal.dni')) throw new Rechazo(400, ['Ya existe un usuario con ese DNI.']);
    if (m.includes('UNIQUE constraint failed')) throw new Rechazo(400, ['El registro ya existe.']);
    throw e;
  }
}

/** Registra un acto validándolo con core.js. extras(numero) devuelve sentencias adicionales para la misma transacción. */
async function registrarActo(c, movEntrada, extras) {
  const db = c.env.DB; const u = c.get('usuario');
  const cfg = await configuracion(db);
  const codigos = movEntrada.tipo === 'ALTA' ? (movEntrada.nuevos || []).map((n) => Core.limpiar(n.codigo)) : (movEntrada.items || []);
  // El correlativo se calcula sin saltos; si otro usuario lo toma al mismo tiempo, se reintenta con espera aleatoria
  for (let intento = 0; intento < 10; intento++) {
    if (intento) await new Promise((ok) => setTimeout(ok, 20 + Math.random() * 60 * intento));
    const { mapa, versiones } = await bienesPorCodigos(db, codigos);
    const anio = String(movEntrada.fecha || '').slice(0, 4);
    const pref = (Core.TIPOS_MOVIMIENTO[movEntrada.tipo] || {}).prefijo;
    const { results: nums } = pref ? await db.prepare('SELECT numero FROM movimientos WHERE numero LIKE ?').bind(`${pref}-${anio}-%`).all() : { results: [] };
    const p = Core.prepararRegistro(movEntrada, { bienesPorCodigo: mapa, numeros: nums.map((r) => r.numero), usuario: u.usuario, ahora: ahora(), hoy: Core.hoyEnLima(), establecimiento: cfg.establecimiento });
    if (p.errores) throw new Rechazo(400, p.errores);
    const m = p.mov;
    const st = [];
    const guardados = Object.keys(mapa).map((k) => [k, versiones[k]]);
    if (guardados.length) st.push(sqlGuardia(db, guardados));
    p.bienes.forEach((b) => st.push(mapa[b.codigo] ? sqlActualizarBien(db, b) : sqlInsertarBien(db, b)));
    st.push(db.prepare('INSERT INTO movimientos (numero, tipo, fecha, registrado, usuario, anulado, datos) VALUES (?, ?, ?, ?, ?, 0, ?)').bind(m.numero, m.tipo, m.fecha, m.registrado, m.usuario, json(m)));
    m.items.forEach((cod) => st.push(db.prepare('INSERT INTO movimiento_bienes (numero, codigo) VALUES (?, ?)').bind(m.numero, cod)));
    (extras ? extras(m.numero) : []).forEach((s) => st.push(s));
    st.push(sqlBitacora(db, u.usuario, 'ACTO_' + m.tipo, `${m.numero}: ${m.items.length} bien(es) — ${m.items.slice(0, 20).join(', ')}`, c.get('ip')));
    if (guardados.length) st.push(sqlFinGuardia(db));
    try { await transaccion(db, st); return m.numero; } catch (e) {
      if (e instanceof Rechazo && e.errores[0] === '__NUMERO_DUPLICADO__') continue; // otro usuario tomó el correlativo: reintentar
      throw e;
    }
  }
  throw new Rechazo(409, ['No se pudo asignar el número correlativo. Intente nuevamente.']);
}

// ---------------------------------------------------------------
// Aplicación
// ---------------------------------------------------------------
const app = new Hono().basePath('/api');

app.use('*', async (c, next) => {
  c.set('ip', c.req.header('CF-Connecting-IP') || '');
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'same-origin');
});

// Solo se aceptan peticiones del mismo origen (protección CSRF adicional a SameSite=Strict)
app.use('*', async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origen = c.req.header('Origin');
    if (origen && origen !== new URL(c.req.url).origin) return c.json({ errores: ['Origen no permitido.'] }, 403);
  }
  await next();
});

app.onError((e, c) => {
  if (e instanceof Rechazo) return c.json(Object.assign({ errores: e.errores }, e.extra), e.estado);
  console.error(e);
  return c.json({ errores: ['Error interno del servidor. Si persiste, comuníquelo al administrador.'] }, 500);
});

app.get('/salud', (c) => c.json({ ok: true, version: VERSION }));

// ---------------- Sesión ----------------
const publico = (u) => ({ usuario: u.usuario, nombre: u.nombre, rol: u.rol, debeCambiar: !!u.debe_cambiar, activo: !!u.activo });

async function emitirSesion(c, u) {
  const token = await sign({ sub: u.usuario, sv: u.version_sesion, exp: Math.floor(Date.now() / 1000) + DURACION_SESION }, c.env.JWT_SECRETO, 'HS256');
  setCookie(c, COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: DURACION_SESION });
}

app.post('/sesion', async (c) => {
  const db = c.env.DB;
  const { usuario, clave } = await c.req.json().catch(() => ({}));
  const nombreUsuario = Core.limpiar(usuario).toLowerCase();
  // Instalación: el primer administrador se crea con la clave temporal ADMIN_INICIAL (secreto)
  const total = await db.prepare('SELECT COUNT(*) AS n FROM usuarios').first('n');
  if (total === 0 && nombreUsuario === 'admin' && c.env.ADMIN_INICIAL && igualesSeguro(String(clave || ''), c.env.ADMIN_INICIAL)) {
    const sal = nuevaSal();
    await db.batch([
      db.prepare('INSERT INTO usuarios (usuario, nombre, rol, hash, sal, iteraciones, debe_cambiar, activo, creado) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)')
        .bind('admin', 'Administrador del sistema', 'ADMIN', await derivarClave(clave, sal), sal, ITERACIONES, ahora()),
      sqlBitacora(db, 'sistema', 'INSTALACION', 'Usuario admin creado con clave temporal; cambio obligatorio.', c.get('ip'))
    ]);
  }
  const u = await db.prepare('SELECT * FROM usuarios WHERE usuario = ?').bind(nombreUsuario).first();
  const fallo = async (msg) => {
    if (u) {
      const intentos = u.intentos_fallidos + 1;
      const bloqueo = intentos >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MIN * 60000).toISOString() : null;
      await db.batch([db.prepare('UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE usuario = ?').bind(bloqueo ? 0 : intentos, bloqueo, u.usuario),
        sqlBitacora(db, nombreUsuario, 'LOGIN_FALLIDO', bloqueo ? `Cuenta bloqueada ${BLOQUEO_MIN} min` : `Intento ${intentos}`, c.get('ip'))]);
    } else await sqlBitacora(db, nombreUsuario || '(vacío)', 'LOGIN_FALLIDO', 'Usuario inexistente', c.get('ip')).run();
    return c.json({ errores: [msg] }, 401);
  };
  if (u && u.bloqueado_hasta && u.bloqueado_hasta > ahora()) return c.json({ errores: [`Cuenta bloqueada temporalmente por intentos fallidos. Intente después de ${BLOQUEO_MIN} minutos.`] }, 429);
  if (!u || !u.activo) return fallo('Usuario o clave incorrectos.');
  if (!igualesSeguro(await derivarClave(String(clave || ''), u.sal, u.iteraciones), u.hash)) return fallo('Usuario o clave incorrectos.');
  await db.batch([db.prepare('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE usuario = ?').bind(u.usuario), sqlBitacora(db, u.usuario, 'LOGIN', '', c.get('ip'))]);
  await emitirSesion(c, u);
  return c.json({ usuario: publico(u) });
});

// Autenticación para el resto de rutas
app.use('*', async (c, next) => {
  const p = c.req.path;
  if (p === '/api/salud' || (p === '/api/sesion' && c.req.method === 'POST')) return next();
  const token = getCookie(c, COOKIE);
  let datos = null;
  if (token) { try { datos = await verify(token, c.env.JWT_SECRETO, 'HS256'); } catch (e) { datos = null; } }
  const u = datos && await c.env.DB.prepare('SELECT * FROM usuarios WHERE usuario = ?').bind(datos.sub).first();
  if (!u || !u.activo || u.version_sesion !== datos.sv) { deleteCookie(c, COOKIE, { path: '/' }); return c.json({ errores: ['Sesión no válida o expirada.'] }, 401); }
  // Con clave temporal solo se permite consultar la sesión y cambiar la clave
  if (u.debe_cambiar && !p.startsWith('/api/sesion')) return c.json({ errores: ['Debe cambiar su clave temporal.'] }, 403);
  c.set('usuario', u);
  await next();
});
const exigir = (c, roles) => { if (!roles.includes(c.get('usuario').rol)) throw new Rechazo(403, ['Acción no permitida para su rol.']); };

app.get('/sesion', (c) => c.json({ usuario: publico(c.get('usuario')) }));
app.delete('/sesion', async (c) => {
  await sqlBitacora(c.env.DB, c.get('usuario').usuario, 'LOGOUT', '', c.get('ip')).run();
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});
app.post('/sesion/clave', async (c) => {
  const u = c.get('usuario'); const { clave } = await c.req.json();
  const err = validarClave(clave, u.usuario); if (err) throw new Rechazo(400, [err]);
  const sal = nuevaSal();
  await c.env.DB.batch([c.env.DB.prepare('UPDATE usuarios SET hash = ?, sal = ?, iteraciones = ?, debe_cambiar = 0, version_sesion = version_sesion + 1 WHERE usuario = ?')
    .bind(await derivarClave(clave, sal), sal, ITERACIONES, u.usuario), sqlBitacora(c.env.DB, u.usuario, 'CAMBIO_CLAVE', '', c.get('ip'))]);
  await emitirSesion(c, Object.assign({}, u, { version_sesion: u.version_sesion + 1 }));
  return c.json({ ok: true });
});

// ---------------- Estado completo (datos de trabajo) ----------------
app.get('/estado', async (c) => {
  const db = c.env.DB;
  const [b, m, p, ub, inv, adj] = await db.batch([
    db.prepare('SELECT datos FROM bienes'), db.prepare('SELECT datos FROM movimientos'), db.prepare('SELECT datos FROM personal'),
    db.prepare('SELECT nombre, piso, activo FROM ubicaciones'), db.prepare('SELECT datos FROM inventarios'),
    db.prepare('SELECT id, numero, nombre, descripcion, tipo, tamano, subido_por, fecha FROM adjuntos')
  ]);
  return c.json({
    config: await configuracion(db), bienes: b.results.map(leer), movimientos: m.results.map(leer), personal: p.results.map(leer),
    ubicaciones: ub.results.map((r) => ({ nombre: r.nombre, piso: r.piso || '', activo: !!r.activo })), inventarios: inv.results.map(leer), adjuntos: adj.results
  });
});

// ---------------- Actos ----------------
app.post('/movimientos', async (c) => {
  exigir(c, OCP);
  const { mov, sobranteRef } = await c.req.json();
  if (!mov || mov.tipo === 'INVENTARIO') throw new Rechazo(400, ['Acto no permitido.']);
  const db = c.env.DB;
  let extras;
  if (sobranteRef && mov.tipo === 'ALTA') { // saneamiento de sobrante (art. 41): vincular el alta con el sobrante
    const [id, i] = String(sobranteRef).split(':');
    if (/^\d+$/.test(i)) extras = (numero) => [db.prepare(`UPDATE inventarios SET datos = json_set(datos, '$.sobrantes[${Number(i)}].alta', ?) WHERE id = ?`).bind(numero, id)];
  }
  return c.json({ numero: await registrarActo(c, mov, extras) });
});

app.post('/movimientos/:numero/anular', async (c) => {
  exigir(c, ADM);
  const db = c.env.DB; const u = c.get('usuario'); const numero = c.req.param('numero');
  const { motivo, documento } = await c.req.json();
  const m = leer(await db.prepare('SELECT datos FROM movimientos WHERE numero = ?').bind(numero).first());
  if (!m) throw new Rechazo(404, ['Acto no encontrado.']);
  const { mapa, versiones } = await bienesPorCodigos(db, m.detalle.map((d) => d.codigo));
  const p = Core.prepararAnulacion(m, mapa, { usuario: u.usuario, motivo, documento, ahora: ahora(), hoy: Core.hoyEnLima() });
  if (p.errores) throw new Rechazo(400, p.errores);
  if (p.bloqueados) throw new Rechazo(409, ['Hay bienes con actos posteriores: anule primero los actos más recientes o registre un acto correctivo.'], { bloqueados: p.bloqueados.map((d) => d.codigo) });
  const guardados = Object.keys(mapa).map((k) => [k, versiones[k]]);
  const st = [sqlGuardia(db, guardados)];
  p.bienes.forEach((x) => st.push(x.borrar ? db.prepare('DELETE FROM bienes WHERE codigo = ?').bind(x.codigo) : sqlActualizarBien(db, x.valor)));
  st.push(db.prepare('UPDATE movimientos SET anulado = 1, datos = ? WHERE numero = ? AND anulado = 0').bind(json(p.mov), numero));
  st.push(sqlBitacora(db, u.usuario, 'ANULACION', `${numero}: ${p.mov.anulado.motivo} ${p.mov.anulado.documento}`, c.get('ip')), sqlFinGuardia(db));
  await transaccion(db, st);
  return c.json({ ok: true });
});

// ---------------- Adjuntos (documentos firmados en R2) ----------------
const FIRMAS = { 'application/pdf': [0x25, 0x50, 0x44, 0x46], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47] };
app.post('/movimientos/:numero/adjuntos', async (c) => {
  exigir(c, OCP);
  const db = c.env.DB; const u = c.get('usuario'); const numero = c.req.param('numero');
  if (!await db.prepare('SELECT 1 FROM movimientos WHERE numero = ?').bind(numero).first()) throw new Rechazo(404, ['Acto no encontrado.']);
  const form = await c.req.formData(); const f = form.get('archivo');
  if (!f || typeof f === 'string') throw new Rechazo(400, ['Adjunte un archivo.']);
  if (f.size > MAX_ADJUNTO) throw new Rechazo(400, ['El archivo supera los 10 MB.']);
  const buf = await f.arrayBuffer(); const cab = new Uint8Array(buf.slice(0, 4));
  const tipo = Object.keys(FIRMAS).find((t) => FIRMAS[t].every((x, i) => cab[i] === x));
  if (!tipo) throw new Rechazo(400, ['Solo se aceptan archivos PDF, JPG o PNG.']);
  const id = crypto.randomUUID(); const clave = `adjuntos/${numero}/${id}`;
  const nombre = Core.limpiar(f.name).replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, '_').slice(0, 120) || 'documento';
  await c.env.ARCHIVOS.put(clave, buf, { httpMetadata: { contentType: tipo } });
  await db.batch([db.prepare('INSERT INTO adjuntos (id, numero, nombre, descripcion, tipo, tamano, r2_key, sha256, subido_por, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, numero, nombre, Core.limpiar(form.get('descripcion')).slice(0, 200), tipo, f.size, clave, await sha256Hex(buf), u.usuario, ahora()),
  sqlBitacora(db, u.usuario, 'ADJUNTO', `${numero}: ${nombre} (${f.size} bytes)`, c.get('ip'))]);
  return c.json({ id });
});
app.get('/adjuntos/:id', async (c) => {
  const a = await c.env.DB.prepare('SELECT * FROM adjuntos WHERE id = ?').bind(c.req.param('id')).first();
  if (!a) throw new Rechazo(404, ['Documento no encontrado.']);
  const obj = await c.env.ARCHIVOS.get(a.r2_key);
  if (!obj) throw new Rechazo(404, ['Documento no disponible.']);
  return new Response(obj.body, { headers: { 'Content-Type': a.tipo, 'Content-Disposition': `inline; filename="${encodeURIComponent(a.nombre)}"`,
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } });
});

// ---------------- Bienes ----------------
app.put('/bienes/:codigo', async (c) => {
  exigir(c, OCP);
  const db = c.env.DB; const u = c.get('usuario'); const codigo = c.req.param('codigo');
  const { cambios, motivo, resolucion } = await c.req.json();
  const { mapa, versiones } = await bienesPorCodigos(db, [codigo]);
  if (!mapa[codigo]) throw new Rechazo(404, ['Bien no encontrado.']);
  const p = Core.prepararCorreccion(mapa[codigo], cambios || {}, { motivo, resolucion, ahora: ahora() });
  if (p.errores) throw new Rechazo(400, p.errores);
  if (!p.cambios.length) return c.json({ ok: true });
  await transaccion(db, [sqlGuardia(db, [[codigo, versiones[codigo]]]), sqlActualizarBien(db, p.bien),
    sqlBitacora(db, u.usuario, 'CORRECCION_REGISTRO', `${codigo} — ${Core.limpiar(motivo)} — ${p.cambios.join('; ')}`, c.get('ip')), sqlFinGuardia(db)]);
  return c.json({ ok: true });
});

app.post('/bienes/carga', async (c) => {
  exigir(c, ADM);
  const db = c.env.DB; const u = c.get('usuario');
  const { filas, fuente } = await c.req.json();
  if (!Array.isArray(filas) || filas.length > 20000) throw new Rechazo(400, ['Archivo no válido.']);
  const { results: cods } = await db.prepare('SELECT codigo FROM bienes').all();
  const { results: ubs } = await db.prepare('SELECT nombre FROM ubicaciones').all();
  const p = Core.prepararCargaInicial(filas, cods.map((r) => r.codigo), ubs.map((r) => r.nombre), { fuente: Core.limpiar(fuente).slice(0, 120), ahora: ahora() });
  const st = p.bienes.map((b) => sqlInsertarBien(db, b)).concat(p.ubicaciones.map((x) => db.prepare('INSERT INTO ubicaciones (nombre, piso, activo) VALUES (?, ?, 1)').bind(x.nombre, '')));
  st.push(sqlBitacora(db, u.usuario, 'CARGA_INICIAL', `${p.bienes.length} bienes desde ${fuente}; ${p.omitidos} omitidos (código inválido o duplicado).`, c.get('ip')));
  await transaccion(db, st);
  return c.json({ cargados: p.bienes.length, omitidos: p.omitidos });
});

// ---------------- Usuarios de bienes y ubicaciones ----------------
app.put('/personal', async (c) => {
  exigir(c, OCP);
  const db = c.env.DB; const u = c.get('usuario'); const o = await c.req.json();
  const dni = Core.limpiar(o.dni); const nombres = Core.limpiar(o.nombres).toUpperCase();
  if (!/^\d{8}$/.test(dni) || !nombres) throw new Rechazo(400, ['Registre apellidos y nombres y un DNI de 8 dígitos.']);
  const previo = o.id ? leer(await db.prepare('SELECT datos FROM personal WHERE id = ?').bind(o.id).first()) : null;
  if (o.id && !previo) throw new Rechazo(404, ['Usuario no encontrado.']);
  const activo = o.activo !== false;
  if (previo && !activo) {
    const n = await db.prepare("SELECT COUNT(*) AS n FROM bienes WHERE responsable = ? AND situacion NOT IN ('DISPUESTO', 'BAJA')").bind(o.id).first('n');
    if (n) throw new Rechazo(400, ['El usuario aún tiene bienes asignados. Registre primero la devolución.']);
  }
  const campos = ['correo', 'unidad', 'cargo', 'local', 'direccion', 'condicion'];
  const p = { id: previo ? previo.id : 'P' + crypto.randomUUID().slice(0, 8), nombres, dni, activo };
  campos.forEach((k) => { p[k] = Core.limpiar(o[k]).slice(0, 200); });
  await transaccion(db, [db.prepare('INSERT INTO personal (id, dni, nombres, activo, datos) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET dni = excluded.dni, nombres = excluded.nombres, activo = excluded.activo, datos = excluded.datos')
    .bind(p.id, dni, nombres, activo ? 1 : 0, json(p)), sqlBitacora(db, u.usuario, previo ? 'EDICION_USUARIO_BIENES' : 'ALTA_USUARIO_BIENES', `${dni} ${nombres}`, c.get('ip'))]);
  return c.json({ persona: p });
});

app.put('/ubicaciones', async (c) => {
  exigir(c, OCP);
  const db = c.env.DB; const u = c.get('usuario'); const { ubicacion, nueva } = await c.req.json();
  const nombre = Core.limpiar(ubicacion && ubicacion.nombre).toUpperCase();
  if (!nombre) throw new Rechazo(400, ['Indique el nombre de la ubicación.']);
  const sql = nueva ? 'INSERT INTO ubicaciones (piso, activo, nombre) VALUES (?, ?, ?)' : 'UPDATE ubicaciones SET piso = ?, activo = ? WHERE nombre = ?';
  if (nueva && await db.prepare('SELECT 1 FROM ubicaciones WHERE nombre = ?').bind(nombre).first()) throw new Rechazo(400, ['La ubicación ya existe.']);
  await transaccion(db, [db.prepare(sql).bind(Core.limpiar(ubicacion.piso), ubicacion.activo === false ? 0 : 1, nombre),
    sqlBitacora(db, u.usuario, nueva ? 'ALTA_UBICACION' : 'EDICION_UBICACION', nombre, c.get('ip'))]);
  return c.json({ ok: true });
});

// ---------------- Inventario y supervisión ----------------
async function inventarioAbierto(db, id) {
  const fila = await db.prepare('SELECT datos FROM inventarios WHERE id = ?').bind(id).first();
  if (!fila) throw new Rechazo(404, ['Proceso no encontrado.']);
  return leer(fila);
}

app.post('/inventarios', async (c) => {
  exigir(c, INV);
  const db = c.env.DB; const u = c.get('usuario'); const d = await c.req.json();
  const tipo = d.tipo === 'SUPERVISION' ? 'SUPERVISION' : 'ANUAL';
  const anio = Number(d.anio); const com = d.comision || {};
  if (!(anio >= 2000 && anio <= 2100) || !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha_corte || '')) throw new Rechazo(400, ['Indique el año y la fecha de corte.']);
  if (tipo === 'ANUAL' && (!Core.limpiar(d.resolucion) || !Core.limpiar(com.presidente) || !Core.limpiar(com.contabilidad) || !Core.limpiar(com.abastecimiento))) {
    throw new Rechazo(400, ['El inventario anual requiere la resolución de designación y los tres representantes mínimos de la Comisión (art. 32.1).']);
  }
  if (await db.prepare("SELECT 1 FROM inventarios WHERE estado = 'ABIERTO'").first()) throw new Rechazo(400, ['Ya hay un proceso abierto.']);
  const pref = tipo === 'ANUAL' ? 'INVENT' : 'SUPERV';
  const n = await db.prepare('SELECT COUNT(*) AS n FROM inventarios WHERE id LIKE ?').bind(`${pref}-${anio}-%`).first('n');
  const inv = { id: `${pref}-${anio}-${String(n + 1).padStart(2, '0')}`, tipo, anio, fecha_corte: d.fecha_corte, resolucion: Core.limpiar(d.resolucion), equipo: Core.limpiar(d.equipo),
    comision: { presidente: Core.limpiar(com.presidente), contabilidad: Core.limpiar(com.contabilidad), abastecimiento: Core.limpiar(com.abastecimiento) },
    estado: 'ABIERTO', tipo_verificacion: 'F', verif: {}, sobrantes: [], conciliacion: {}, informe: {}, creado: ahora() };
  await transaccion(db, [db.prepare('INSERT INTO inventarios (id, tipo, anio, estado, datos) VALUES (?, ?, ?, ?, ?)').bind(inv.id, tipo, anio, 'ABIERTO', json(inv)),
    sqlBitacora(db, u.usuario, 'INVENTARIO_INICIO', `${inv.id} — ${inv.resolucion}`, c.get('ip'))]);
  return c.json({ inventario: inv });
});

/** Verificación de campo: se fusiona bien por bien (dos inventariadores pueden trabajar a la vez) */
app.patch('/inventarios/:id/verificacion', async (c) => {
  exigir(c, INV);
  const db = c.env.DB; const u = c.get('usuario'); const id = c.req.param('id'); const mapa = await c.req.json();
  const inv = await inventarioAbierto(db, id);
  if (inv.estado !== 'ABIERTO') throw new Rechazo(400, ['El proceso está cerrado.']);
  const st = Object.entries(mapa).map(([codigo, v]) => {
    if (!/^\d{12}$/.test(codigo)) throw new Rechazo(400, ['Código patrimonial no válido.']);
    if (!v) return db.prepare(`UPDATE inventarios SET datos = json_remove(datos, '$.verif."${codigo}"') WHERE id = ? AND estado = 'ABIERTO'`).bind(id);
    const x = { encontrado: !!v.encontrado, obs: Core.limpiar(v.obs).slice(0, 300), fecha: Core.hoyEnLima(), usuario: u.usuario };
    if (x.encontrado) {
      if (!Core.ESTADOS_CONSERVACION.includes(v.estado)) throw new Rechazo(400, ['Estado de conservación no válido.']);
      Object.assign(x, { uso: v.uso === 'D' ? 'D' : 'U', estado: v.estado, ubicacion: Core.limpiar(v.ubicacion), responsable: Core.limpiar(v.responsable), tipo: v.tipo === 'D' ? 'D' : 'F' });
    }
    return db.prepare(`UPDATE inventarios SET datos = json_set(datos, '$.verif."${codigo}"', json(?)) WHERE id = ? AND estado = 'ABIERTO'`).bind(json(x), id);
  });
  if (st.length) await transaccion(db, st);
  return c.json({ ok: true });
});

app.post('/inventarios/:id/sobrantes', async (c) => {
  exigir(c, INV);
  const db = c.env.DB; const u = c.get('usuario'); const id = c.req.param('id'); const s = await c.req.json();
  const inv = await inventarioAbierto(db, id);
  if (inv.estado !== 'ABIERTO') throw new Rechazo(400, ['El proceso está cerrado.']);
  const o = {};
  ['descripcion', 'marca', 'serie', 'estado', 'ubicacion', 'fecha_posesion', 'origen', 'obs'].forEach((k) => { o[k] = Core.limpiar(s[k]).slice(0, 200); });
  o.descripcion = o.descripcion.toUpperCase();
  if (!o.descripcion) throw new Rechazo(400, ['Indique la denominación del sobrante.']);
  await transaccion(db, [db.prepare("UPDATE inventarios SET datos = json_insert(datos, '$.sobrantes[#]', json(?)) WHERE id = ?").bind(json(o), id),
    sqlBitacora(db, u.usuario, 'INVENTARIO_SOBRANTE', `${id} ${o.descripcion}`, c.get('ip'))]);
  return c.json({ ok: true });
});

app.patch('/inventarios/:id', async (c) => {
  exigir(c, INV);
  const db = c.env.DB; const u = c.get('usuario'); const id = c.req.param('id'); const campos = await c.req.json();
  const inv = await inventarioAbierto(db, id);
  const st = [];
  Object.entries(campos).forEach(([k, v]) => {
    if (!CAMPOS_INVENTARIO[k]) throw new Rechazo(400, [`Campo no modificable: ${k}.`]);
    if (CAMPOS_INVENTARIO[k] === 'ABIERTO' && inv.estado !== 'ABIERTO') throw new Rechazo(400, ['El proceso está cerrado.']);
    st.push(db.prepare(`UPDATE inventarios SET datos = json_set(datos, '$.${k}', json(?)) WHERE id = ?`).bind(json(v), id));
  });
  st.push(sqlBitacora(db, u.usuario, 'INVENTARIO_ACTUALIZACION', `${id}: ${Object.keys(campos).join(', ')}`, c.get('ip')));
  await transaccion(db, st);
  return c.json({ ok: true });
});

app.post('/inventarios/:id/cerrar', async (c) => {
  exigir(c, INV);
  const db = c.env.DB; const u = c.get('usuario'); const id = c.req.param('id');
  const inv = await inventarioAbierto(db, id);
  const { results } = await db.prepare('SELECT datos FROM bienes').all();
  const p = Core.prepararCierreInventario(inv, results.map(leer), { hoy: Core.hoyEnLima() });
  if (p.errores) throw new Rechazo(400, p.errores);
  const cierre = (numero) => [db.prepare(`UPDATE inventarios SET estado = 'CERRADO', datos = json_set(datos, '$.estado', 'CERRADO', '$.cerrado', ?, '$.resultados', json(?), '$.movimiento', ?)
    WHERE id = ? AND estado = 'ABIERTO'`).bind(p.cerrado, json(p.resultados), numero, id), sqlBitacora(db, u.usuario, 'INVENTARIO_CIERRE', id, c.get('ip'))];
  let numero = null;
  if (p.mov) numero = await registrarActo(c, p.mov, cierre);
  else await transaccion(db, cierre(null));
  return c.json({ movimiento: numero });
});

// ---------------- Configuración, usuarios del sistema, bitácora, respaldo ----------------
app.put('/config', async (c) => {
  exigir(c, ADM);
  const db = c.env.DB; const u = c.get('usuario'); const cfg = await c.req.json();
  const st = Object.keys(CONFIG_DEFECTO).filter((k) => k in cfg).map((k) => db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor')
    .bind(k, json(typeof CONFIG_DEFECTO[k] === 'number' ? Number(cfg[k]) || 0 : Core.limpiar(cfg[k]).slice(0, 300))));
  st.push(sqlBitacora(db, u.usuario, 'CONFIGURACION', json(cfg).slice(0, 1500), c.get('ip')));
  await transaccion(db, st);
  return c.json({ ok: true });
});

app.get('/usuarios', async (c) => {
  exigir(c, ADM);
  const { results } = await c.env.DB.prepare('SELECT * FROM usuarios ORDER BY usuario').all();
  return c.json({ usuarios: results.map(publico) });
});
app.post('/usuarios', async (c) => {
  exigir(c, ADM);
  const db = c.env.DB; const u = c.get('usuario'); const d = await c.req.json();
  const usuario = Core.limpiar(d.usuario).toLowerCase();
  if (!/^[a-z0-9._]{3,30}$/.test(usuario)) throw new Rechazo(400, ['Usuario no válido (3 a 30 caracteres: letras, números, punto o guion bajo).']);
  if (!ROLES.includes(d.rol)) throw new Rechazo(400, ['Rol no válido.']);
  const err = validarClave(d.clave, usuario); if (err) throw new Rechazo(400, [err]);
  const sal = nuevaSal();
  await transaccion(db, [db.prepare('INSERT INTO usuarios (usuario, nombre, rol, hash, sal, iteraciones, debe_cambiar, activo, creado) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)')
    .bind(usuario, Core.limpiar(d.nombre).slice(0, 120) || usuario, d.rol, await derivarClave(d.clave, sal), sal, ITERACIONES, ahora()),
  sqlBitacora(db, u.usuario, 'ALTA_USUARIO_SISTEMA', `${usuario} (${d.rol})`, c.get('ip'))]);
  return c.json({ ok: true });
});
app.patch('/usuarios/:usuario', async (c) => {
  exigir(c, ADM);
  const db = c.env.DB; const u = c.get('usuario'); const objetivo = c.req.param('usuario'); const { activo } = await c.req.json();
  if (objetivo === u.usuario) throw new Rechazo(400, ['No puede desactivar su propio usuario.']);
  // al desactivar se invalidan sus sesiones abiertas
  await transaccion(db, [db.prepare('UPDATE usuarios SET activo = ?, version_sesion = version_sesion + 1, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE usuario = ?').bind(activo ? 1 : 0, objetivo),
    sqlBitacora(db, u.usuario, activo ? 'ACTIVA_USUARIO' : 'DESACTIVA_USUARIO', objetivo, c.get('ip'))]);
  return c.json({ ok: true });
});

app.get('/bitacora', async (c) => {
  exigir(c, ADM);
  const { results } = await c.env.DB.prepare('SELECT fecha, usuario, accion, detalle, ip FROM bitacora ORDER BY id DESC LIMIT 2000').all();
  return c.json({ registros: results });
});

async function exportar(db) {
  const tablas = ['config', 'bienes', 'movimientos', 'movimiento_bienes', 'personal', 'ubicaciones', 'inventarios', 'adjuntos', 'bitacora'];
  const res = await db.batch(tablas.map((t) => db.prepare(`SELECT * FROM ${t}`)));
  const out = { sistema: 'gestion_inventario_clas_querencia', modo: 'servidor', version: VERSION, exportado: ahora() };
  tablas.forEach((t, i) => { out[t] = res[i].results.map((r) => (r.datos ? JSON.parse(r.datos) : r)); });
  const { results: us } = await db.prepare('SELECT usuario, nombre, rol, activo, creado FROM usuarios').all();
  out.usuarios = us; // sin hashes de clave
  return out;
}
app.get('/respaldo', async (c) => {
  exigir(c, ADM);
  const d = await exportar(c.env.DB);
  await sqlBitacora(c.env.DB, c.get('usuario').usuario, 'RESPALDO', 'Respaldo descargado', c.get('ip')).run();
  return c.json(d);
});

app.all('*', (c) => c.json({ errores: ['Ruta no encontrada.'] }, 404));

// ---------------------------------------------------------------
// Respaldo automático semanal en R2 (Cron Trigger)
// ---------------------------------------------------------------
async function respaldoAutomatico(env) {
  const d = await exportar(env.DB);
  const clave = `respaldos/${Core.hoyEnLima()}.json`;
  await env.ARCHIVOS.put(clave, JSON.stringify(d), { httpMetadata: { contentType: 'application/json' } });
  // conserva las últimas 12 copias
  const lista = await env.ARCHIVOS.list({ prefix: 'respaldos/' });
  const viejos = lista.objects.map((o) => o.key).sort().slice(0, -12);
  if (viejos.length) await env.ARCHIVOS.delete(viejos);
  await sqlBitacora(env.DB, 'sistema', 'RESPALDO_AUTOMATICO', `${clave} (${d.bienes.length} bienes)`).run();
}

export default {
  fetch: app.fetch,
  scheduled(evento, env, ctx) { ctx.waitUntil(respaldoAutomatico(env)); }
};
