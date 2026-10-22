/* =====================================================================
 * repo.js — Capa de datos del aplicativo.
 * Una sola interfaz con dos implementaciones:
 *   - Servidor: API multiusuario en Cloudflare Workers + D1 (producción).
 *   - Local:    IndexedDB del navegador (demostración / sin servidor).
 * Las reglas de negocio están en core.js y las aplican ambas.
 * ===================================================================== */
(function () {
  'use strict';

  class ErrorNegocio extends Error {
    constructor(errores, extra) { super((errores || []).join(' ')); this.errores = errores || []; Object.assign(this, extra || {}); }
  }

  // ===================================================================
  // Implementación SERVIDOR (fetch a /api)
  // ===================================================================
  async function api(metodo, ruta, cuerpo, opciones) {
    const o = opciones || {};
    const init = { method: metodo, credentials: 'same-origin', headers: {} };
    if (cuerpo instanceof FormData) init.body = cuerpo;
    else if (cuerpo !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(cuerpo); }
    let r;
    try { r = await fetch('api' + ruta, init); } catch (e) { throw new ErrorNegocio(['No hay conexión con el servidor. Verifique su internet.']); }
    if (o.crudo) return r;
    const datos = r.headers.get('Content-Type')?.includes('json') ? await r.json() : {};
    if (r.status === 401 && !o.sinRedireccion) { window.dispatchEvent(new Event('sesion-expirada')); }
    if (!r.ok) throw new ErrorNegocio(datos.errores || [datos.error || `Error del servidor (${r.status}).`], { bloqueados: datos.bloqueados, estado: r.status });
    return datos;
  }

  const Servidor = {
    modo: 'servidor',
    descripcion: 'Servidor institucional (multiusuario)',
    async iniciar() {},
    async sesionActual() { try { return (await api('GET', '/sesion', undefined, { sinRedireccion: true })).usuario; } catch (e) { return null; } },
    async ingresar(usuario, clave) { return (await api('POST', '/sesion', { usuario, clave }, { sinRedireccion: true })).usuario; },
    async salir() { await api('DELETE', '/sesion').catch(() => {}); },
    async cambiarClave(clave) { await api('POST', '/sesion/clave', { clave }); },
    async cargarEstado() { return api('GET', '/estado'); },
    async registrarMovimiento(mov, sobranteRef) { return (await api('POST', '/movimientos', { mov, sobranteRef })).numero; },
    async anular(numero, motivo, documento) { await api('POST', `/movimientos/${encodeURIComponent(numero)}/anular`, { motivo, documento }); },
    async corregirBien(codigo, cambios, motivo, resolucion) { await api('PUT', `/bienes/${codigo}`, { cambios, motivo, resolucion }); },
    async guardarPersona(o) { return (await api('PUT', '/personal', o)).persona; },
    async guardarUbicacion(o, nueva) { await api('PUT', '/ubicaciones', { ubicacion: o, nueva }); },
    async crearInventario(inv) { return (await api('POST', '/inventarios', inv)).inventario; },
    async verificar(id, codigo, verif) { await api('PATCH', `/inventarios/${id}/verificacion`, { [codigo]: verif }); },
    async verificarVarios(id, mapa) { await api('PATCH', `/inventarios/${id}/verificacion`, mapa); },
    async agregarSobrante(id, s) { await api('POST', `/inventarios/${id}/sobrantes`, s); },
    async actualizarInventario(id, campos) { await api('PATCH', `/inventarios/${id}`, campos); },
    async cerrarInventario(id) { return api('POST', `/inventarios/${id}/cerrar`); },
    async guardarConfig(cfg) { await api('PUT', '/config', cfg); },
    async listarUsuarios() { return (await api('GET', '/usuarios')).usuarios; },
    async crearUsuario(u) { await api('POST', '/usuarios', u); },
    async activarUsuario(usuario, activo) { await api('PATCH', `/usuarios/${encodeURIComponent(usuario)}`, { activo }); },
    async bitacora() { return (await api('GET', '/bitacora')).registros; },
    async cargaInicial(filas, fuente) { return api('POST', '/bienes/carga', { filas, fuente }); },
    async respaldo() { return api('GET', '/respaldo'); },
    async restaurar() { throw new ErrorNegocio(['En el servidor, la restauración la realiza el administrador técnico con la recuperación de D1 (ver manual técnico).']); },
    async evento() { /* el servidor registra su propia bitácora */ },
    adjuntos: {
      disponible: true,
      async subir(numero, archivo, descripcion) { const f = new FormData(); f.append('archivo', archivo); f.append('descripcion', descripcion || ''); return api('POST', `/movimientos/${encodeURIComponent(numero)}/adjuntos`, f); },
      url: (id) => `api/adjuntos/${id}`
    }
  };

  // ===================================================================
  // Implementación LOCAL (IndexedDB, mismo comportamiento que la versión 1)
  // ===================================================================
  let usuarioLocal = null;
  const bit = (accion, detalle) => DB.opBitacora(usuarioLocal ? usuarioLocal.usuario : 'sistema', accion, detalle);
  const exigir = (rol) => { if (!usuarioLocal || (rol && !rol.includes(usuarioLocal.rol))) throw new ErrorNegocio(['Acción no permitida para su rol.']); };
  const OCP = ['ADMIN', 'PATRIMONIO']; const INV = ['ADMIN', 'PATRIMONIO', 'COMISION']; const ADM = ['ADMIN'];
  const sinPrivados = (u) => u && ({ usuario: u.usuario, nombre: u.nombre, rol: u.rol, debeCambiar: !!u.debeCambiar, activo: u.activo });
  async function mapaBienes() { return Object.fromEntries((await DB.todos('bienes')).map((b) => [b.codigo, b])); }
  async function inventario(id) { const inv = await DB.obtener('inventarios', id); if (!inv) throw new ErrorNegocio(['Proceso no encontrado.']); return inv; }

  async function registrarLocal(mov, sobranteRef) {
    const cfg = await DB.config();
    const p = Core.prepararRegistro(mov, { bienesPorCodigo: await mapaBienes(), numeros: (await DB.todos('movimientos')).map((m) => m.numero),
      usuario: usuarioLocal.usuario, hoy: Core.hoyISO(), establecimiento: cfg.establecimiento });
    if (p.errores) throw new ErrorNegocio(p.errores);
    const ops = p.bienes.map((b) => ({ store: 'bienes', valor: b }));
    if (sobranteRef && p.mov.tipo === 'ALTA') { // saneamiento de sobrante (art. 41)
      const [id, i] = sobranteRef.split(':'); const inv = await DB.obtener('inventarios', id);
      if (inv && inv.sobrantes[Number(i)]) { inv.sobrantes[Number(i)].alta = p.mov.numero; ops.push({ store: 'inventarios', valor: inv }); }
    }
    ops.push({ store: 'movimientos', valor: p.mov });
    ops.push(bit('ACTO_' + p.mov.tipo, `${p.mov.numero}: ${p.mov.items.length} bien(es) — ${p.mov.items.slice(0, 20).join(', ')}`));
    await DB.escribir(ops);
    return p.mov.numero;
  }

  const Local = {
    modo: 'local',
    descripcion: 'Este navegador (sin servidor)',
    async iniciar() { await DB.inicializar(); },
    async sesionActual() {
      const u = sessionStorage.getItem('gi_usuario');
      if (!u) return null;
      const r = await DB.obtener('usuarios', u);
      usuarioLocal = r && r.activo ? r : null;
      return sinPrivados(usuarioLocal);
    },
    async ingresar(usuario, clave) {
      const u = await DB.verificarUsuario(usuario, clave);
      if (!u) { await DB.escribir([DB.opBitacora(usuario, 'LOGIN_FALLIDO', '')]); throw new ErrorNegocio(['Usuario o clave incorrectos.']); }
      usuarioLocal = u; sessionStorage.setItem('gi_usuario', u.usuario);
      await DB.escribir([bit('LOGIN', '')]);
      return sinPrivados(u);
    },
    async salir() { sessionStorage.removeItem('gi_usuario'); usuarioLocal = null; },
    async cambiarClave(clave) {
      exigir(); if (String(clave).length < 8 || !/[A-Za-z]/.test(clave) || !/\d/.test(clave)) throw new ErrorNegocio(['La clave debe tener al menos 8 caracteres y combinar letras y números.']);
      await DB.cambiarClave(usuarioLocal.usuario, clave); usuarioLocal.debeCambiar = false; await DB.escribir([bit('CAMBIO_CLAVE', '')]);
    },
    async cargarEstado() {
      exigir();
      return { config: await DB.config(), bienes: await DB.todos('bienes'), movimientos: await DB.todos('movimientos'), personal: await DB.todos('personal'),
        ubicaciones: await DB.todos('ubicaciones'), inventarios: await DB.todos('inventarios'), adjuntos: [] };
    },
    async registrarMovimiento(mov, sobranteRef) { exigir(OCP); return registrarLocal(mov, sobranteRef); },
    async anular(numero, motivo, documento) {
      exigir(ADM);
      const m = await DB.obtener('movimientos', numero);
      const p = Core.prepararAnulacion(m, await mapaBienes(), { usuario: usuarioLocal.usuario, motivo, documento, hoy: Core.hoyISO() });
      if (p.errores) throw new ErrorNegocio(p.errores);
      if (p.bloqueados) throw new ErrorNegocio(['Hay bienes con actos posteriores.'], { bloqueados: p.bloqueados.map((d) => d.codigo) });
      const ops = p.bienes.map((x) => x.borrar ? { store: 'bienes', borrar: true, clave: x.codigo } : { store: 'bienes', valor: x.valor });
      ops.push({ store: 'movimientos', valor: p.mov }, bit('ANULACION', `${numero}: ${motivo} ${documento || ''}`));
      await DB.escribir(ops);
    },
    async corregirBien(codigo, cambios, motivo, resolucion) {
      exigir(OCP);
      const p = Core.prepararCorreccion(await DB.obtener('bienes', codigo), cambios, { motivo, resolucion });
      if (p.errores) throw new ErrorNegocio(p.errores);
      if (!p.cambios.length) return;
      await DB.escribir([{ store: 'bienes', valor: p.bien }, bit('CORRECCION_REGISTRO', `${codigo} — ${motivo} — ${p.cambios.join('; ')}`)]);
    },
    async guardarPersona(o) {
      exigir(OCP);
      const todos = await DB.todos('personal');
      if (todos.some((x) => x.dni === o.dni && x.id !== o.id)) throw new ErrorNegocio(['Ya existe un usuario con ese DNI.']);
      const previo = o.id && todos.find((x) => x.id === o.id);
      if (previo && !o.activo && (await DB.todos('bienes')).some((b) => b.responsable === o.id && !['DISPUESTO', 'BAJA'].includes(b.situacion))) {
        throw new ErrorNegocio(['El usuario aún tiene bienes asignados. Registre primero la devolución.']);
      }
      const p = Object.assign({}, o, { id: o.id || 'P' + Date.now().toString(36) });
      await DB.escribir([{ store: 'personal', valor: p }, bit(previo ? 'EDICION_USUARIO_BIENES' : 'ALTA_USUARIO_BIENES', `${p.dni} ${p.nombres}`)]);
      return p;
    },
    async guardarUbicacion(o, nueva) {
      exigir(OCP);
      if (nueva && await DB.obtener('ubicaciones', o.nombre)) throw new ErrorNegocio(['La ubicación ya existe.']);
      await DB.escribir([{ store: 'ubicaciones', valor: o }, bit(nueva ? 'ALTA_UBICACION' : 'EDICION_UBICACION', o.nombre)]);
    },
    async crearInventario(datos) {
      exigir(INV);
      const todos = await DB.todos('inventarios');
      if (todos.some((i) => i.estado === 'ABIERTO')) throw new ErrorNegocio(['Ya hay un proceso abierto.']);
      const pref = datos.tipo === 'ANUAL' ? 'INVENT' : 'SUPERV';
      const inv = Object.assign({ estado: 'ABIERTO', tipo_verificacion: 'F', verif: {}, sobrantes: [], conciliacion: {}, informe: {}, creado: new Date().toISOString() }, datos,
        { id: `${pref}-${datos.anio}-${String(todos.filter((i) => i.id.startsWith(`${pref}-${datos.anio}`)).length + 1).padStart(2, '0')}` });
      await DB.escribir([{ store: 'inventarios', valor: inv }, bit('INVENTARIO_INICIO', `${inv.id} — ${inv.resolucion || ''}`)]);
      return inv;
    },
    async verificar(id, codigo, v) { return Local.verificarVarios(id, { [codigo]: v }); },
    async verificarVarios(id, mapa) {
      exigir(INV); const inv = await inventario(id);
      if (inv.estado !== 'ABIERTO') throw new ErrorNegocio(['El proceso está cerrado.']);
      Object.entries(mapa).forEach(([c, v]) => { if (v) inv.verif[c] = Object.assign({}, v, { usuario: usuarioLocal.usuario, fecha: Core.hoyISO() }); else delete inv.verif[c]; });
      await DB.escribir([{ store: 'inventarios', valor: inv }]);
    },
    async agregarSobrante(id, s) {
      exigir(INV); const inv = await inventario(id); inv.sobrantes.push(s);
      await DB.escribir([{ store: 'inventarios', valor: inv }, bit('INVENTARIO_SOBRANTE', `${id} ${s.descripcion}`)]);
    },
    async actualizarInventario(id, campos) {
      exigir(INV); const inv = await inventario(id);
      Object.assign(inv, campos);
      await DB.escribir([{ store: 'inventarios', valor: inv }, bit('INVENTARIO_ACTUALIZACION', `${id} ${Object.keys(campos).join(', ')}`)]);
    },
    async cerrarInventario(id) {
      exigir(INV); const inv = await inventario(id);
      const p = Core.prepararCierreInventario(inv, await DB.todos('bienes'), { hoy: Core.hoyISO() });
      if (p.errores) throw new ErrorNegocio(p.errores);
      if (p.mov) inv.movimiento = await registrarLocal(p.mov);
      Object.assign(inv, { resultados: p.resultados, estado: 'CERRADO', cerrado: p.cerrado });
      await DB.escribir([{ store: 'inventarios', valor: inv }, bit('INVENTARIO_CIERRE', id)]);
      return { movimiento: inv.movimiento };
    },
    async guardarConfig(cfg) { exigir(ADM); await DB.guardarConfig(cfg); await DB.escribir([bit('CONFIGURACION', JSON.stringify(cfg))]); },
    async listarUsuarios() { exigir(ADM); return (await DB.todos('usuarios')).map(sinPrivados); },
    async crearUsuario(u) {
      exigir(ADM);
      if (await DB.obtener('usuarios', u.usuario)) throw new ErrorNegocio(['El usuario ya existe.']);
      await DB.crearUsuario(u.usuario, u.nombre, u.rol, u.clave, true); await DB.escribir([bit('ALTA_USUARIO_SISTEMA', `${u.usuario} (${u.rol})`)]);
    },
    async activarUsuario(usuario, activo) {
      exigir(ADM); const u = await DB.obtener('usuarios', usuario); u.activo = activo;
      await DB.escribir([{ store: 'usuarios', valor: u }, bit(activo ? 'ACTIVA_USUARIO' : 'DESACTIVA_USUARIO', usuario)]);
    },
    async bitacora() { exigir(ADM); return (await DB.todos('bitacora')).reverse(); },
    async cargaInicial(filas, fuente) {
      exigir(ADM);
      const p = Core.prepararCargaInicial(filas, (await DB.todos('bienes')).map((b) => b.codigo), (await DB.todos('ubicaciones')).map((u) => u.nombre), { fuente });
      await DB.escribir(p.bienes.map((b) => ({ store: 'bienes', valor: b })).concat(p.ubicaciones.map((u) => ({ store: 'ubicaciones', valor: u })),
        [bit('CARGA_INICIAL', `${p.bienes.length} bienes desde ${fuente}; ${p.omitidos} omitidos (código inválido o duplicado).`)]));
      return { cargados: p.bienes.length, omitidos: p.omitidos };
    },
    async respaldo() { exigir(ADM); const d = await DB.exportarTodo(); await DB.escribir([bit('RESPALDO', 'Respaldo descargado')]); return d; },
    async restaurar(datos) { exigir(ADM); await DB.restaurarTodo(datos, usuarioLocal.usuario); },
    async evento(accion, detalle) { await DB.escribir([bit(accion, detalle)]); },
    adjuntos: { disponible: false }
  };

  /** Detecta el modo: si el sitio está publicado con la API, usa el servidor. */
  async function detectar() {
    if (location.protocol !== 'file:') {
      try {
        const r = await fetch('api/salud', { credentials: 'same-origin' });
        if (r.ok && (await r.json()).ok) return Servidor;
      } catch (e) { /* sin API */ }
    }
    return Local;
  }

  window.Repo = { detectar, ErrorNegocio };
})();
