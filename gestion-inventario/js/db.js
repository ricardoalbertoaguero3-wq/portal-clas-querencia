/* =====================================================================
 * db.js — Persistencia local (IndexedDB), usuarios y bitácora de auditoría
 * ===================================================================== */
(function () {
  'use strict';
  const NOMBRE_BD = 'gestion_inventario_clas_querencia';
  const VERSION = 1;
  const STORES = {
    bienes: { keyPath: 'codigo' },
    movimientos: { keyPath: 'numero' },
    personal: { keyPath: 'id' },
    ubicaciones: { keyPath: 'nombre' },
    inventarios: { keyPath: 'id' },
    usuarios: { keyPath: 'usuario' },
    bitacora: { keyPath: 'id', autoIncrement: true },
    config: { keyPath: 'clave' }
  };

  let bd = null;

  function abrir() {
    return new Promise((ok, mal) => {
      const req = indexedDB.open(NOMBRE_BD, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        Object.entries(STORES).forEach(([n, o]) => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, o); });
      };
      req.onsuccess = () => { bd = req.result; ok(bd); };
      req.onerror = () => mal(req.error);
    });
  }

  const prom = (req) => new Promise((ok, mal) => { req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error); });

  const todos = (store) => prom(bd.transaction(store).objectStore(store).getAll());
  const obtener = (store, k) => prom(bd.transaction(store).objectStore(store).get(k));
  const contar = (store) => prom(bd.transaction(store).objectStore(store).count());

  /** Escribe varios registros en una sola transacción (todo o nada). */
  function escribir(operaciones) {
    const stores = [...new Set(operaciones.map((o) => o.store))];
    return new Promise((ok, mal) => {
      const tx = bd.transaction(stores, 'readwrite');
      operaciones.forEach((o) => {
        const s = tx.objectStore(o.store);
        if (o.borrar) s.delete(o.clave); else s.put(o.valor);
      });
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
      tx.onabort = () => mal(tx.error);
    });
  }
  const guardar = (store, valor) => escribir([{ store, valor }]);

  // ---------------- Configuración ----------------
  const CONFIG_DEFECTO = {
    entidad: 'CLAS AGREGADO LA QUERENCIA',
    sigla: 'CLAS LA QUERENCIA',
    establecimiento: 'CENTRO DE SALUD CLAS QUERENCIA',
    direccion: '',
    ubigeo: 'Huaral — Huaral — Lima',
    red: 'Red de Salud Huaral – Chancay / DIRESA Lima',
    ruc: '',
    jefe: '',
    oga_nombre: 'Oficina de Administración de la Unidad Ejecutora',
    oga_responsable: '',
    responsable_patrimonio: '',
    responsable_patrimonio_dni: '',
    responsable_contabilidad: '',
    plan_mantenimiento: '',
    plan_aseguramiento: '',
    uit: 5350,
    uit_anio: 2025
  };
  async function config() {
    const filas = await todos('config');
    const c = Object.assign({}, CONFIG_DEFECTO);
    filas.forEach((f) => { c[f.clave] = f.valor; });
    return c;
  }
  const guardarConfig = (c) => escribir(Object.entries(c).map(([clave, valor]) => ({ store: 'config', valor: { clave, valor } })));

  // ---------------- Seguridad ----------------
  async function hash(texto, sal) {
    const datos = new TextEncoder().encode(sal + '|' + texto);
    let buf = await crypto.subtle.digest('SHA-256', datos);
    for (let i = 0; i < 999; i++) buf = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  const nuevaSal = () => [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join('');

  async function crearUsuario(usuario, nombre, rol, clave, debeCambiar) {
    const sal = nuevaSal();
    await guardar('usuarios', { usuario, nombre, rol, sal, hash: await hash(clave, sal), debeCambiar: !!debeCambiar, activo: true });
  }
  async function verificarUsuario(usuario, clave) {
    const u = await obtener('usuarios', usuario);
    if (!u || !u.activo) return null;
    return (await hash(clave, u.sal)) === u.hash ? u : null;
  }
  async function cambiarClave(usuario, clave) {
    const u = await obtener('usuarios', usuario);
    u.sal = nuevaSal(); u.hash = await hash(clave, u.sal); u.debeCambiar = false;
    await guardar('usuarios', u);
  }

  // ---------------- Bitácora ----------------
  /** Registro de auditoría: solo se agrega, nunca se edita ni borra desde la app. */
  const opBitacora = (usuario, accion, detalle) => ({
    store: 'bitacora',
    valor: { fecha: new Date().toISOString(), usuario: usuario || 'sistema', accion, detalle: detalle || '' }
  });

  // ---------------- Inicialización ----------------
  async function inicializar() {
    await abrir();
    if ((await contar('usuarios')) === 0) {
      await crearUsuario('admin', 'Administrador del sistema', 'ADMIN', 'admin', true);
      await escribir([opBitacora('sistema', 'INICIALIZACION', 'Base de datos creada. Usuario admin con cambio de clave obligatorio.')]);
    }
  }

  /** Carga inicial del inventario 2025 a partir de filas del Excel institucional */
  async function cargarInventarioInicial(filas, usuario, fuente) {
    const ops = [];
    const ubic = new Set();
    let omitidos = 0;
    const existentes = new Set((await todos('bienes')).map((b) => b.codigo));
    filas.forEach((f) => {
      const b = Core.filaExcelABien(f);
      if (!Core.validarCodigoPatrimonial(b.codigo).ok || existentes.has(b.codigo)) { omitidos++; return; }
      existentes.add(b.codigo);
      b.creado = new Date().toISOString();
      b.carga_inicial = fuente;
      ops.push({ store: 'bienes', valor: b });
      ubic.add(b.ubicacion);
    });
    const ubicActuales = new Set((await todos('ubicaciones')).map((u) => u.nombre));
    ubic.forEach((n) => { if (!ubicActuales.has(n)) ops.push({ store: 'ubicaciones', valor: { nombre: n, piso: '', activo: true } }); });
    ops.push(opBitacora(usuario, 'CARGA_INICIAL', `${ops.length - ubic.size} bienes desde ${fuente}; ${omitidos} omitidos (código inválido o duplicado).`));
    await escribir(ops);
    return { cargados: ops.filter((o) => o.store === 'bienes').length, omitidos };
  }

  // ---------------- Respaldo ----------------
  async function exportarTodo() {
    const out = { sistema: NOMBRE_BD, version: VERSION, exportado: new Date().toISOString() };
    for (const s of Object.keys(STORES)) out[s] = await todos(s);
    return out;
  }
  async function restaurarTodo(datos, usuario) {
    if (datos.sistema !== NOMBRE_BD) throw new Error('El archivo no es un respaldo de este aplicativo.');
    const nombres = Object.keys(STORES);
    await new Promise((ok, mal) => {
      const tx = bd.transaction(nombres, 'readwrite');
      nombres.forEach((s) => { tx.objectStore(s).clear(); (datos[s] || []).forEach((r) => tx.objectStore(s).put(r)); });
      tx.oncomplete = ok; tx.onerror = () => mal(tx.error);
    });
    await escribir([opBitacora(usuario, 'RESTAURACION', `Respaldo del ${datos.exportado} restaurado.`)]);
  }

  window.DB = {
    inicializar, todos, obtener, contar, escribir, guardar, config, guardarConfig,
    crearUsuario, verificarUsuario, cambiarClave, opBitacora, cargarInventarioInicial,
    exportarTodo, restaurarTodo
  };
})();
