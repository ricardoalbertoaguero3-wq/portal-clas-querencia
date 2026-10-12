/* =====================================================================
 * app.js — Interfaz del aplicativo (vistas, navegación, permisos)
 * ===================================================================== */
(function () {
  'use strict';
  const { esc, soles, fecha } = Formatos;
  const raiz = document.getElementById('raiz');

  // Roles: ADMIN (todo), PATRIMONIO (registra), CONSULTA (solo lectura)
  const ROLES = { ADMIN: 'Administrador', PATRIMONIO: 'Control Patrimonial', CONSULTA: 'Consulta' };
  const puede = {
    registrar: () => ['ADMIN', 'PATRIMONIO'].includes(S.usuario.rol),
    administrar: () => S.usuario.rol === 'ADMIN'
  };

  // Estado en memoria (se recarga desde IndexedDB tras cada escritura)
  const S = { usuario: null, cfg: null, bienes: [], porCodigo: {}, movs: [], personal: [], ubic: [], inventarios: [] };

  async function recargar() {
    S.cfg = await DB.config();
    S.bienes = await DB.todos('bienes');
    S.porCodigo = Object.fromEntries(S.bienes.map((b) => [b.codigo, b]));
    S.movs = (await DB.todos('movimientos')).sort((a, b) => (b.registrado || '').localeCompare(a.registrado || ''));
    S.personal = (await DB.todos('personal')).sort((a, b) => a.nombres.localeCompare(b.nombres));
    S.ubic = (await DB.todos('ubicaciones')).sort((a, b) => a.nombre.localeCompare(b.nombre));
    S.inventarios = (await DB.todos('inventarios')).sort((a, b) => b.id.localeCompare(a.id));
  }
  const nombrePersona = (id) => { const p = S.personal.find((x) => x.id === id); return p ? p.nombres : (id || ''); };
  const ctx = () => ({ config: S.cfg, nombrePersona });

  // ---------------- Utilidades de UI ----------------
  function toast(msg) {
    document.querySelectorAll('.toast').forEach((x) => x.remove());
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function modal(html, alMontar) {
    const f = document.createElement('div'); f.className = 'modal-fondo';
    f.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(f);
    const cerrar = () => f.remove();
    f.addEventListener('click', (e) => { if (e.target === f || e.target.closest('[data-cerrar]')) cerrar(); });
    if (alMontar) alMontar(f, cerrar);
    return cerrar;
  }
  const opciones = (lista, sel, vacio) => (vacio !== undefined ? `<option value="">${esc(vacio)}</option>` : '') +
    lista.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`; }).join('');
  const chipEstado = (e) => `<span class="chip ${{ Nuevo: 'ok', Bueno: 'ok', Regular: 'warn', Malo: 'bad', RAEE: 'bad', Chatarra: 'bad' }[e] || ''}">${esc(e)}</span>`;
  const chipSituacion = (s) => `<span class="chip ${{ ACTIVO: 'info', EN_SALIDA: 'warn', FALTANTE: 'bad', BAJA: 'bad', DISPUESTO: '' }[s] || ''}">${esc((Core.SITUACIONES[s] || s).split(' (')[0])}</span>`;
  const val = (raizEl, sel) => { const e = raizEl.querySelector(sel); return e ? e.value.trim() : ''; };

  function barras(obj, max) {
    const filas = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, max || 10);
    const tope = Math.max(1, ...filas.map((f) => f[1]));
    return `<div class="barras">${filas.map(([k, v]) => `<div class="barra-fila" title="${esc(k)}: ${v}">
      <span class="et">${esc(k)}</span><span class="pista"><div class="relleno" style="width:${(v / tope) * 100}%"></div></span>
      <span class="val">${v}</span></div>`).join('')}</div>`;
  }

  function descargarExcel(nombre, hojas) {
    if (typeof XLSX === 'undefined') { toast('No se pudo cargar la librería de Excel (revise la conexión a internet).'); return; }
    const wb = XLSX.utils.book_new();
    Object.entries(hojas).forEach(([n, filas]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), n.slice(0, 31)));
    XLSX.writeFile(wb, nombre);
  }
  function descargarJSON(nombre, datos) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(datos)], { type: 'application/json' }));
    a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const filaExport = (b) => ({
    codigo_patrimonial: b.codigo, codigo_interno: b.codigo_interno, descripcion: b.descripcion, marca: b.marca, modelo: b.modelo,
    nro_serie: b.serie, medidas: b.medidas, color: b.color, estado_conservacion: b.estado, situacion: Core.SITUACIONES[b.situacion],
    ubicacion: b.ubicacion, responsable: nombrePersona(b.responsable), origen: Core.ORIGENES[b.origen], nro_orden: b.nro_orden,
    fecha_adquisicion: b.fecha_adquisicion, valor_inicial: b.valor, clasificacion_contable: Core.clasificacionContable(b.valor, S.cfg.uit),
    cuenta_contable: b.cuenta_contable, observaciones: b.observaciones
  });

  // ---------------- Estructura ----------------
  const MENU = [
    ['#/panel', 'Panel'], ['#/bienes', 'Bienes'], ['#/movimientos', 'Movimientos'], ['#/inventario', 'Toma de inventario'],
    ['#/reportes', 'Reportes'], ['#/maestros', 'Personal y ubicaciones'], ['#/bitacora', 'Bitácora', 'admin'], ['#/config', 'Configuración', 'admin']
  ];
  function marco(contenido) {
    const ruta = location.hash.split('/').slice(0, 2).join('/');
    raiz.innerHTML = `<div class="app"><nav class="nav" id="nav">
      <div class="marca">Gestión de Inventario<small>${esc(S.cfg.entidad)}</small></div>
      ${MENU.filter((m) => !m[2] || puede.administrar()).map((m) => `<a href="${m[0]}" class="${ruta === m[0] ? 'activo' : ''}">${m[1]}</a>`).join('')}
      <div class="usuario">${esc(S.usuario.nombre)}<br>${ROLES[S.usuario.rol]}<br>
        <a href="#" id="clave" style="padding:0;display:inline">Cambiar clave</a> · <a href="#" id="salir" style="padding:0;display:inline">Salir</a></div>
      </nav><main class="main"><button class="btn menu-movil" id="menu" aria-label="Abrir menú">☰ Menú</button>${contenido}</main></div>`;
    raiz.querySelector('#menu').onclick = () => raiz.querySelector('#nav').classList.toggle('abierto');
    raiz.querySelector('#salir').onclick = (e) => { e.preventDefault(); salir(); };
    raiz.querySelector('#clave').onclick = (e) => { e.preventDefault(); dialogoClave(false); };
  }

  // ---------------- Sesión ----------------
  async function pantallaLogin(msg) {
    raiz.innerHTML = `<div class="login"><form class="tarjeta" id="f">
      <h1>Gestión de Inventario</h1><p class="muted pequeno">${esc((S.cfg || {}).entidad || '')} — Bienes muebles patrimoniales</p>
      ${msg ? `<div class="aviso bad">${esc(msg)}</div>` : ''}
      <div class="campo"><label for="u">Usuario</label><input id="u" autocomplete="username" required></div>
      <div class="campo" style="margin-top:.6rem"><label for="p">Clave</label><input id="p" type="password" autocomplete="current-password" required></div>
      <button class="btn primario" style="margin-top:1rem;width:100%;justify-content:center">Ingresar</button>
      <p class="muted pequeno" style="margin-top:1rem">Primer ingreso: usuario <b>admin</b>, clave <b>admin</b> (se pedirá cambiarla).</p></form></div>`;
    raiz.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const u = await DB.verificarUsuario(val(raiz, '#u'), raiz.querySelector('#p').value);
      if (!u) {
        await DB.escribir([DB.opBitacora(val(raiz, '#u'), 'LOGIN_FALLIDO', '')]);
        return pantallaLogin('Usuario o clave incorrectos.');
      }
      S.usuario = u;
      sessionStorage.setItem('gi_usuario', u.usuario);
      await DB.escribir([DB.opBitacora(u.usuario, 'LOGIN', '')]);
      if (u.debeCambiar) dialogoClave(true); else enrutar();
    };
  }
  function salir() { sessionStorage.removeItem('gi_usuario'); S.usuario = null; location.hash = ''; pantallaLogin(); }

  function dialogoClave(obligatorio) {
    modal(`<h2>Cambiar clave</h2>${obligatorio ? '<div class="aviso warn">Debe cambiar la clave inicial antes de continuar.</div>' : ''}
      <form id="fc"><div class="campos"><div class="campo"><label>Nueva clave (mín. 8 caracteres)</label><input type="password" id="c1" minlength="8" required></div>
      <div class="campo"><label>Repetir clave</label><input type="password" id="c2" minlength="8" required></div></div>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Guardar</button>${obligatorio ? '' : '<button type="button" class="btn" data-cerrar>Cancelar</button>'}</div></form>`,
    (m, cerrar) => {
      m.querySelector('#fc').onsubmit = async (e) => {
        e.preventDefault();
        const c1 = m.querySelector('#c1').value;
        if (c1 !== m.querySelector('#c2').value) return toast('Las claves no coinciden.');
        await DB.cambiarClave(S.usuario.usuario, c1);
        await DB.escribir([DB.opBitacora(S.usuario.usuario, 'CAMBIO_CLAVE', '')]);
        S.usuario.debeCambiar = false; cerrar(); toast('Clave actualizada.'); enrutar();
      };
    });
  }

  // ---------------- Panel ----------------
  function vistaPanel() {
    const k = Core.indicadores(S.bienes, S.movs, S.cfg.uit);
    const alertas = [];
    if (k.salidasVencidas.length) alertas.push(['bad', `${k.salidasVencidas.length} orden(es) de salida con fecha de retorno vencida`, '#/movimientos?tipo=SALIDA']);
    if (k.faltantes) alertas.push(['bad', `${k.faltantes} bienes faltantes pendientes de investigación / baja`, '#/bienes?situacion=FALTANTE']);
    if (k.candidatosBaja) alertas.push(['warn', `${k.candidatosBaja} bienes en estado Malo/RAEE/Chatarra: evaluar baja`, '#/bienes?estado=baja']);
    if (k.pendientesDisposicion) alertas.push(['warn', `${k.pendientesDisposicion} bienes dados de baja pendientes de disposición`, '#/bienes?situacion=BAJA']);
    if (k.sinResponsable) alertas.push(['info', `${k.sinResponsable} bienes sin servidor responsable asignado (formato de asignación pendiente)`, '#/bienes?resp=no']);
    if (k.sinUbicacion) alertas.push(['info', `${k.sinUbicacion} bienes "SIN UBICACION"`, '#/bienes?ubicacion=SIN%20UBICACION']);
    if (k.origenNoDeterminado) alertas.push(['info', `${k.origenNoDeterminado} bienes sin origen definido (propio CLAS / afectado por la UE)`, '#/bienes']);
    marco(`<div class="barra"><h1>Panel de control patrimonial</h1></div>
      ${S.bienes.length ? '' : '<div class="aviso warn">No hay bienes registrados. Vaya a <a href="#/config">Configuración</a> para cargar el inventario 2025.</div>'}
      <div class="kpis">
        <div class="kpi"><div class="v">${k.total}</div><div class="l">Bienes en patrimonio</div></div>
        <div class="kpi"><div class="v">${soles(k.valor)}</div><div class="l">Valor de adquisición</div></div>
        <div class="kpi"><div class="v">${k.activoFijo}</div><div class="l">Activo fijo (≥ 1/4 UIT)</div></div>
        <div class="kpi"><div class="v">${k.cuentasOrden}</div><div class="l">Cuentas de orden (&lt; 1/4 UIT)</div></div>
        <div class="kpi"><div class="v">${S.movs.filter((m) => !m.anulado && m.fecha >= Core.hoyISO().slice(0, 4)).length}</div><div class="l">Movimientos en ${Core.hoyISO().slice(0, 4)}</div></div>
      </div>
      <div class="tarjeta"><h2>Alertas</h2>${alertas.length ? alertas.map((a) => `<div class="aviso ${a[0]}"><a href="${a[2]}">${esc(a[1])}</a></div>`).join('') : '<p class="muted">Sin alertas.</p>'}</div>
      <div class="grid g2">
        <div class="tarjeta"><h2>Bienes por estado de conservación</h2>${barras(k.porEstado)}</div>
        <div class="tarjeta"><h2>Ubicaciones con más bienes</h2>${barras(k.porUbicacion, 10)}</div>
      </div>
      <div class="tarjeta"><h2>Últimos movimientos</h2>${tablaMovs(S.movs.slice(0, 8))}</div>`);
  }

  // ---------------- Bienes ----------------
  function vistaBienes(q) {
    const f = { texto: q.get('q') || '', ubicacion: q.get('ubicacion') || '', estado: q.get('estado') || '', situacion: q.get('situacion') || '', resp: q.get('resp') || '' };
    marco(`<div class="barra"><h1>Registro de bienes</h1>
        <button class="btn" id="exp">Exportar a Excel</button></div>
      <div class="filtros">
        <input id="ft" placeholder="Buscar código, denominación, marca, serie, responsable…" value="${esc(f.texto)}">
        <select id="fu">${opciones(S.ubic.map((u) => u.nombre), f.ubicacion, 'Todas las ubicaciones')}</select>
        <select id="fe">${opciones([...Core.ESTADOS_CONSERVACION, ['baja', 'Malo / RAEE / Chatarra']], f.estado, 'Todos los estados')}</select>
        <select id="fs">${opciones(Object.entries(Core.SITUACIONES).map(([k, v]) => [k, v.split(' (')[0]]), f.situacion, 'Patrimonio vigente')}</select>
      </div>
      <p class="muted pequeno" id="res"></p><div class="tabla-wrap"><table><thead><tr><th>Código patrimonial</th><th>Denominación</th><th>Marca / Modelo</th>
      <th>Serie</th><th>Estado</th><th>Situación</th><th>Ubicación</th><th>Responsable</th><th class="num">Valor</th></tr></thead><tbody id="tb"></tbody></table></div>`);
    let filtrados = [];
    const pintar = () => {
      const t = val(raiz, '#ft').toLowerCase(); const u = val(raiz, '#fu'); const e = val(raiz, '#fe'); const s = val(raiz, '#fs');
      filtrados = S.bienes.filter((b) =>
        (s ? b.situacion === s : !['DISPUESTO'].includes(b.situacion)) &&
        (!u || b.ubicacion === u) &&
        (!e || (e === 'baja' ? ['Malo', 'RAEE', 'Chatarra'].includes(b.estado) : b.estado === e)) &&
        (f.resp !== 'no' || !b.responsable) &&
        (!t || [b.codigo, b.codigo_interno, b.descripcion, b.marca, b.modelo, b.serie, nombrePersona(b.responsable)].join(' ').toLowerCase().includes(t)));
      const total = filtrados.reduce((x, b) => x + Number(b.valor || 0), 0);
      raiz.querySelector('#res').textContent = `${filtrados.length} bienes · ${soles(total)}${filtrados.length > 500 ? ' · se muestran los primeros 500' : ''}`;
      raiz.querySelector('#tb').innerHTML = filtrados.slice(0, 500).map((b) => `<tr class="click" data-c="${esc(b.codigo)}">
        <td class="mono">${esc(b.codigo)}</td><td>${esc(b.descripcion)}</td><td>${esc(b.marca)} ${esc(b.modelo)}</td><td>${esc(b.serie)}</td>
        <td>${chipEstado(b.estado)}</td><td>${chipSituacion(b.situacion)}</td><td>${esc(b.ubicacion)}</td><td>${esc(nombrePersona(b.responsable))}</td>
        <td class="num">${soles(b.valor)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">Sin resultados.</td></tr>';
    };
    ['#ft', '#fu', '#fe', '#fs'].forEach((s) => raiz.querySelector(s).addEventListener('input', pintar));
    raiz.querySelector('#tb').onclick = (e) => { const tr = e.target.closest('tr[data-c]'); if (tr) location.hash = '#/bien/' + tr.dataset.c; };
    raiz.querySelector('#exp').onclick = () => descargarExcel(`bienes_${Core.hoyISO()}.xlsx`, { Bienes: filtrados.map(filaExport) });
    pintar();
  }

  function vistaBien(codigo) {
    const b = S.porCodigo[codigo];
    if (!b) return marco('<div class="aviso bad">Bien no encontrado.</div>');
    const movs = S.movs.filter((m) => m.items.includes(codigo)).sort((a, c) => (a.registrado || '').localeCompare(c.registrado || ''));
    const fila = (l, v) => `<tr><th style="width:35%">${l}</th><td>${v}</td></tr>`;
    marco(`<div class="barra"><h1>${esc(b.descripcion)}</h1><button class="btn" id="imp">Imprimir ficha</button>
      ${puede.registrar() ? '<button class="btn" id="edi">Editar datos descriptivos</button>' : ''}</div>
      <div class="grid g2"><div class="tarjeta"><div class="tabla-wrap"><table><tbody>
        ${fila('Código patrimonial', `<span class="mono">${esc(b.codigo)}</span>`)}${fila('Código interno', esc(b.codigo_interno))}
        ${fila('Marca / Modelo', `${esc(b.marca)} / ${esc(b.modelo)}`)}${fila('Serie', esc(b.serie))}${fila('Medidas / Color', `${esc(b.medidas)} ${esc(b.color)}`)}
        ${fila('Estado', chipEstado(b.estado))}${fila('Situación', chipSituacion(b.situacion))}${fila('Ubicación', esc(b.ubicacion))}
        ${fila('Responsable', esc(nombrePersona(b.responsable)) || '<span class="muted">Sin asignar</span>')}
        ${fila('Origen', esc(Core.ORIGENES[b.origen]))}${fila('Orden de compra', esc(b.nro_orden))}${fila('Fecha de adquisición', fecha(b.fecha_adquisicion))}
        ${fila('Valor', soles(b.valor))}${fila('Clasificación contable (ref.)', esc(Core.clasificacionContable(b.valor, S.cfg.uit)))}
        ${fila('Cuenta contable', esc(b.cuenta_contable))}${fila('Observaciones', esc(b.observaciones))}
      </tbody></table></div></div>
      <div class="tarjeta"><h2>Historial (kardex)</h2>
        <p class="muted pequeno">Situación, estado, ubicación y responsable solo cambian mediante movimientos, para mantener la trazabilidad.</p>
        ${movs.length ? tablaMovs(movs) : '<p class="muted">Sin movimientos desde la carga inicial.</p>'}</div></div>`);
    raiz.querySelector('#imp').onclick = () => Formatos.imprimir(Formatos.fichaBien(b, movs, ctx()));
    const ed = raiz.querySelector('#edi');
    if (ed) ed.onclick = () => editarBien(b);
  }

  function editarBien(b) {
    const campos = [['codigo_interno', 'Código interno'], ['descripcion', 'Denominación'], ['marca', 'Marca'], ['modelo', 'Modelo'], ['serie', 'Serie'],
      ['medidas', 'Medidas'], ['color', 'Color'], ['nro_orden', 'Orden de compra'], ['cuenta_contable', 'Cuenta contable']];
    modal(`<h2>Editar datos descriptivos</h2><form id="fe"><div class="campos">
      ${campos.map(([k, l]) => `<div class="campo"><label>${l}</label><input name="${k}" value="${esc(b[k])}"></div>`).join('')}
      <div class="campo"><label>Origen</label><select name="origen">${opciones(Object.entries(Core.ORIGENES), b.origen)}</select></div>
      <div class="campo ancho"><label>Observaciones</label><textarea name="observaciones">${esc(b.observaciones)}</textarea></div>
      <div class="campo ancho"><label class="req">Motivo de la corrección (queda en bitácora)</label><input name="_motivo" required></div></div>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fe').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target); const nuevo = Object.assign({}, b); const cambios = [];
        [...campos.map((c) => c[0]), 'origen', 'observaciones'].forEach((k) => {
          const v = Core.limpiar(fd.get(k)); if (v !== (b[k] || '')) { cambios.push(`${k}: "${b[k] || ''}" → "${v}"`); nuevo[k] = v; }
        });
        if (!cambios.length) return cerrar();
        nuevo.actualizado = new Date().toISOString();
        await DB.escribir([{ store: 'bienes', valor: nuevo }, DB.opBitacora(S.usuario.usuario, 'EDICION_BIEN', `${b.codigo} — ${fd.get('_motivo')} — ${cambios.join('; ')}`)]);
        cerrar(); await recargar(); toast('Datos actualizados.'); enrutar();
      };
    });
  }

  // ---------------- Movimientos ----------------
  function tablaMovs(movs) {
    return `<div class="tabla-wrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Acto</th><th class="num">Bienes</th><th>Causal / motivo</th><th>Usuario</th></tr></thead><tbody>
      ${movs.map((m) => `<tr class="click" onclick="location.hash='#/movimiento/${esc(m.numero)}'"><td class="mono">${esc(m.numero)}${m.anulado ? ' <span class="chip bad">Anulado</span>' : ''}</td>
      <td>${fecha(m.fecha)}</td><td>${esc(Core.TIPOS_MOVIMIENTO[m.tipo].nombre)}</td><td class="num">${m.items.length}</td>
      <td>${esc(m.causal || m.motivo || '')}</td><td>${esc(m.usuario)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin movimientos.</td></tr>'}</tbody></table></div>`;
  }

  function vistaMovimientos(q) {
    const tipo = q.get('tipo') || '';
    const manuales = Object.entries(Core.TIPOS_MOVIMIENTO).filter(([k]) => k !== 'INVENTARIO');
    marco(`<div class="barra"><h1>Movimientos patrimoniales</h1>
      ${puede.registrar() ? `<select id="nt" style="width:auto">${opciones(manuales.map(([k, d]) => [k, d.nombre]), '', '+ Registrar movimiento…')}</select>` : ''}
      <button class="btn" id="exp">Exportar a Excel</button></div>
      <div class="filtros"><select id="ft">${opciones(Object.entries(Core.TIPOS_MOVIMIENTO).map(([k, d]) => [k, d.nombre]), tipo, 'Todos los actos')}</select></div>
      <div id="lista"></div>`);
    const pintar = () => {
      const t = val(raiz, '#ft');
      raiz.querySelector('#lista').innerHTML = tablaMovs(S.movs.filter((m) => !t || m.tipo === t));
    };
    raiz.querySelector('#ft').onchange = pintar;
    const nt = raiz.querySelector('#nt');
    if (nt) nt.onchange = () => { if (nt.value) location.hash = '#/nuevo/' + nt.value; };
    raiz.querySelector('#exp').onclick = () => descargarExcel(`movimientos_${Core.hoyISO()}.xlsx`, {
      Movimientos: S.movs.flatMap((m) => m.detalle.map((d) => ({
        numero: m.numero, fecha: m.fecha, acto: Core.TIPOS_MOVIMIENTO[m.tipo].nombre, anulado: m.anulado ? 'SI' : '', causal: m.causal, documento: m.documento,
        codigo_patrimonial: d.codigo, descripcion: d.descripcion, valor: d.valor,
        estado_antes: d.antes && d.antes.estado, estado_despues: d.despues && d.despues.estado,
        ubicacion_antes: d.antes && d.antes.ubicacion, ubicacion_despues: d.despues && d.despues.ubicacion,
        responsable_antes: d.antes && nombrePersona(d.antes.responsable), responsable_despues: d.despues && nombrePersona(d.despues.responsable),
        destino_externo: m.destino_externo, fecha_retorno: m.fecha_retorno, motivo: m.motivo, usuario: m.usuario, registrado: m.registrado
      })))
    });
    pintar();
  }

  // Campos del formulario por tipo de acto
  const CAMPOS_FORM = {
    ALTA: ['causal', 'documento', 'motivo'],
    ASIGNACION: ['responsable_destino', 'ubicacion_destino', 'documento', 'motivo'],
    DEVOLUCION: ['motivo', 'ubicacion_destino', 'documento'],
    DESPLAZAMIENTO: ['ubicacion_destino', 'responsable_destino', 'documento', 'motivo'],
    SALIDA: ['causal', 'destino_externo', 'fecha_retorno', 'documento', 'motivo'],
    REINGRESO: ['estado_destino', 'documento', 'motivo'],
    CAMBIO_ESTADO: ['estado_destino', 'motivo', 'documento'],
    BAJA: ['causal', 'documento', 'motivo'],
    DISPOSICION: ['causal', 'destino_externo', 'documento', 'motivo']
  };
  const AYUDA_DOC = {
    ALTA: 'Ej.: Orden de compra N°, guía de remisión, PECOSA, resolución de donación/transferencia, acta de sobrante.',
    BAJA: 'Resolución que aprueba la baja (N° y fecha) e informe técnico que la sustenta.',
    DISPOSICION: 'Resolución que aprueba el acto de disposición (N° y fecha).',
    SALIDA: 'Ej.: Memorando / orden de servicio de mantenimiento.'
  };
  function campoMov(tipo, c) {
    const req = Core.TIPOS_MOVIMIENTO[tipo].requiere.includes(c) ? 'req' : '';
    const l = `<label class="${req}">${Core.ETIQUETAS_CAMPO[c]}</label>`;
    const listaCausal = { ALTA: Core.CAUSALES_ALTA, SALIDA: Core.MOTIVOS_SALIDA, BAJA: Core.CAUSALES_BAJA, DISPOSICION: Core.MODALIDADES_DISPOSICION }[tipo];
    switch (c) {
      case 'causal': return `<div class="campo">${l}<select name="causal">${opciones(listaCausal, '', 'Seleccione…')}</select></div>`;
      case 'responsable_destino': return `<div class="campo">${l}<select name="responsable_destino">${opciones(S.personal.filter((p) => p.activo).map((p) => [p.id, `${p.nombres} — ${p.cargo || ''}`]), '', '—')}</select>
        ${S.personal.length ? '' : '<span class="pequeno muted">Registre personal en "Personal y ubicaciones".</span>'}</div>`;
      case 'ubicacion_destino': return `<div class="campo">${l}<select name="ubicacion_destino">${opciones(S.ubic.filter((u) => u.activo).map((u) => u.nombre), '', '— (sin cambio)')}</select></div>`;
      case 'estado_destino': return `<div class="campo">${l}<select name="estado_destino">${opciones(Core.ESTADOS_CONSERVACION, '', tipo === 'REINGRESO' ? '— (sin cambio)' : 'Seleccione…')}</select></div>`;
      case 'fecha_retorno': return `<div class="campo">${l}<input type="date" name="fecha_retorno"></div>`;
      case 'motivo': return `<div class="campo ancho">${l}<textarea name="motivo"></textarea></div>`;
      case 'documento': return `<div class="campo">${l}<input name="documento" placeholder="${esc(AYUDA_DOC[tipo] || 'Memorando, informe, solicitud…')}"></div>`;
      default: return `<div class="campo">${l}<input name="${c}"></div>`;
    }
  }

  function vistaNuevo(tipo) {
    const def = Core.TIPOS_MOVIMIENTO[tipo];
    if (!def || tipo === 'INVENTARIO' || !puede.registrar()) return marco('<div class="aviso bad">Acción no permitida.</div>');
    const elegibles = def.desde ? S.bienes.filter((b) => def.desde.includes(b.situacion)) : [];
    const sel = new Set();
    const filaAlta = () => `<tr>
      <td><input name="codigo" inputmode="numeric" maxlength="12" placeholder="12 dígitos"></td><td><input name="descripcion"></td>
      <td><input name="marca"></td><td><input name="modelo"></td><td><input name="serie"></td><td><input name="color"></td>
      <td><select name="estado">${opciones(Core.ESTADOS_CONSERVACION, 'Nuevo')}</select></td>
      <td><input name="valor" type="number" step="0.01" min="0"></td><td><input name="fecha_adquisicion" type="date"></td>
      <td><input name="nro_orden"></td><td><select name="origen">${opciones(Object.entries(Core.ORIGENES), 'PROPIO')}</select></td>
      <td><select name="ubicacion">${opciones(S.ubic.map((u) => u.nombre), 'ALMACEN GENERAL')}</select></td>
      <td><button type="button" class="btn chico peligro" data-quitar>×</button></td></tr>`;
    marco(`<div class="barra"><h1>${esc(def.nombre)}</h1><a class="btn" href="#/movimientos">Volver</a></div>
      <form id="fm"><div class="tarjeta"><h2>Datos del acto</h2><div class="campos">
        <div class="campo"><label class="req">Fecha</label><input type="date" name="fecha" value="${Core.hoyISO()}" max="${Core.hoyISO()}"></div>
        ${CAMPOS_FORM[tipo].map((c) => campoMov(tipo, c)).join('')}
        <div class="campo ancho"><label>Observaciones</label><input name="observaciones"></div></div></div>
      ${tipo === 'ALTA'
        ? `<div class="tarjeta"><h2>Bienes a incorporar</h2><div class="tabla-wrap"><table><thead><tr><th>Código patrimonial</th><th>Denominación</th><th>Marca</th><th>Modelo</th>
           <th>Serie</th><th>Color</th><th>Estado</th><th>Valor S/</th><th>F. adquisición</th><th>O/C</th><th>Origen</th><th>Ubicación</th><th></th></tr></thead>
           <tbody id="nuevos">${filaAlta()}</tbody></table></div><button type="button" class="btn" id="mas" style="margin-top:.5rem">+ Agregar fila</button></div>`
        : `<div class="tarjeta"><h2>Bienes comprendidos <span class="contador" id="cnt">(0)</span></h2>
           <p class="muted pequeno">Se listan solo los bienes cuya situación permite este acto (${elegibles.length}).</p>
           <div class="filtros"><input id="bq" placeholder="Filtrar por código, denominación, serie…">
             <select id="bu">${opciones(S.ubic.map((u) => u.nombre), '', 'Todas las ubicaciones')}</select>
             <select id="br">${opciones(S.personal.map((p) => [p.id, p.nombres]), '', 'Todos los responsables')}</select></div>
           <div class="tabla-wrap selector"><table><thead><tr><th><input type="checkbox" id="todos" aria-label="Seleccionar visibles"></th><th>Código</th><th>Denominación</th>
           <th>Serie</th><th>Estado</th><th>Ubicación</th><th>Responsable</th></tr></thead><tbody id="bl"></tbody></table></div></div>`}
      <div id="errores"></div>
      <div class="barra"><button class="btn primario">Registrar ${esc(def.nombre.toLowerCase())}</button></div></form>`);
    const form = raiz.querySelector('#fm');
    if (tipo === 'ALTA') {
      raiz.querySelector('#mas').onclick = () => raiz.querySelector('#nuevos').insertAdjacentHTML('beforeend', filaAlta());
      raiz.querySelector('#nuevos').onclick = (e) => { if (e.target.closest('[data-quitar]')) e.target.closest('tr').remove(); };
    } else {
      let visibles = [];
      const pintar = () => {
        const t = val(raiz, '#bq').toLowerCase(); const u = val(raiz, '#bu'); const r = val(raiz, '#br');
        visibles = elegibles.filter((b) => (!u || b.ubicacion === u) && (!r || b.responsable === r) &&
          (!t || [b.codigo, b.codigo_interno, b.descripcion, b.serie, b.marca].join(' ').toLowerCase().includes(t))).slice(0, 300);
        raiz.querySelector('#bl').innerHTML = visibles.map((b) => `<tr><td><input type="checkbox" data-c="${esc(b.codigo)}" ${sel.has(b.codigo) ? 'checked' : ''} aria-label="Seleccionar ${esc(b.codigo)}"></td>
          <td class="mono">${esc(b.codigo)}</td><td>${esc(b.descripcion)}</td><td>${esc(b.serie)}</td><td>${chipEstado(b.estado)}</td>
          <td>${esc(b.ubicacion)}</td><td>${esc(nombrePersona(b.responsable))}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin bienes elegibles.</td></tr>';
        raiz.querySelector('#cnt').textContent = `(${sel.size} seleccionados)`;
      };
      ['#bq', '#bu', '#br'].forEach((s) => raiz.querySelector(s).addEventListener('input', pintar));
      raiz.querySelector('#bl').onchange = (e) => {
        const c = e.target.dataset.c; if (!c) return;
        if (e.target.checked) sel.add(c); else sel.delete(c);
        raiz.querySelector('#cnt').textContent = `(${sel.size} seleccionados)`;
      };
      raiz.querySelector('#todos').onchange = (e) => { visibles.forEach((b) => (e.target.checked ? sel.add(b.codigo) : sel.delete(b.codigo))); pintar(); };
      pintar();
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const mov = { tipo };
      ['fecha', 'observaciones', ...CAMPOS_FORM[tipo]].forEach((c) => { mov[c] = Core.limpiar(fd.get(c)); });
      if (tipo === 'ALTA') {
        mov.nuevos = [...raiz.querySelectorAll('#nuevos tr')].map((tr) => {
          const o = {}; tr.querySelectorAll('[name]').forEach((i) => { o[i.name] = Core.limpiar(i.value); });
          return o;
        }).filter((o) => o.codigo || o.descripcion);
        mov.nuevos.forEach((o) => { o.valor = Core.aNumero(o.valor); o.descripcion = o.descripcion.toUpperCase(); });
        const dup = mov.nuevos.map((o) => o.codigo).filter((c, i, a) => a.indexOf(c) !== i);
        mov.items = mov.nuevos.map((o) => o.codigo);
        if (dup.length) return mostrarErrores([`Código repetido en el formulario: ${dup.join(', ')}`]);
      } else mov.items = [...sel];
      const errores = Core.validarMovimiento(mov, S.porCodigo);
      if (errores.length) return mostrarErrores(errores);
      const numero = await registrarMovimiento(mov);
      toast(`Movimiento ${numero} registrado.`);
      location.hash = '#/movimiento/' + numero;
    };
  }
  function mostrarErrores(errores) {
    const el = raiz.querySelector('#errores');
    el.innerHTML = `<div class="aviso bad"><b>No se puede registrar:</b><ul>${errores.slice(0, 15).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Registra el movimiento y actualiza los bienes en una sola transacción */
  async function registrarMovimiento(mov) {
    mov.numero = Core.siguienteNumero(mov.tipo, mov.fecha.slice(0, 4), S.movs.map((m) => m.numero));
    mov.usuario = S.usuario.usuario;
    mov.registrado = new Date().toISOString();
    const ops = [];
    if (mov.tipo === 'ALTA') {
      mov.detalle = mov.nuevos.map((n) => {
        const b = Object.assign({ codigo_interno: '', medidas: '', dependencia: S.cfg.establecimiento, responsable: '', cuenta_contable: '', observaciones: '' },
          n, { situacion: 'ACTIVO', creado: mov.registrado, alta: mov.numero });
        ops.push({ store: 'bienes', valor: b });
        const desp = { situacion: 'ACTIVO', estado: b.estado, ubicacion: b.ubicacion, responsable: '' };
        return { codigo: b.codigo, descripcion: b.descripcion, marca: b.marca, modelo: b.modelo, serie: b.serie, estado: b.estado, valor: b.valor, antes: null, despues: desp };
      });
      delete mov.nuevos;
    } else {
      mov.detalle = mov.items.map((c) => {
        const r = Core.aplicarMovimiento(mov, S.porCodigo[c]);
        r.bien.actualizado = mov.registrado;
        ops.push({ store: 'bienes', valor: r.bien });
        const b = S.porCodigo[c];
        return { codigo: c, descripcion: b.descripcion, marca: b.marca, modelo: b.modelo, serie: b.serie, estado: b.estado, valor: b.valor, antes: r.antes, despues: r.despues };
      });
    }
    ops.push({ store: 'movimientos', valor: mov });
    ops.push(DB.opBitacora(S.usuario.usuario, 'MOVIMIENTO_' + mov.tipo, `${mov.numero}: ${mov.items.length} bien(es) — ${mov.items.slice(0, 20).join(', ')}`));
    await DB.escribir(ops);
    await recargar();
    return mov.numero;
  }

  function vistaMovimiento(numero) {
    const m = S.movs.find((x) => x.numero === numero);
    if (!m) return marco('<div class="aviso bad">Movimiento no encontrado.</div>');
    const def = Core.TIPOS_MOVIMIENTO[m.tipo];
    const pares = [['Fecha', fecha(m.fecha)], ['Causal', m.causal], ['Documento', m.documento], ['Responsable que recibe', nombrePersona(m.responsable_destino)],
      ['Ubicación destino', m.ubicacion_destino], ['Destino externo', m.destino_externo], ['Retorno previsto', fecha(m.fecha_retorno)],
      ['Nuevo estado', m.estado_destino], ['Motivo', m.motivo], ['Observaciones', m.observaciones], ['Registrado por', `${m.usuario} — ${new Date(m.registrado).toLocaleString('es-PE')}`]];
    const dif = (d, k) => d.antes && d.antes[k] !== d.despues[k] ? `${esc(k === 'responsable' ? nombrePersona(d.antes[k]) : d.antes[k]) || '—'} → <b>${esc(k === 'responsable' ? nombrePersona(d.despues[k]) : d.despues[k]) || '—'}</b>` : esc(k === 'responsable' ? nombrePersona(d.despues[k]) : d.despues[k]);
    marco(`<div class="barra"><h1>${esc(def.nombre)} <span class="mono">${esc(m.numero)}</span></h1>
      <button class="btn primario" id="imp">Imprimir formato</button>
      ${puede.administrar() && !m.anulado ? '<button class="btn peligro" id="anu">Anular</button>' : ''}</div>
      ${m.anulado ? `<div class="aviso bad">Anulado el ${fecha(m.anulado.fecha)} por ${esc(m.anulado.usuario)}: ${esc(m.anulado.motivo)}</div>` : ''}
      <div class="tarjeta"><table><tbody>${pares.filter((p) => p[1]).map((p) => `<tr><th style="width:30%">${p[0]}</th><td>${esc(p[1])}</td></tr>`).join('')}</tbody></table></div>
      <div class="tabla-wrap"><table><thead><tr><th>Código</th><th>Denominación</th><th>Situación</th><th>Estado</th><th>Ubicación</th><th>Responsable</th><th class="num">Valor</th></tr></thead>
      <tbody>${m.detalle.map((d) => `<tr class="click" onclick="location.hash='#/bien/${esc(d.codigo)}'"><td class="mono">${esc(d.codigo)}</td><td>${esc(d.descripcion)}</td>
        <td>${dif(d, 'situacion')}</td><td>${dif(d, 'estado')}</td><td>${dif(d, 'ubicacion')}</td><td>${dif(d, 'responsable')}</td><td class="num">${soles(d.valor)}</td></tr>`).join('')}</tbody></table></div>`);
    raiz.querySelector('#imp').onclick = () => Formatos.imprimir(Formatos.movimiento(m, ctx()));
    const an = raiz.querySelector('#anu');
    if (an) an.onclick = () => anular(m);
  }

  /** Anula un movimiento solo si ningún bien tuvo cambios posteriores (revierte al estado "antes"). */
  function anular(m) {
    const bloqueados = m.detalle.filter((d) => {
      const b = S.porCodigo[d.codigo];
      if (!b) return true;
      return ['situacion', 'estado', 'ubicacion', 'responsable'].some((k) => (b[k] || '') !== (d.despues[k] || ''));
    });
    if (bloqueados.length) {
      return modal(`<h2>No se puede anular</h2><div class="aviso warn">Los siguientes bienes tienen movimientos posteriores. Anule primero los movimientos más recientes o registre un movimiento correctivo:<ul>
        ${bloqueados.slice(0, 15).map((d) => `<li>${esc(d.codigo)} — ${esc(d.descripcion)}</li>`).join('')}</ul></div><button class="btn" data-cerrar>Cerrar</button>`);
    }
    modal(`<h2>Anular ${esc(m.numero)}</h2><p>Se revertirán ${m.detalle.length} bien(es) a su situación anterior${m.tipo === 'ALTA' ? ' (los bienes incorporados se eliminarán del registro)' : ''}. El movimiento queda en el historial marcado como anulado.</p>
      <form id="fa"><label class="req">Motivo de la anulación</label><textarea name="motivo" required></textarea>
      <div class="barra" style="margin-top:1rem"><button class="btn peligro">Anular</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (md, cerrar) => {
      md.querySelector('#fa').onsubmit = async (e) => {
        e.preventDefault();
        const motivo = Core.limpiar(new FormData(e.target).get('motivo'));
        const ops = m.detalle.map((d) => d.antes === null
          ? { store: 'bienes', borrar: true, clave: d.codigo }
          : { store: 'bienes', valor: Object.assign({}, S.porCodigo[d.codigo], d.antes, { actualizado: new Date().toISOString() }) });
        ops.push({ store: 'movimientos', valor: Object.assign({}, m, { anulado: { fecha: Core.hoyISO(), usuario: S.usuario.usuario, motivo } }) });
        ops.push(DB.opBitacora(S.usuario.usuario, 'ANULACION', `${m.numero}: ${motivo}`));
        await DB.escribir(ops); cerrar(); await recargar(); toast('Movimiento anulado.'); enrutar();
      };
    });
  }

  // ---------------- Toma de inventario ----------------
  function vistaInventarios() {
    const abierto = S.inventarios.find((i) => i.estado === 'ABIERTO');
    marco(`<div class="barra"><h1>Toma de inventario físico</h1>
      ${puede.registrar() && !abierto ? '<button class="btn primario" id="nuevo">Iniciar inventario</button>' : ''}</div>
      <div class="aviso info">El inventario se realiza con fecha de corte (usualmente al 31 de diciembre) por una Comisión de Inventario designada por resolución.
      La verificación se registra por ubicación; al cerrar, el sistema genera la regularización (estado, ubicación, responsable, faltantes) y el informe final.</div>
      <div class="tabla-wrap"><table><thead><tr><th>Código</th><th>Año</th><th>Fecha de corte</th><th>Comisión</th><th>Verificados</th><th>Estado</th></tr></thead><tbody>
      ${S.inventarios.map((i) => `<tr class="click" onclick="location.hash='#/inventario/${esc(i.id)}'"><td class="mono">${esc(i.id)}</td><td>${i.anio}</td><td>${fecha(i.fecha_corte)}</td>
        <td>${esc(i.comision)}</td><td>${Object.keys(i.verif || {}).length}</td><td>${i.estado === 'ABIERTO' ? '<span class="chip warn">En ejecución</span>' : '<span class="chip ok">Cerrado</span>'}</td></tr>`).join('') ||
        '<tr><td colspan="6" class="muted">No hay inventarios registrados.</td></tr>'}</tbody></table></div>`);
    const nb = raiz.querySelector('#nuevo');
    if (nb) nb.onclick = () => modal(`<h2>Iniciar inventario</h2><form id="fi"><div class="campos">
      <div class="campo"><label class="req">Año</label><input name="anio" type="number" value="${new Date().getFullYear()}" required></div>
      <div class="campo"><label class="req">Fecha de corte</label><input name="fecha_corte" type="date" value="${new Date().getFullYear()}-12-31" required></div>
      <div class="campo ancho"><label class="req">Comisión de inventario (integrantes)</label><input name="comision" required></div>
      <div class="campo ancho"><label>Documento de conformación</label><input name="documento" placeholder="Resolución / memorando N°…"></div></div>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Iniciar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fi').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const inv = { id: `INVENT-${fd.get('anio')}-${String(S.inventarios.filter((i) => String(i.anio) === fd.get('anio')).length + 1).padStart(2, '0')}`,
          anio: Number(fd.get('anio')), fecha_corte: fd.get('fecha_corte'), comision: Core.limpiar(fd.get('comision')), documento: Core.limpiar(fd.get('documento')),
          estado: 'ABIERTO', verif: {}, sobrantes: [], creado: new Date().toISOString() };
        await DB.escribir([{ store: 'inventarios', valor: inv }, DB.opBitacora(S.usuario.usuario, 'INVENTARIO_INICIO', inv.id)]);
        cerrar(); await recargar(); location.hash = '#/inventario/' + inv.id;
      };
    });
  }

  function vistaInventario(id) {
    const inv = S.inventarios.find((i) => i.id === id);
    if (!inv) return marco('<div class="aviso bad">Inventario no encontrado.</div>');
    const editable = inv.estado === 'ABIERTO' && puede.registrar();
    const universo = S.bienes.filter((b) => ['ACTIVO', 'EN_SALIDA', 'FALTANTE'].includes(b.situacion));
    // Un inventario cerrado se muestra con la foto de resultados tomada al cierre
    const r = inv.resultados ? {
      conformes: inv.resultados.conformes.map((c) => S.porCodigo[c]).filter(Boolean),
      faltantes: inv.resultados.faltantes.map((c) => S.porCodigo[c]).filter(Boolean),
      sinVerificar: inv.resultados.sinVerificar.map((c) => S.porCodigo[c]).filter(Boolean),
      diferencias: inv.resultados.diferencias.filter((d) => S.porCodigo[d.codigo]).map((d) => ({ bien: S.porCodigo[d.codigo], cambios: d.cambios }))
    } : Core.resultadosInventario(universo, inv.verif || {});
    const nUniverso = r.conformes.length + r.faltantes.length + r.diferencias.length + r.sinVerificar.length;
    const avance = nUniverso ? Math.round((nUniverso - r.sinVerificar.length) / nUniverso * 100) : 0;
    marco(`<div class="barra"><h1>Inventario ${esc(inv.id)}</h1>
      <button class="btn" id="inf">Imprimir informe</button>
      ${editable ? '<button class="btn" id="sob">+ Registrar sobrante</button><button class="btn primario" id="cer">Cerrar inventario</button>' : ''}</div>
      <div class="kpis"><div class="kpi"><div class="v">${avance}%</div><div class="l">Avance (${nUniverso - r.sinVerificar.length}/${nUniverso})</div></div>
        <div class="kpi"><div class="v">${r.conformes.length}</div><div class="l">Conformes</div></div>
        <div class="kpi"><div class="v">${r.diferencias.length}</div><div class="l">Con diferencias</div></div>
        <div class="kpi"><div class="v">${r.faltantes.length}</div><div class="l">Faltantes</div></div>
        <div class="kpi"><div class="v">${(inv.sobrantes || []).length}</div><div class="l">Sobrantes</div></div></div>
      ${editable ? `<div class="tarjeta"><h2>Verificación física</h2>
        <p class="muted pequeno">Elija la ubicación a recorrer; marque cada bien encontrado y corrija estado, ubicación o responsable si difiere. Los cambios se guardan al instante.</p>
        <div class="filtros"><select id="iu">${opciones(S.ubic.map((u) => u.nombre), '', 'Seleccione ubicación…')}</select><input id="iq" placeholder="Buscar por código o denominación (para bienes de otra ubicación)">
        <button class="btn" id="todosOk" type="button">Marcar todos como encontrados</button></div>
        <div class="tabla-wrap"><table><thead><tr><th>Encontrado</th><th>Código</th><th>Denominación</th><th>Serie</th><th>Estado verificado</th><th>Ubicación verificada</th><th>Responsable verificado</th></tr></thead>
        <tbody id="it"><tr><td colspan="7" class="muted">Seleccione una ubicación.</td></tr></tbody></table></div></div>`
        : `<div class="aviso ${inv.estado === 'CERRADO' ? 'ok' : 'info'}">${inv.estado === 'CERRADO' ? `Inventario cerrado el ${fecha(inv.cerrado)}. Regularización: ${esc(inv.movimiento || '—')}.` : 'Solo lectura.'}</div>`}`);
    raiz.querySelector('#inf').onclick = () => Formatos.imprimir(Formatos.informeInventario(inv, r, ctx()));
    if (!editable) return;

    const guardarInv = async (accion) => { await DB.escribir([{ store: 'inventarios', valor: inv }].concat(accion ? [DB.opBitacora(S.usuario.usuario, accion, inv.id)] : [])); };
    let lista = [];
    const pintar = () => {
      const u = val(raiz, '#iu'); const q = val(raiz, '#iq').toLowerCase();
      lista = universo.filter((b) => q ? [b.codigo, b.descripcion, b.serie, b.codigo_interno].join(' ').toLowerCase().includes(q) : (u && b.ubicacion === u)).slice(0, 300);
      raiz.querySelector('#it').innerHTML = lista.map((b) => {
        const v = inv.verif[b.codigo] || {};
        return `<tr data-c="${esc(b.codigo)}"><td><select data-k="encontrado" style="width:auto">${opciones([['', '—'], ['si', 'Sí'], ['no', 'No']], v.encontrado === undefined ? '' : (v.encontrado ? 'si' : 'no'))}</select></td>
          <td class="mono">${esc(b.codigo)}</td><td>${esc(b.descripcion)}${b.situacion !== 'ACTIVO' ? ' ' + chipSituacion(b.situacion) : ''}</td><td>${esc(b.serie)}</td>
          <td><select data-k="estado">${opciones(Core.ESTADOS_CONSERVACION, v.estado || b.estado)}</select></td>
          <td><select data-k="ubicacion">${opciones(S.ubic.map((x) => x.nombre), v.ubicacion || b.ubicacion)}</select></td>
          <td><select data-k="responsable">${opciones(S.personal.map((p) => [p.id, p.nombres]), v.responsable !== undefined ? v.responsable : b.responsable, '— Sin responsable')}</select></td></tr>`;
      }).join('') || '<tr><td colspan="7" class="muted">Sin bienes para el filtro.</td></tr>';
    };
    const registrar = (tr) => {
      const c = tr.dataset.c; const b = S.porCodigo[c];
      const enc = tr.querySelector('[data-k=encontrado]').value;
      if (!enc) { delete inv.verif[c]; return; }
      inv.verif[c] = enc === 'no' ? { encontrado: false, fecha: Core.hoyISO(), usuario: S.usuario.usuario } : {
        encontrado: true, estado: tr.querySelector('[data-k=estado]').value, ubicacion: tr.querySelector('[data-k=ubicacion]').value,
        responsable: tr.querySelector('[data-k=responsable]').value, fecha: Core.hoyISO(), usuario: S.usuario.usuario
      };
    };
    raiz.querySelector('#iu').onchange = () => { raiz.querySelector('#iq').value = ''; pintar(); };
    raiz.querySelector('#iq').oninput = pintar;
    raiz.querySelector('#it').onchange = async (e) => {
      const tr = e.target.closest('tr[data-c]'); if (!tr) return;
      if (e.target.dataset.k !== 'encontrado' && !tr.querySelector('[data-k=encontrado]').value) tr.querySelector('[data-k=encontrado]').value = 'si';
      registrar(tr); await guardarInv();
    };
    raiz.querySelector('#todosOk').onclick = async () => {
      raiz.querySelectorAll('#it tr[data-c]').forEach((tr) => { const s = tr.querySelector('[data-k=encontrado]'); if (!s.value) { s.value = 'si'; registrar(tr); } });
      await guardarInv(); toast('Bienes visibles marcados como encontrados.'); vistaInventario(id);
    };
    raiz.querySelector('#sob').onclick = () => modal(`<h2>Registrar bien sobrante</h2><p class="muted pequeno">Bien encontrado sin registro patrimonial. Luego debe incorporarse mediante Alta por "Sobrante de inventario".</p>
      <form id="fs"><div class="campos"><div class="campo ancho"><label class="req">Descripción</label><input name="descripcion" required></div>
      <div class="campo"><label>Marca</label><input name="marca"></div><div class="campo"><label>Serie</label><input name="serie"></div>
      <div class="campo"><label>Ubicación</label><select name="ubicacion">${opciones(S.ubic.map((x) => x.nombre))}</select></div>
      <div class="campo"><label>Código patrimonial (si tiene etiqueta)</label><input name="codigo"></div><div class="campo ancho"><label>Observaciones</label><input name="obs"></div></div>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Agregar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fs').onsubmit = async (e) => {
        e.preventDefault(); const fd = new FormData(e.target); const o = {};
        ['descripcion', 'marca', 'serie', 'ubicacion', 'codigo', 'obs'].forEach((k) => { o[k] = Core.limpiar(fd.get(k)); });
        inv.sobrantes = (inv.sobrantes || []).concat([o]); await guardarInv('INVENTARIO_SOBRANTE'); cerrar(); await recargar(); vistaInventario(id);
      };
    });
    raiz.querySelector('#cer').onclick = () => {
      // recalcular: la verificación pudo cambiar después de pintar la vista
      const r = Core.resultadosInventario(universo, inv.verif || {});
      const reg = Core.regularizacionInventario(r);
      modal(`<h2>Cerrar inventario</h2>
        ${r.sinVerificar.length ? `<div class="aviso warn">Hay ${r.sinVerificar.length} bienes sin verificar. No se modificarán; quedarán reportados en el informe.</div>` : ''}
        <p>Se registrará un movimiento de regularización con ${Object.keys(reg).length} bien(es): ${r.diferencias.length} con diferencias y ${r.faltantes.length} faltantes
        (pasarán a situación "Faltante"). Esta acción no se puede deshacer desde el inventario.</p>
        <div class="barra"><button class="btn primario" id="ok">Cerrar inventario</button><button class="btn" data-cerrar>Cancelar</button></div>`,
      (m, cerrar) => {
        m.querySelector('#ok').onclick = async () => {
          if (Object.keys(reg).length) {
            inv.movimiento = await registrarMovimiento({ tipo: 'INVENTARIO', fecha: Core.hoyISO(), items: Object.keys(reg), regularizacion: reg,
              documento: inv.documento, motivo: `Cierre del inventario ${inv.id} (corte ${fecha(inv.fecha_corte)})` });
          }
          const cods = (a) => a.map((b) => b.codigo);
          inv.resultados = { conformes: cods(r.conformes), faltantes: cods(r.faltantes), sinVerificar: cods(r.sinVerificar),
            diferencias: r.diferencias.map((d) => ({ codigo: d.bien.codigo, cambios: d.cambios })) };
          inv.estado = 'CERRADO'; inv.cerrado = Core.hoyISO();
          await guardarInv('INVENTARIO_CIERRE'); cerrar(); await recargar(); toast('Inventario cerrado.'); vistaInventario(id);
        };
      });
    };
  }

  // ---------------- Reportes ----------------
  function vistaReportes() {
    const k = Core.indicadores(S.bienes, S.movs, S.cfg.uit);
    const porResp = S.personal.map((p) => ({ p, bienes: S.bienes.filter((b) => b.responsable === p.id && b.situacion !== 'DISPUESTO') })).filter((x) => x.bienes.length);
    marco(`<div class="barra"><h1>Reportes</h1></div>
      <div class="grid g2">
        <div class="tarjeta"><h2>Exportaciones</h2><div class="barra">
          <button class="btn" id="r1">Inventario completo (Excel)</button>
          <button class="btn" id="r2">Resumen por ubicación (Excel)</button>
          <button class="btn" id="r3">Bienes candidatos a baja (Excel)</button>
          <button class="btn" id="r4">Calidad de datos (Excel)</button></div></div>
        <div class="tarjeta"><h2>Calidad del registro</h2><table><tbody>
          <tr><td>Sin servidor responsable</td><td class="num">${k.sinResponsable}</td></tr><tr><td>"SIN UBICACION"</td><td class="num">${k.sinUbicacion}</td></tr>
          <tr><td>Sin código interno</td><td class="num">${k.sinCodigoInterno}</td></tr><tr><td>Sin número de serie</td><td class="num">${k.sinSerie}</td></tr>
          <tr><td>Origen no determinado</td><td class="num">${k.origenNoDeterminado}</td></tr></tbody></table></div></div>
      <div class="tarjeta"><h2>Relación de bienes por servidor responsable</h2>
        ${porResp.length ? `<div class="tabla-wrap"><table><thead><tr><th>Servidor</th><th>Cargo</th><th class="num">Bienes</th><th class="num">Valor</th><th></th></tr></thead><tbody>
        ${porResp.map((x) => `<tr><td>${esc(x.p.nombres)}</td><td>${esc(x.p.cargo)}</td><td class="num">${x.bienes.length}</td><td class="num">${soles(x.bienes.reduce((s, b) => s + Number(b.valor || 0), 0))}</td>
        <td><button class="btn chico" data-p="${esc(x.p.id)}">Imprimir relación</button></td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted">Aún no hay bienes asignados a servidores. Use el movimiento "Asignación en uso".</p>'}</div>`);
    const hoy = Core.hoyISO();
    raiz.querySelector('#r1').onclick = () => descargarExcel(`inventario_${hoy}.xlsx`, { Inventario: S.bienes.map(filaExport) });
    raiz.querySelector('#r2').onclick = () => {
      const g = {};
      S.bienes.filter((b) => !['DISPUESTO', 'BAJA'].includes(b.situacion)).forEach((b) => {
        const x = g[b.ubicacion] = g[b.ubicacion] || { ubicacion: b.ubicacion, bienes: 0, valor: 0, Bueno: 0, Regular: 0, Malo: 0, Otros: 0 };
        x.bienes++; x.valor += Number(b.valor || 0); x[['Bueno', 'Regular', 'Malo'].includes(b.estado) ? b.estado : 'Otros']++;
      });
      descargarExcel(`resumen_ubicacion_${hoy}.xlsx`, { 'Por ubicación': Object.values(g).sort((a, b) => b.bienes - a.bienes) });
    };
    raiz.querySelector('#r3').onclick = () => descargarExcel(`candidatos_baja_${hoy}.xlsx`, {
      Candidatos: S.bienes.filter((b) => b.situacion === 'ACTIVO' && ['Malo', 'RAEE', 'Chatarra'].includes(b.estado)).map((b) => Object.assign(filaExport(b), {
        causal_sugerida: b.estado === 'RAEE' ? 'Residuos de aparatos eléctricos y electrónicos (RAEE)' : 'Mantenimiento o reparación onerosa / Obsolescencia técnica (requiere informe técnico)' }))
    });
    raiz.querySelector('#r4').onclick = () => descargarExcel(`calidad_datos_${hoy}.xlsx`, {
      Observaciones: S.bienes.filter((b) => b.situacion !== 'DISPUESTO').map((b) => ({ codigo_patrimonial: b.codigo, descripcion: b.descripcion,
        sin_responsable: b.responsable ? '' : 'X', sin_ubicacion: (!b.ubicacion || b.ubicacion === 'SIN UBICACION') ? 'X' : '', sin_codigo_interno: b.codigo_interno ? '' : 'X',
        origen_no_determinado: b.origen === 'NO_DETERMINADO' ? 'X' : '', sin_orden_compra: b.nro_orden ? '' : 'X' }))
    });
    raiz.querySelectorAll('[data-p]').forEach((btn) => {
      btn.onclick = () => { const x = porResp.find((y) => y.p.id === btn.dataset.p); Formatos.imprimir(Formatos.relacionResponsable(x.p, x.bienes, ctx())); };
    });
  }

  // ---------------- Maestros ----------------
  function vistaMaestros() {
    const ed = puede.registrar();
    marco(`<div class="barra"><h1>Personal y ubicaciones</h1></div><div class="grid g2">
      <div class="tarjeta"><div class="barra"><h2 style="flex:1;margin:0">Personal (servidores responsables)</h2>${ed ? '<button class="btn" id="np">+ Agregar</button>' : ''}</div>
        <div class="tabla-wrap"><table><thead><tr><th>Nombres</th><th>DNI</th><th>Cargo</th><th>Condición</th><th class="num">Bienes</th><th></th></tr></thead><tbody>
        ${S.personal.map((p) => `<tr><td>${esc(p.nombres)}${p.activo ? '' : ' <span class="chip">Inactivo</span>'}</td><td>${esc(p.dni)}</td><td>${esc(p.cargo)}</td><td>${esc(p.condicion)}</td>
          <td class="num">${S.bienes.filter((b) => b.responsable === p.id && b.situacion !== 'DISPUESTO').length}</td><td>${ed ? `<button class="btn chico" data-ep="${esc(p.id)}">Editar</button>` : ''}</td></tr>`).join('') ||
          '<tr><td colspan="6" class="muted">Sin registros.</td></tr>'}</tbody></table></div></div>
      <div class="tarjeta"><div class="barra"><h2 style="flex:1;margin:0">Ubicaciones físicas</h2>${ed ? '<button class="btn" id="nu">+ Agregar</button>' : ''}</div>
        <div class="tabla-wrap"><table><thead><tr><th>Ubicación</th><th>Piso</th><th class="num">Bienes</th><th></th></tr></thead><tbody>
        ${S.ubic.map((u) => `<tr><td>${esc(u.nombre)}${u.activo ? '' : ' <span class="chip">Inactiva</span>'}</td><td>${esc(u.piso)}</td>
          <td class="num">${S.bienes.filter((b) => b.ubicacion === u.nombre && !['DISPUESTO'].includes(b.situacion)).length}</td>
          <td>${ed ? `<button class="btn chico" data-eu="${esc(u.nombre)}">Editar</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div></div>`);
    if (!ed) return;
    const formPersona = (p) => modal(`<h2>${p ? 'Editar' : 'Agregar'} servidor</h2><form id="fp"><div class="campos">
      <div class="campo ancho"><label class="req">Apellidos y nombres</label><input name="nombres" value="${esc(p && p.nombres)}" required></div>
      <div class="campo"><label class="req">DNI</label><input name="dni" value="${esc(p && p.dni)}" pattern="\\d{8}" maxlength="8" required></div>
      <div class="campo"><label>Cargo / servicio</label><input name="cargo" value="${esc(p && p.cargo)}"></div>
      <div class="campo"><label>Condición laboral</label><select name="condicion">${opciones(['D.L. 276', 'D.L. 1057 (CAS)', 'Contrato CLAS (régimen privado)', 'Locación de servicios', 'SERUMS', 'Otro'], p && p.condicion, '—')}</select></div>
      <div class="campo"><label>Activo</label><select name="activo">${opciones([['1', 'Sí'], ['0', 'No (cesado)']], p && !p.activo ? '0' : '1')}</select></div></div>
      ${p && !p.activo ? '' : '<p class="muted pequeno">Antes de marcar a un servidor como cesado, registre la devolución de sus bienes.</p>'}
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fp').onsubmit = async (e) => {
        e.preventDefault(); const fd = new FormData(e.target);
        const dni = Core.limpiar(fd.get('dni'));
        if (S.personal.some((x) => x.dni === dni && (!p || x.id !== p.id))) return toast('Ya existe un servidor con ese DNI.');
        const activo = fd.get('activo') === '1';
        if (p && !activo && S.bienes.some((b) => b.responsable === p.id && !['DISPUESTO', 'BAJA'].includes(b.situacion))) {
          return toast('El servidor aún tiene bienes asignados. Registre primero la devolución.');
        }
        const o = Object.assign({}, p || { id: 'P' + Date.now().toString(36) }, { nombres: Core.limpiar(fd.get('nombres')).toUpperCase(), dni, cargo: Core.limpiar(fd.get('cargo')), condicion: fd.get('condicion'), activo });
        await DB.escribir([{ store: 'personal', valor: o }, DB.opBitacora(S.usuario.usuario, p ? 'EDICION_PERSONAL' : 'ALTA_PERSONAL', `${o.dni} ${o.nombres}`)]);
        cerrar(); await recargar(); vistaMaestros();
      };
    });
    const formUbic = (u) => modal(`<h2>${u ? 'Editar' : 'Agregar'} ubicación</h2><form id="fu"><div class="campos">
      <div class="campo ancho"><label class="req">Nombre</label><input name="nombre" value="${esc(u && u.nombre)}" ${u ? 'readonly' : ''} required></div>
      <div class="campo"><label>Piso</label><input name="piso" value="${esc(u && u.piso)}"></div>
      <div class="campo"><label>Activa</label><select name="activo">${opciones([['1', 'Sí'], ['0', 'No']], u && !u.activo ? '0' : '1')}</select></div></div>
      ${u ? '<p class="muted pequeno">El nombre no se edita para no romper la trazabilidad; para unificar ubicaciones use un Desplazamiento y desactive la antigua.</p>' : ''}
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fu').onsubmit = async (e) => {
        e.preventDefault(); const fd = new FormData(e.target);
        const nombre = Core.limpiar(fd.get('nombre')).toUpperCase();
        if (!u && S.ubic.some((x) => x.nombre === nombre)) return toast('La ubicación ya existe.');
        await DB.escribir([{ store: 'ubicaciones', valor: { nombre, piso: Core.limpiar(fd.get('piso')), activo: fd.get('activo') === '1' } },
          DB.opBitacora(S.usuario.usuario, u ? 'EDICION_UBICACION' : 'ALTA_UBICACION', nombre)]);
        cerrar(); await recargar(); vistaMaestros();
      };
    });
    raiz.querySelector('#np').onclick = () => formPersona(null);
    raiz.querySelector('#nu').onclick = () => formUbic(null);
    raiz.querySelectorAll('[data-ep]').forEach((b) => { b.onclick = () => formPersona(S.personal.find((p) => p.id === b.dataset.ep)); });
    raiz.querySelectorAll('[data-eu]').forEach((b) => { b.onclick = () => formUbic(S.ubic.find((u) => u.nombre === b.dataset.eu)); });
  }

  // ---------------- Bitácora ----------------
  async function vistaBitacora() {
    if (!puede.administrar()) return marco('<div class="aviso bad">Acceso restringido.</div>');
    const reg = (await DB.todos('bitacora')).reverse();
    marco(`<div class="barra"><h1>Bitácora de auditoría</h1><button class="btn" id="exp">Exportar</button></div>
      <p class="muted pequeno">Registro inalterable desde la aplicación: ingresos, ediciones, movimientos, anulaciones, cargas y restauraciones.</p>
      <div class="tabla-wrap"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>
      ${reg.slice(0, 1000).map((r) => `<tr><td style="white-space:nowrap">${new Date(r.fecha).toLocaleString('es-PE')}</td><td>${esc(r.usuario)}</td><td>${esc(r.accion)}</td><td>${esc(r.detalle)}</td></tr>`).join('')}
      </tbody></table></div>`);
    raiz.querySelector('#exp').onclick = () => descargarExcel(`bitacora_${Core.hoyISO()}.xlsx`, { Bitacora: reg });
  }

  // ---------------- Configuración ----------------
  async function vistaConfig() {
    if (!puede.administrar()) return marco('<div class="aviso bad">Acceso restringido.</div>');
    const usuarios = await DB.todos('usuarios');
    const c = S.cfg;
    const campos = [['entidad', 'Entidad'], ['establecimiento', 'Establecimiento'], ['red', 'Red / Unidad Ejecutora'], ['ubigeo', 'Ubicación'],
      ['ruc', 'RUC'], ['jefe', 'Jefe(a) / Gerente'], ['responsable_patrimonio', 'Responsable de Control Patrimonial'], ['uit', 'Valor UIT (S/)'], ['uit_anio', 'Año de la UIT']];
    marco(`<div class="barra"><h1>Configuración</h1></div>
      <div class="tarjeta"><h2>Datos institucionales</h2><form id="fc"><div class="campos">
        ${campos.map(([k, l]) => `<div class="campo"><label>${l}</label><input name="${k}" value="${esc(c[k])}" ${k.startsWith('uit') ? 'type="number" step="1"' : ''}></div>`).join('')}</div>
        <p class="muted pequeno">La UIT se usa para la clasificación contable referencial (1/4 UIT). Actualícela cada año según el decreto supremo correspondiente.</p>
        <button class="btn primario">Guardar</button></form></div>
      <div class="tarjeta"><h2>Carga del inventario</h2>
        <p class="pequeno">Importa un Excel con las columnas del inventario institucional (codigo_patrimonial, codigo_INTERNO, descripcion, MARCA, modelo, nro_serie, medidas, color,
        ESTADO CONSERVACION, nombre_depend, ubicac_fisica, nro_orden, fecha_compra, valor_inicial). Los códigos ya registrados se omiten.</p>
        <div class="barra"><button class="btn" id="semilla" ${S.bienes.length ? 'disabled' : ''}>Cargar inventario 2025 incluido (537 bienes)</button>
        <label class="btn" style="margin:0">Importar Excel…<input type="file" id="xls" accept=".xlsx,.xls" hidden></label></div></div>
      <div class="tarjeta"><h2>Respaldo</h2>
        <p class="pequeno">Los datos se guardan en este navegador. Descargue un respaldo al menos una vez por semana y guárdelo en un medio institucional.</p>
        <div class="barra"><button class="btn primario" id="resp">Descargar respaldo (JSON)</button>
        <label class="btn peligro" style="margin:0">Restaurar respaldo…<input type="file" id="rest" accept=".json" hidden></label></div></div>
      <div class="tarjeta"><div class="barra"><h2 style="flex:1;margin:0">Usuarios</h2><button class="btn" id="nus">+ Agregar usuario</button></div>
        <div class="tabla-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
        ${usuarios.map((u) => `<tr><td>${esc(u.usuario)}</td><td>${esc(u.nombre)}</td><td>${ROLES[u.rol]}</td><td>${u.activo ? 'Activo' : 'Inactivo'}</td>
          <td>${u.usuario !== S.usuario.usuario ? `<button class="btn chico" data-u="${esc(u.usuario)}">${u.activo ? 'Desactivar' : 'Activar'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`);
    raiz.querySelector('#fc').onsubmit = async (e) => {
      e.preventDefault(); const fd = new FormData(e.target); const n = {};
      campos.forEach(([k]) => { n[k] = k.startsWith('uit') ? Number(fd.get(k)) : Core.limpiar(fd.get(k)); });
      await DB.guardarConfig(n); await DB.escribir([DB.opBitacora(S.usuario.usuario, 'CONFIGURACION', JSON.stringify(n))]);
      await recargar(); toast('Configuración guardada.');
    };
    raiz.querySelector('#semilla').onclick = async () => {
      try {
        const filas = await (await fetch('data/inventario-2025.json')).json();
        const r = await DB.cargarInventarioInicial(filas, S.usuario.usuario, 'INVENTARIO_CLAS_QUERENCIA_2025.xlsx');
        await recargar(); toast(`${r.cargados} bienes cargados; ${r.omitidos} omitidos.`); vistaConfig();
      } catch (err) { toast('No se pudo leer el archivo incluido. Si abrió la app con doble clic, use "Importar Excel".'); }
    };
    raiz.querySelector('#xls').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (typeof XLSX === 'undefined') return toast('No se pudo cargar la librería de Excel.');
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
      const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true });
      const r = await DB.cargarInventarioInicial(filas, S.usuario.usuario, f.name);
      await recargar(); toast(`${r.cargados} bienes cargados; ${r.omitidos} omitidos.`); vistaConfig();
    };
    raiz.querySelector('#resp').onclick = async () => {
      descargarJSON(`respaldo_inventario_${Core.hoyISO()}.json`, await DB.exportarTodo());
      await DB.escribir([DB.opBitacora(S.usuario.usuario, 'RESPALDO', 'Respaldo descargado')]);
    };
    raiz.querySelector('#rest').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      modal(`<h2>Restaurar respaldo</h2><div class="aviso bad">Se reemplazarán TODOS los datos actuales por los del archivo "${esc(f.name)}".</div>
        <div class="barra"><button class="btn peligro" id="ok">Restaurar</button><button class="btn" data-cerrar>Cancelar</button></div>`, (m, cerrar) => {
        m.querySelector('#ok').onclick = async () => {
          try { await DB.restaurarTodo(JSON.parse(await f.text()), S.usuario.usuario); cerrar(); salir(); toast('Respaldo restaurado. Ingrese nuevamente.'); }
          catch (err) { toast(err.message); }
        };
      });
    };
    raiz.querySelector('#nus').onclick = () => modal(`<h2>Agregar usuario</h2><form id="fu"><div class="campos">
      <div class="campo"><label class="req">Usuario</label><input name="usuario" pattern="[a-z0-9._]{3,}" required></div>
      <div class="campo"><label class="req">Nombre</label><input name="nombre" required></div>
      <div class="campo"><label class="req">Rol</label><select name="rol">${opciones(Object.entries(ROLES), 'CONSULTA')}</select></div>
      <div class="campo"><label class="req">Clave temporal (mín. 8)</label><input name="clave" type="password" minlength="8" required></div></div>
      <p class="muted pequeno">El usuario deberá cambiar la clave en su primer ingreso.</p>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Crear</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fu').onsubmit = async (e) => {
        e.preventDefault(); const fd = new FormData(e.target); const u = Core.limpiar(fd.get('usuario')).toLowerCase();
        if (await DB.obtener('usuarios', u)) return toast('El usuario ya existe.');
        await DB.crearUsuario(u, Core.limpiar(fd.get('nombre')), fd.get('rol'), fd.get('clave'), true);
        await DB.escribir([DB.opBitacora(S.usuario.usuario, 'ALTA_USUARIO', `${u} (${fd.get('rol')})`)]);
        cerrar(); vistaConfig();
      };
    });
    raiz.querySelectorAll('[data-u]').forEach((b) => {
      b.onclick = async () => {
        const u = await DB.obtener('usuarios', b.dataset.u); u.activo = !u.activo;
        await DB.escribir([{ store: 'usuarios', valor: u }, DB.opBitacora(S.usuario.usuario, u.activo ? 'ACTIVA_USUARIO' : 'DESACTIVA_USUARIO', u.usuario)]);
        vistaConfig();
      };
    });
  }

  // ---------------- Enrutador ----------------
  function enrutar() {
    if (!S.usuario) return pantallaLogin();
    if (S.usuario.debeCambiar) return dialogoClave(true);
    const [ruta, query] = (location.hash || '#/panel').split('?');
    const partes = ruta.split('/');
    const q = new URLSearchParams(query || '');
    const id = decodeURIComponent(partes[2] || '');
    window.scrollTo(0, 0);
    switch (partes[1]) {
      case 'bienes': return vistaBienes(q);
      case 'bien': return vistaBien(id);
      case 'movimientos': return vistaMovimientos(q);
      case 'nuevo': return vistaNuevo(id);
      case 'movimiento': return vistaMovimiento(id);
      case 'inventario': return id ? vistaInventario(id) : vistaInventarios();
      case 'reportes': return vistaReportes();
      case 'maestros': return vistaMaestros();
      case 'bitacora': return vistaBitacora();
      case 'config': return vistaConfig();
      default: return vistaPanel();
    }
  }

  async function iniciar() {
    try {
      await DB.inicializar();
      await recargar();
      const u = sessionStorage.getItem('gi_usuario');
      if (u) { const r = await DB.obtener('usuarios', u); if (r && r.activo) S.usuario = r; }
      window.addEventListener('hashchange', enrutar);
      enrutar();
    } catch (e) {
      raiz.innerHTML = `<div class="login"><div class="tarjeta"><div class="aviso bad">No se pudo abrir la base de datos local: ${esc(e.message)}.
        Use un navegador actualizado (Chrome, Edge o Firefox) fuera del modo incógnito.</div></div></div>`;
    }
  }
  iniciar();
})();
