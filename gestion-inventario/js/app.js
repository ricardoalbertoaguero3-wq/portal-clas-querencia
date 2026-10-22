/* =====================================================================
 * app.js — Interfaz del aplicativo (vistas, navegación, permisos)
 * Organizada según los Títulos de la Directiva N° 0006-2021-EF/54.01.
 * ===================================================================== */
(function () {
  'use strict';
  const { esc, soles, fecha } = Formatos;
  const raiz = document.getElementById('raiz');

  /* Roles alineados con los responsables de la Directiva (art. 4.1):
   * OCP registra los actos; la Comisión de Inventario ejecuta el inventario (arts. 32–35);
   * Consulta corresponde a la OGA / Jefatura (supervisión, art. 6). */
  const ROLES = { ADMIN: 'Administrador del sistema', PATRIMONIO: 'Control Patrimonial (OCP)', COMISION: 'Comisión de Inventario', CONSULTA: 'Consulta (Gerencia / Consejo Directivo / OGA)' };
  const puede = {
    registrar: () => ['ADMIN', 'PATRIMONIO'].includes(S.usuario.rol),
    inventariar: () => ['ADMIN', 'PATRIMONIO', 'COMISION'].includes(S.usuario.rol),
    administrar: () => S.usuario.rol === 'ADMIN'
  };

  const S = { usuario: null, cfg: null, bienes: [], porCodigo: {}, movs: [], personal: [], ubic: [], inventarios: [], adjuntos: [] };
  let R = null; // capa de datos: Repo servidor o local (ver repo.js)
  /** Ejecuta una operación del repositorio y muestra los errores de negocio */
  async function intentar(fn, alError) {
    try { return await fn(); } catch (e) { if (alError) alError(e); else toast((e.errores && e.errores.join(' ')) || e.message); return undefined; }
  }
  const ORIGEN_ANTERIOR = { PROPIO: 'CLAS', AFECTADO: 'AFECTACION', TRANSFERENCIA: 'UE' };

  async function recargar() {
    const d = await R.cargarEstado();
    S.cfg = d.config;
    S.bienes = d.bienes.map((b) => (ORIGEN_ANTERIOR[b.origen] ? Object.assign(b, { origen: ORIGEN_ANTERIOR[b.origen] }) : b));
    S.porCodigo = Object.fromEntries(S.bienes.map((b) => [b.codigo, b]));
    S.movs = d.movimientos.sort((a, b) => (b.registrado || '').localeCompare(a.registrado || ''));
    S.personal = d.personal.sort((a, b) => a.nombres.localeCompare(b.nombres));
    S.ubic = d.ubicaciones.sort((a, b) => a.nombre.localeCompare(b.nombre));
    S.inventarios = d.inventarios.sort((a, b) => b.id.localeCompare(a.id));
    S.adjuntos = d.adjuntos || [];
  }
  const persona = (id) => S.personal.find((x) => x.id === id) || (id ? { nombres: id } : {});
  const nombrePersona = (id) => persona(id).nombres || '';
  const ctx = (extra) => Object.assign({ config: S.cfg, nombrePersona, persona }, extra || {});

  // ---------------- Utilidades de UI ----------------
  function toast(msg) {
    document.querySelectorAll('.toast').forEach((x) => x.remove());
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 4000);
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
    lista.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(t)}</option>`; }).join('');
  const chipEstado = (e) => `<span class="chip ${{ Nuevo: 'ok', Bueno: 'ok', Regular: 'warn', Malo: 'bad', RAEE: 'bad', Chatarra: 'bad' }[e] || ''}">${esc(e)}</span>`;
  const chipSituacion = (s) => `<span class="chip ${{ ACTIVO: 'info', EN_SALIDA: 'warn', AFECTADO: 'warn', FALTANTE: 'bad', BAJA: 'bad', DISPUESTO: '' }[s] || ''}">${esc((Core.SITUACIONES[s] || s).split(' (')[0])}</span>`;
  const ref = (t) => `<span class="ref">${esc(t)}</span>`;
  const val = (el, sel) => { const e = el.querySelector(sel); return e ? e.value.trim() : ''; };
  const opcPersonal = (soloActivos) => S.personal.filter((p) => !soloActivos || p.activo).map((p) => [p.id, `${p.nombres}${p.unidad || p.cargo ? ' — ' + (p.unidad || p.cargo) : ''}`]);
  const opcUbic = (soloActivas) => S.ubic.filter((u) => !soloActivas || u.activo).map((u) => u.nombre);
  const sumaValor = (arr) => arr.reduce((s, b) => s + Number(b.valor || 0), 0);

  function barras(obj, max) {
    const filas = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, max || 10);
    const tope = Math.max(1, ...filas.map((f) => f[1]));
    return `<div class="barras">${filas.map(([k, v]) => `<div class="barra-fila" title="${esc(k)}: ${v}">
      <span class="et">${esc(k)}</span><span class="pista"><div class="relleno" style="width:${(v / tope) * 100}%"></div></span>
      <span class="val">${v}</span></div>`).join('')}</div>`;
  }
  function descargarExcel(nombre, hojas) {
    if (typeof XLSX === 'undefined') { toast('No se pudo cargar la librería de Excel.'); return; }
    const wb = XLSX.utils.book_new();
    Object.entries(hojas).forEach(([n, filas]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas.length ? filas : [{ sin_datos: '' }]), n.slice(0, 31)));
    XLSX.writeFile(wb, nombre);
  }
  function descargarJSON(nombre, datos) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(datos)], { type: 'application/json' }));
    a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const filaExport = (b) => ({
    codigo_patrimonial: b.codigo, codigo_interno: b.codigo_interno, denominacion: b.descripcion, marca: b.marca, modelo: b.modelo,
    serie: b.serie, dimensiones: b.medidas, color: b.color, estado_conservacion: b.estado, situacion: Core.SITUACIONES[b.situacion],
    ubicacion_fisica: b.ubicacion, usuario: nombrePersona(b.responsable), titularidad: Core.ORIGENES[b.origen], nro_orden: b.nro_orden,
    fecha_adquisicion: b.fecha_adquisicion, valor: b.valor, cuenta_contable: b.cuenta_contable, clasificacion_ref: Core.clasificacionContable(b.valor, S.cfg.uit),
    poliza: b.poliza, poliza_vence: b.poliza_vence, fecha_baja: b.fecha_baja, causal_baja: b.causal_baja, resolucion_baja: b.resolucion_baja,
    afectataria: b.afectataria, afectacion_vence: b.afectacion_vence, ultimo_mantenimiento: b.ultimo_mantenimiento, observaciones: b.observaciones
  });

  // ---------------- Estructura ----------------
  const MENU = [
    ['#/panel', 'Panel'],
    ['Registro patrimonial'], ['#/bienes', 'Bienes', '', 'Tít. III'], ['#/etiquetas', 'Etiquetas', '', 'Art. 20'],
    ['Actos'], ['#/actos', 'Registrar acto', '', 'Tít. III–IX'], ['#/movimientos', 'Historial de actos'],
    ['Control'], ['#/inventario', 'Inventario y supervisión', '', 'Tít. V y X'], ['#/saneamiento', 'Saneamiento', '', 'Tít. VI'], ['#/mantenimiento', 'Mantenimiento y seguros', '', 'Tít. IX'],
    ['Gestión'], ['#/reportes', 'Reportes'], ['#/maestros', 'Usuarios y ubicaciones'], ['#/normativa', 'Marco normativo'],
    ['#/bitacora', 'Bitácora', 'admin'], ['#/config', 'Configuración', 'admin']
  ];
  function marco(contenido) {
    const ruta = location.hash.split('?')[0].split('/').slice(0, 2).join('/') || '#/panel';
    raiz.innerHTML = `<div class="app"><nav class="nav" id="nav">
      <div class="marca">Gestión de Inventario<small>${esc(S.cfg.entidad)}</small><small>Directiva N° 0006-2021-EF/54.01</small></div>
      ${MENU.filter((m) => m[2] !== 'admin' || puede.administrar()).map((m) => m.length === 1 ? `<div class="nav-sec">${m[0]}</div>`
        : `<a href="${m[0]}" class="${ruta === m[0] ? 'activo' : ''}">${m[1]}${m[3] ? `<span class="nav-ref">${m[3]}</span>` : ''}</a>`).join('')}
      <div class="usuario">${esc(S.usuario.nombre)}<br>${ROLES[S.usuario.rol]}<br><span class="chip ${R.modo === 'servidor' ? 'ok' : 'warn'}" title="Dónde se guardan los datos">${esc(R.descripcion)}</span><br>
        <a href="#" id="clave" style="padding:0;display:inline">Cambiar clave</a> · <a href="#" id="salir" style="padding:0;display:inline">Salir</a></div>
      </nav><main class="main"><button class="btn menu-movil" id="menu" aria-label="Abrir menú">☰ Menú</button>${contenido}</main></div>`;
    raiz.querySelector('#menu').onclick = () => raiz.querySelector('#nav').classList.toggle('abierto');
    raiz.querySelector('#salir').onclick = (e) => { e.preventDefault(); salir(); };
    raiz.querySelector('#clave').onclick = (e) => { e.preventDefault(); dialogoClave(false); };
  }

  // ---------------- Sesión ----------------
  async function pantallaLogin(msg) {
    raiz.innerHTML = `<div class="login"><form class="tarjeta" id="f">
      <h1>Gestión de Inventario</h1><p class="muted pequeno">${esc((S.cfg || {}).entidad || '')} — Bienes muebles patrimoniales<br>Directiva N° 0006-2021-EF/54.01</p>
      ${msg ? `<div class="aviso bad">${esc(msg)}</div>` : ''}
      <div class="campo"><label for="u">Usuario</label><input id="u" autocomplete="username" required></div>
      <div class="campo" style="margin-top:.6rem"><label for="p">Clave</label><input id="p" type="password" autocomplete="current-password" required></div>
      <button class="btn primario" style="margin-top:1rem;width:100%;justify-content:center">Ingresar</button>
      <p class="muted pequeno" style="margin-top:1rem">${R.modo === 'servidor' ? 'Servidor institucional. Solicite su usuario al administrador del sistema.'
        : 'Modo local (datos en este navegador). Primer ingreso: usuario <b>admin</b>, clave <b>admin</b> (se pedirá cambiarla).'}</p></form></div>`;
    raiz.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const u = await intentar(() => R.ingresar(val(raiz, '#u'), raiz.querySelector('#p').value), (err) => pantallaLogin((err.errores || [err.message]).join(' ')));
      if (!u) return;
      S.usuario = u;
      if (u.debeCambiar) return dialogoClave(true);
      await recargar(); enrutar();
    };
  }
  async function salir() { await R.salir(); S.usuario = null; location.hash = ''; pantallaLogin(); }

  function dialogoClave(obligatorio) {
    modal(`<h2>Cambiar clave</h2>${obligatorio ? '<div class="aviso warn">Debe cambiar la clave inicial antes de continuar.</div>' : ''}
      <form id="fc"><div class="campos"><div class="campo"><label>Nueva clave (mín. 8 caracteres, con letras y números)</label><input type="password" id="c1" minlength="8" required></div>
      <div class="campo"><label>Repetir clave</label><input type="password" id="c2" minlength="8" required></div></div>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Guardar</button>${obligatorio ? '' : '<button type="button" class="btn" data-cerrar>Cancelar</button>'}</div></form>`,
    (m, cerrar) => {
      m.querySelector('#fc').onsubmit = async (e) => {
        e.preventDefault();
        const c1 = m.querySelector('#c1').value;
        if (c1 !== m.querySelector('#c2').value) return toast('Las claves no coinciden.');
        if ((await intentar(() => R.cambiarClave(c1).then(() => true))) !== true) return;
        S.usuario.debeCambiar = false; cerrar(); toast('Clave actualizada.'); await recargar(); enrutar();
      };
    });
  }

  // ---------------- Panel ----------------
  function vistaPanel() {
    const k = Core.indicadores(S.bienes, S.movs, S.cfg.uit);
    const alertas = Core.alertasNormativas(S.bienes, S.movs, S.inventarios);
    marco(`<div class="barra"><h1>Panel de control patrimonial</h1></div>
      ${S.bienes.length ? '' : '<div class="aviso warn">No hay bienes registrados. Vaya a <a href="#/config">Configuración</a> para cargar el inventario 2025.</div>'}
      <div class="kpis">
        <div class="kpi"><div class="v">${k.total}</div><div class="l">Bienes en patrimonio</div></div>
        <div class="kpi"><div class="v">${soles(k.valor)}</div><div class="l">Valor registrado</div></div>
        <div class="kpi"><div class="v">${k.activoFijo}</div><div class="l">Activo fijo (≥ 1/4 UIT, ref.)</div></div>
        <div class="kpi"><div class="v">${k.cuentasOrden}</div><div class="l">No depreciables (&lt; 1/4 UIT, ref.)</div></div>
        <div class="kpi"><div class="v">${k.pendientesDisposicion}</div><div class="l">Dados de baja, por disponer</div></div>
      </div>
      <div class="tarjeta"><h2>Alertas de cumplimiento de la Directiva</h2>
        ${alertas.length ? alertas.map((a) => `<div class="aviso ${a.nivel}"><a href="${a.enlace}">${esc(a.texto)}</a> ${ref(a.ref)}</div>`).join('') : '<p class="muted">Sin alertas.</p>'}</div>
      <div class="grid g2">
        <div class="tarjeta"><h2>Bienes por estado de conservación</h2>${barras(k.porEstado)}</div>
        <div class="tarjeta"><h2>Ubicaciones con más bienes</h2>${barras(k.porUbicacion, 10)}</div>
      </div>
      <div class="tarjeta"><h2>Últimos actos registrados</h2>${tablaMovs(S.movs.slice(0, 8))}</div>`);
  }

  // ---------------- Bienes (Título III) ----------------
  function filtrarBienes(f) {
    const t = (f.texto || '').toLowerCase();
    return S.bienes.filter((b) =>
      (f.situacion ? b.situacion === f.situacion : b.situacion !== 'DISPUESTO') &&
      (!f.ubicacion || b.ubicacion === f.ubicacion) &&
      (!f.estado || (f.estado === 'baja' ? ['Malo', 'RAEE', 'Chatarra'].includes(b.estado) : b.estado === f.estado)) &&
      (f.resp !== 'no' || (!b.responsable && b.situacion === 'ACTIVO')) &&
      (!t || [b.codigo, b.codigo_interno, b.descripcion, b.marca, b.modelo, b.serie, nombrePersona(b.responsable)].join(' ').toLowerCase().includes(t)));
  }
  function vistaBienes(q) {
    const f = { texto: q.get('q') || '', ubicacion: q.get('ubicacion') || '', estado: q.get('estado') || '', situacion: q.get('situacion') || '', resp: q.get('resp') || '' };
    marco(`<div class="barra"><h1>Registro de bienes</h1>${ref('Arts. 19–22')}
        <button class="btn" id="exp">Exportar a Excel</button></div>
      ${f.resp === 'no' ? '<div class="aviso info">Filtro: bienes activos sin usuario responsable. <a href="#/bienes">Quitar filtro</a></div>' : ''}
      <div class="filtros">
        <input id="ft" placeholder="Buscar código, denominación, marca, serie, usuario…" value="${esc(f.texto)}">
        <select id="fu">${opciones(opcUbic(), f.ubicacion, 'Todas las ubicaciones')}</select>
        <select id="fe">${opciones([...Core.ESTADOS_CONSERVACION, ['baja', 'Malo / RAEE / Chatarra']], f.estado, 'Todos los estados')}</select>
        <select id="fs">${opciones(Object.entries(Core.SITUACIONES).map(([k, v]) => [k, v.split(' (')[0]]), f.situacion, 'Patrimonio vigente')}</select>
      </div>
      <p class="muted pequeno" id="res"></p><div class="tabla-wrap"><table><thead><tr><th>Código patrimonial</th><th>Denominación</th><th>Marca / Modelo</th>
      <th>Serie</th><th>Estado</th><th>Situación</th><th>Ubicación</th><th>Usuario</th><th class="num">Valor</th></tr></thead><tbody id="tb"></tbody></table></div>`);
    let filtrados = [];
    const pintar = () => {
      Object.assign(f, { texto: val(raiz, '#ft'), ubicacion: val(raiz, '#fu'), estado: val(raiz, '#fe'), situacion: val(raiz, '#fs') });
      filtrados = filtrarBienes(f);
      raiz.querySelector('#res').textContent = `${filtrados.length} bienes · ${soles(sumaValor(filtrados))}${filtrados.length > 500 ? ' · se muestran los primeros 500' : ''}`;
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
    const fila = (l, v) => v ? `<tr><th style="width:38%">${l}</th><td>${v}</td></tr>` : '';
    marco(`<div class="barra"><h1>${esc(b.descripcion)}</h1><button class="btn" id="imp">Imprimir ficha</button>
      <button class="btn" id="etq">Etiqueta</button>
      ${puede.registrar() ? '<button class="btn" id="edi">Corregir datos</button>' : ''}</div>
      <div class="grid g2"><div class="tarjeta"><div class="tabla-wrap"><table><tbody>
        ${fila('Código patrimonial', `<span class="mono">${esc(b.codigo)}</span>`)}${fila('Código interno', esc(b.codigo_interno))}
        ${fila('Marca / Modelo', `${esc(b.marca)} / ${esc(b.modelo)}`)}${fila('Serie', esc(b.serie))}${fila('Dimensiones / Color', `${esc(b.medidas)} ${esc(b.color)}`)}
        ${fila('Estado de conservación', chipEstado(b.estado))}${fila('Situación', chipSituacion(b.situacion))}${fila('Ubicación física', esc(b.ubicacion))}
        ${fila('Usuario responsable', esc(nombrePersona(b.responsable)) || '<span class="muted">Sin asignar</span>')}
        ${fila('Titularidad', esc(Core.ORIGENES[b.origen]))}${fila('Transferido al Gobierno Regional', fecha(b.fecha_transferencia))}${fila('Orden de compra', esc(b.nro_orden))}${fila('Fecha de adquisición', fecha(b.fecha_adquisicion))}
        ${fila('Valor', soles(b.valor))}${fila('Clasificación (art. 5.c, ref.)', esc(Core.clasificacionContable(b.valor, S.cfg.uit)))}
        ${fila('Cuenta contable', esc(b.cuenta_contable) || '<span class="muted">Sin registrar (art. 22.1)</span>')}
        ${fila('Póliza de seguro', b.poliza ? `${esc(b.poliza)} — vence ${fecha(b.poliza_vence)}` : '')}
        ${fila('Último mantenimiento', fecha(b.ultimo_mantenimiento))}
        ${fila('Baja', b.fecha_baja ? `${fecha(b.fecha_baja)} — ${esc(b.causal_baja)} — ${esc(b.resolucion_baja)}` : '')}
        ${fila('Afectado en uso a', b.afectataria ? `${esc(b.afectataria)} hasta ${fecha(b.afectacion_vence)}` : '')}
        ${fila('Observaciones', esc(b.observaciones))}
      </tbody></table></div></div>
      <div class="tarjeta"><h2>Historial de actos (kardex)</h2>
        <p class="muted pequeno">La situación, el estado, la ubicación y el usuario solo cambian mediante actos registrados, para asegurar la trazabilidad (art. 19).</p>
        ${movs.length ? tablaMovs(movs) : '<p class="muted">Sin actos desde la carga inicial.</p>'}</div></div>`);
    raiz.querySelector('#imp').onclick = () => Formatos.imprimir(Formatos.fichaBien(b, movs, ctx()));
    raiz.querySelector('#etq').onclick = () => Formatos.imprimir(Formatos.etiquetas([b], S.cfg, ''));
    const ed = raiz.querySelector('#edi');
    if (ed) ed.onclick = () => editarBien(b);
  }

  function editarBien(b) {
    const campos = [['codigo_interno', 'Código interno'], ['descripcion', 'Denominación'], ['marca', 'Marca'], ['modelo', 'Modelo'], ['serie', 'Serie'],
      ['medidas', 'Dimensiones'], ['color', 'Color'], ['nro_orden', 'Orden de compra'], ['cuenta_contable', 'Cuenta contable (art. 22.1)'],
      ['poliza', 'Póliza de seguro N° / aseguradora (art. 89)']];
    modal(`<h2>Corregir datos del registro</h2><p class="muted pequeno">Corrección de datos descriptivos (art. 22.2). El valor solo se modifica con una resolución de la OGA (art. 25).</p>
      <form id="fe"><div class="campos">
      ${campos.map(([k, l]) => `<div class="campo"><label>${l}</label><input name="${k}" value="${esc(b[k])}"></div>`).join('')}
      <div class="campo"><label>Vencimiento de la póliza</label><input type="date" name="poliza_vence" value="${esc(b.poliza_vence)}"></div>
      <div class="campo"><label>Titularidad / origen</label><select name="origen">${opciones(Object.entries(Core.ORIGENES), b.origen)}</select></div>
      <div class="campo"><label>Valor S/</label><input type="number" step="0.01" min="0" name="valor" value="${esc(b.valor)}"></div>
      <div class="campo"><label>Resolución OGA (obligatoria si cambia el valor)</label><input name="_resolucion"></div>
      <div class="campo ancho"><label>Observaciones</label><textarea name="observaciones">${esc(b.observaciones)}</textarea></div>
      <div class="campo ancho"><label class="req">Motivo de la corrección (queda en bitácora)</label><input name="_motivo" required></div></div>
      <div id="err"></div>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fe').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target); const cambios = {};
        [...campos.map((c) => c[0]), 'poliza_vence', 'origen', 'observaciones', 'valor'].forEach((k) => { cambios[k] = fd.get(k); });
        const ok = await intentar(() => R.corregirBien(b.codigo, cambios, Core.limpiar(fd.get('_motivo')), Core.limpiar(fd.get('_resolucion'))).then(() => true),
          (err) => { m.querySelector('#err').innerHTML = `<div class="aviso bad">${esc((err.errores || [err.message]).join(' '))}</div>`; });
        if (!ok) return;
        cerrar(); await recargar(); toast('Registro actualizado.'); enrutar();
      };
    });
  }

  function vistaEtiquetas() {
    marco(`<div class="barra"><h1>Etiquetas de identificación</h1>${ref('Arts. 19–20 y 35.3.d')}</div>
      <div class="tarjeta"><p class="pequeno">El código se consigna obligatoriamente en el bien mediante etiqueta, placa u otro símbolo material (art. 20.4), con el código y el nombre o siglas de la entidad (art. 20.1).
      En el inventario, la etiqueta de verificación lleva además el año y el nombre de la entidad (art. 35.3.d).</p>
      <div class="campos"><div class="campo"><label>Ubicación</label><select id="eu">${opciones(opcUbic(), '', 'Todas')}</select></div>
      <div class="campo"><label>Año de inventario (opcional)</label><input id="ea" type="number" placeholder="${new Date().getFullYear()}"></div>
      <div class="campo"><label>Códigos específicos (separados por coma, opcional)</label><input id="ec"></div></div>
      <div class="barra" style="margin-top:1rem"><button class="btn primario" id="imp">Imprimir etiquetas</button><span class="muted pequeno" id="cnt"></span></div></div>`);
    const lista = () => {
      const cods = val(raiz, '#ec').split(/[\s,;]+/).filter(Boolean);
      if (cods.length) return cods.map((c) => S.porCodigo[c]).filter(Boolean);
      return filtrarBienes({ ubicacion: val(raiz, '#eu') }).filter((b) => b.situacion !== 'BAJA');
    };
    const contar = () => { raiz.querySelector('#cnt').textContent = `${lista().length} etiquetas`; };
    ['#eu', '#ec'].forEach((s) => raiz.querySelector(s).addEventListener('input', contar));
    raiz.querySelector('#imp').onclick = () => Formatos.imprimir(Formatos.etiquetas(lista(), S.cfg, val(raiz, '#ea')));
    contar();
  }

  // ---------------- Actos (Títulos III a IX) ----------------
  function vistaActos() {
    marco(`<div class="barra"><h1>Registrar acto</h1></div>
      <div class="aviso info">Los actos que requieren resolución (alta por las causales del art. 16, baja, disposición, afectación en uso) se registran después de emitida la resolución.
      Antes de eso puede imprimir el borrador del <b>Informe Técnico (Anexo N° 01)</b> desde el formulario del acto.</div>
      ${Core.GRUPOS.map((g) => `<div class="tarjeta"><h2>${esc(g.titulo)} ${ref(g.arts)}</h2><div class="actos">
        ${Object.entries(Core.TIPOS_MOVIMIENTO).filter(([, d]) => d.grupo === g.id).map(([k, d]) => `<div class="acto">
          <div><b>${esc(d.nombre)}</b> ${ref(d.base)} ${d.anexo !== '—' ? ref(d.anexo) : ''}</div>
          <p class="pequeno muted">${esc(d.descripcion)}</p>
          ${puede.registrar() ? `<a class="btn chico" href="#/nuevo/${k}">Registrar</a>` : ''}</div>`).join('')}</div></div>`).join('')}
      <div class="tarjeta"><h2>Otros procedimientos</h2><p class="pequeno">
        <a href="#/inventario">Inventario y supervisión</a> (Títulos V y X) · <a href="#/saneamiento">Saneamiento de sobrantes y faltantes</a> (Título VI) ·
        <a href="#/mantenimiento">Mantenimiento y aseguramiento</a> (Título IX).</p></div>`);
  }

  function tablaMovs(movs) {
    return `<div class="tabla-wrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Acto</th><th class="num">Bienes</th><th>Causal / motivo</th><th>Sustento</th><th>Usuario</th></tr></thead><tbody>
      ${movs.map((m) => `<tr class="click" data-ir="#/movimiento/${esc(m.numero)}"><td class="mono">${esc(m.numero)}${m.anulado ? ' <span class="chip bad">Anulado</span>' : ''}</td>
      <td>${fecha(m.fecha)}</td><td>${esc(Core.TIPOS_MOVIMIENTO[m.tipo].nombre)}</td><td class="num">${m.items.length}</td>
      <td>${esc(m.causal || m.motivo || '')}</td><td>${esc(m.resolucion || m.documento || m.informe_tecnico || '')}</td><td>${esc(m.usuario)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin actos.</td></tr>'}</tbody></table></div>`;
  }

  function vistaMovimientos(q) {
    const tipo = q.get('tipo') || '';
    marco(`<div class="barra"><h1>Historial de actos</h1>${puede.registrar() ? '<a class="btn primario" href="#/actos">+ Registrar acto</a>' : ''}
      <button class="btn" id="exp">Exportar a Excel</button></div>
      <div class="filtros"><select id="ft">${opciones(Object.entries(Core.TIPOS_MOVIMIENTO).map(([k, d]) => [k, d.nombre]), tipo, 'Todos los actos')}</select>
      <input id="fq" placeholder="Buscar N°, causal, resolución…"></div>
      <div id="lista"></div>`);
    const pintar = () => {
      const t = val(raiz, '#ft'); const qq = val(raiz, '#fq').toLowerCase();
      raiz.querySelector('#lista').innerHTML = tablaMovs(S.movs.filter((m) => (!t || m.tipo === t) &&
        (!qq || [m.numero, m.causal, m.resolucion, m.documento, m.informe_tecnico, m.motivo].join(' ').toLowerCase().includes(qq))));
    };
    raiz.querySelector('#ft').onchange = pintar; raiz.querySelector('#fq').oninput = pintar;
    raiz.querySelector('#exp').onclick = () => descargarExcel(`actos_${Core.hoyISO()}.xlsx`, {
      Actos: S.movs.flatMap((m) => m.detalle.map((d) => ({
        numero: m.numero, fecha: m.fecha, acto: Core.TIPOS_MOVIMIENTO[m.tipo].nombre, anulado: m.anulado ? 'SI' : '', causal: m.causal,
        informe_tecnico: m.informe_tecnico, resolucion: m.resolucion, documento: m.documento,
        codigo_patrimonial: d.codigo, denominacion: d.descripcion, valor: d.valor,
        situacion_antes: d.antes && d.antes.situacion, situacion_despues: d.despues && d.despues.situacion,
        estado_antes: d.antes && d.antes.estado, estado_despues: d.despues && d.despues.estado,
        ubicacion_antes: d.antes && d.antes.ubicacion, ubicacion_despues: d.despues && d.despues.ubicacion,
        usuario_antes: d.antes && nombrePersona(d.antes.responsable), usuario_despues: d.despues && nombrePersona(d.despues.responsable),
        destino_externo: m.destino_externo, fecha_retorno: m.fecha_retorno, motivo: m.motivo, registrado_por: m.usuario, registrado: m.registrado,
        dias_habiles_hasta_registro: m.registrado ? Core.diasHabiles(m.fecha, m.registrado.slice(0, 10)) : ''
      })))
    });
    pintar();
  }

  // ---------------- Formulario de actos ----------------
  function campoMov(tipo, c) {
    const l = `<label data-campo="${c}">${esc(Core.etiqueta(tipo, c))}</label>`;
    switch (c) {
      case 'causal': return `<div class="campo ancho">${l}<select name="causal">${opciones(Core.CAUSALES_POR_TIPO[tipo].map((x) => [x.nombre, `${x.nombre} (${x.ref})`]), '', 'Seleccione…')}</select>
        <div class="pequeno muted" id="ayudaCausal"></div></div>`;
      case 'responsable_destino': return `<div class="campo">${l}<select name="responsable_destino">${opciones(opcPersonal(true), '', '—')}</select>
        ${S.personal.length ? '' : '<span class="pequeno muted">Registre a los usuarios en "Usuarios y ubicaciones".</span>'}</div>`;
      case 'modalidad': return `<div class="campo">${l}<select name="modalidad">${opciones(Core.MODALIDADES_ASIGNACION, Core.MODALIDADES_ASIGNACION[0])}</select></div>`;
      case 'ubicacion_destino': return `<div class="campo">${l}<select name="ubicacion_destino">${opciones(opcUbic(true), '', '— (sin cambio)')}</select></div>`;
      case 'estado_destino': return `<div class="campo">${l}<select name="estado_destino">${opciones(Core.ESTADOS_CONSERVACION, '', tipo === 'CAMBIO_ESTADO' ? 'Seleccione…' : '— (sin cambio)')}</select></div>`;
      case 'tipo_mantenimiento': return `<div class="campo">${l}<select name="tipo_mantenimiento">${opciones(Core.TIPOS_MANTENIMIENTO, '', '—')}</select></div>`;
      case 'fecha_retorno': return `<div class="campo">${l}<input type="date" name="fecha_retorno"></div>`;
      case 'costo': case 'valor_tasacion': return `<div class="campo">${l}<input type="number" step="0.01" min="0" name="${c}"></div>`;
      case 'motivo': return `<div class="campo ancho">${l}<textarea name="motivo"></textarea></div>`;
      default: return `<div class="campo">${l}<input name="${c}"></div>`;
    }
  }

  function vistaNuevo(tipo, q) {
    const def = Core.TIPOS_MOVIMIENTO[tipo];
    if (!def || tipo === 'INVENTARIO' || !puede.registrar()) return marco('<div class="aviso bad">Acción no permitida.</div>');
    const elegibles = def.desde ? S.bienes.filter((b) => def.desde.includes(b.situacion) && (!def.origenes || def.origenes.includes(b.origen))) : [];
    const sel = new Set((q.get('sel') || '').split(',').filter((c) => elegibles.some((b) => b.codigo === c)));
    const sobranteRef = q.get('sobrante') || '';
    const sob = (() => { const [id, i] = sobranteRef.split(':'); const inv = S.inventarios.find((x) => x.id === id); return inv && inv.sobrantes[Number(i)]; })();
    const filaAlta = (p) => {
      const o = p || {};
      return `<tr>
      <td><input name="codigo" inputmode="numeric" maxlength="12" placeholder="12 dígitos" value="${esc(o.codigo)}"></td><td><input name="descripcion" value="${esc(o.descripcion)}"></td>
      <td><input name="marca" value="${esc(o.marca)}"></td><td><input name="modelo"></td><td><input name="serie" value="${esc(o.serie)}"></td><td><input name="color"></td><td><input name="medidas"></td>
      <td><select name="estado">${opciones(Core.ESTADOS_CONSERVACION, o.estado || 'Nuevo')}</select></td>
      <td><input name="valor" type="number" step="0.01" min="0"></td><td><input name="cuenta_contable"></td><td><input name="fecha_adquisicion" type="date"></td>
      <td><input name="nro_orden"></td><td><select name="origen">${opciones(Object.entries(Core.ORIGENES).map(([k, v]) => [k, v.split(' —')[0].split(' (')[0]]), o.origen || 'CLAS')}</select></td>
      <td><select name="ubicacion">${opciones(opcUbic(true), o.ubicacion || 'ALMACEN GENERAL')}</select></td>
      <td><button type="button" class="btn chico peligro" data-quitar aria-label="Quitar fila">×</button></td></tr>`;
    };
    marco(`<div class="barra"><h1>${esc(def.nombre)}</h1>${ref(def.base)}${def.anexo !== '—' ? ref(def.anexo) : ''}<a class="btn" href="#/actos">Volver</a></div>
      <p class="muted">${esc(def.descripcion)}</p>
      <form id="fm"><div class="tarjeta"><h2>Datos del acto</h2><div class="campos">
        <div class="campo"><label class="req">Fecha del acto</label><input type="date" name="fecha" value="${Core.hoyISO()}" max="${Core.hoyISO()}"></div>
        ${def.campos.map((c) => campoMov(tipo, c)).join('')}
        <div class="campo ancho"><label>Observaciones</label><input name="observaciones"></div></div></div>
      ${tipo === 'ALTA'
        ? `<div class="tarjeta"><h2>Bienes a incorporar</h2><p class="muted pequeno">Código del Catálogo (8 dígitos) + correlativo (4 dígitos). El registro debe incluir la cuenta contable (art. 22.1).</p>
           <div class="tabla-wrap"><table class="tabla-form"><thead><tr><th>Código patrimonial</th><th>Denominación</th><th>Marca</th><th>Modelo</th><th>Serie</th><th>Color</th><th>Dimensiones</th>
           <th>Estado</th><th>Valor S/</th><th>Cuenta contable</th><th>F. adquisición</th><th>O/C</th><th>Titularidad</th><th>Ubicación</th><th></th></tr></thead>
           <tbody id="nuevos">${filaAlta(sob)}</tbody></table></div><button type="button" class="btn" id="mas" style="margin-top:.5rem">+ Agregar fila</button></div>`
        : `<div class="tarjeta"><h2>Bienes comprendidos <span class="contador" id="cnt">(0)</span></h2>
           <p class="muted pequeno">Solo se listan los bienes cuya situación permite este acto (${elegibles.length}).</p>
           <div class="filtros"><input id="bq" placeholder="Filtrar por código, denominación, serie…">
             <select id="bu">${opciones(opcUbic(), '', 'Todas las ubicaciones')}</select>
             <select id="br">${opciones(opcPersonal(), '', 'Todos los usuarios')}</select>
             <select id="be">${opciones(Core.ESTADOS_CONSERVACION, '', 'Todos los estados')}</select></div>
           <div class="tabla-wrap selector"><table><thead><tr><th><input type="checkbox" id="todos" aria-label="Seleccionar visibles"></th><th>Código</th><th>Denominación</th>
           <th>Serie</th><th>Estado</th><th>Situación</th><th>Ubicación</th><th>Usuario</th></tr></thead><tbody id="bl"></tbody></table></div></div>`}
      <div id="errores"></div>
      <div class="barra">${def.informe ? '<button type="button" class="btn" id="borrador">Borrador del Informe Técnico (Anexo N° 01)</button>' : ''}
      <button class="btn primario">Registrar ${esc(def.nombre.toLowerCase())}</button></div></form>`);
    const form = raiz.querySelector('#fm');
    const causalSel = form.querySelector('[name=causal]');
    if (causalSel && q.get('causal')) causalSel.value = q.get('causal');
    const actualizarObligatorios = () => {
      const req = new Set(Core.camposObligatorios({ tipo, causal: causalSel ? causalSel.value : '' }));
      form.querySelectorAll('label[data-campo]').forEach((l) => l.classList.toggle('req', req.has(l.dataset.campo)));
      const ay = raiz.querySelector('#ayudaCausal');
      if (ay) {
        const c = Core.causalDef(tipo, causalSel.value);
        ay.textContent = [c.doc && `Documento exigido: ${c.doc}.`, c.resolucion && 'Requiere informe técnico y resolución.', c.acta && 'Se formaliza con Acta de Entrega – Recepción (Anexo N° 02).',
          c.estado && `El bien debe figurar en estado "${c.estado}".`, c.denuncia && 'Requiere denuncia policial o fiscal.', c.soloFaltante && 'Solo para bienes faltantes; comunicar al OCI (art. 46).',
          c.sinDisposicion && 'No requiere acto de disposición (art. 60.3).', c.noRAEE && 'No aplica a RAEE.', c.soloRAEE && 'Solo para bienes calificados como RAEE.',
          c.tasacion && 'Requiere valor de tasación (arts. 92–93).'].filter(Boolean).join(' ');
      }
    };
    if (causalSel) causalSel.onchange = actualizarObligatorios;
    actualizarObligatorios();

    const leerNuevos = () => [...raiz.querySelectorAll('#nuevos tr')].map((tr) => {
      const o = {}; tr.querySelectorAll('[name]').forEach((i) => { o[i.name] = Core.limpiar(i.value); });
      o.valor = Core.aNumero(o.valor); o.descripcion = (o.descripcion || '').toUpperCase();
      return o;
    }).filter((o) => o.codigo || o.descripcion);
    if (tipo === 'ALTA') {
      raiz.querySelector('#mas').onclick = () => raiz.querySelector('#nuevos').insertAdjacentHTML('beforeend', filaAlta());
      raiz.querySelector('#nuevos').onclick = (e) => { if (e.target.closest('[data-quitar]')) e.target.closest('tr').remove(); };
    } else {
      let visibles = [];
      const pintar = () => {
        const t = val(raiz, '#bq').toLowerCase(); const u = val(raiz, '#bu'); const r = val(raiz, '#br'); const es = val(raiz, '#be');
        visibles = elegibles.filter((b) => (!u || b.ubicacion === u) && (!r || b.responsable === r) && (!es || b.estado === es) &&
          (!t || [b.codigo, b.codigo_interno, b.descripcion, b.serie, b.marca].join(' ').toLowerCase().includes(t))).slice(0, 300);
        raiz.querySelector('#bl').innerHTML = visibles.map((b) => `<tr><td><input type="checkbox" data-c="${esc(b.codigo)}" ${sel.has(b.codigo) ? 'checked' : ''} aria-label="Seleccionar ${esc(b.codigo)}"></td>
          <td class="mono">${esc(b.codigo)}</td><td>${esc(b.descripcion)}</td><td>${esc(b.serie)}</td><td>${chipEstado(b.estado)}</td><td>${chipSituacion(b.situacion)}</td>
          <td>${esc(b.ubicacion)}</td><td>${esc(nombrePersona(b.responsable))}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Sin bienes elegibles.</td></tr>';
        raiz.querySelector('#cnt').textContent = `(${sel.size} seleccionados)`;
      };
      ['#bq', '#bu', '#br', '#be'].forEach((s) => raiz.querySelector(s).addEventListener('input', pintar));
      raiz.querySelector('#bl').onchange = (e) => {
        const c = e.target.dataset.c; if (!c) return;
        if (e.target.checked) sel.add(c); else sel.delete(c);
        raiz.querySelector('#cnt').textContent = `(${sel.size} seleccionados)`;
      };
      raiz.querySelector('#todos').onchange = (e) => { visibles.forEach((b) => (e.target.checked ? sel.add(b.codigo) : sel.delete(b.codigo))); pintar(); };
      pintar();
    }
    const leerMov = () => {
      const fd = new FormData(form);
      const mov = { tipo };
      ['fecha', 'observaciones', ...def.campos].forEach((c) => { mov[c] = Core.limpiar(fd.get(c)); });
      if (tipo === 'ALTA') { mov.nuevos = leerNuevos(); mov.items = mov.nuevos.map((o) => o.codigo); } else mov.items = [...sel];
      return mov;
    };
    const borrador = raiz.querySelector('#borrador');
    if (borrador) borrador.onclick = () => {
      const m = leerMov();
      m.detalle = tipo === 'ALTA' ? m.nuevos : m.items.map((c) => S.porCodigo[c]);
      if (!m.detalle.length) return mostrarErrores(['Seleccione o registre al menos un bien para el borrador.']);
      Formatos.imprimir(Formatos.informeTecnico(m, ctx()), true);
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const mov = leerMov();
      if (tipo === 'ALTA') {
        const dup = mov.items.filter((c, i, a) => a.indexOf(c) !== i);
        if (dup.length) return mostrarErrores([`Código repetido en el formulario: ${dup.join(', ')} (art. 20.3).`]);
      }
      const errores = Core.validarMovimiento(mov, S.porCodigo, Core.hoyISO());
      if (errores.length) return mostrarErrores(errores);
      const numero = await intentar(() => registrarMovimiento(mov, sobranteRef), (err) => mostrarErrores(err.errores && err.errores.length ? err.errores : [err.message]));
      if (!numero) return;
      toast(`Acto ${numero} registrado.`);
      location.hash = '#/movimiento/' + numero;
    };
  }
  function mostrarErrores(errores) {
    const el = raiz.querySelector('#errores');
    el.innerHTML = `<div class="aviso bad"><b>No se puede registrar:</b><ul>${errores.slice(0, 15).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Registra el acto (el repositorio valida de nuevo y guarda en una sola transacción) */
  async function registrarMovimiento(mov, sobranteRef) {
    const numero = await R.registrarMovimiento(mov, sobranteRef);
    await recargar();
    return numero;
  }

  function vistaMovimiento(numero) {
    const m = S.movs.find((x) => x.numero === numero);
    if (!m) return marco('<div class="aviso bad">Acto no encontrado.</div>');
    const def = Core.TIPOS_MOVIMIENTO[m.tipo];
    const dh = m.registrado ? Core.diasHabiles(m.fecha, m.registrado.slice(0, 10)) : 0;
    const campos = ['causal', 'documento', 'informe_tecnico', 'resolucion', 'denuncia', 'responsable_destino', 'modalidad', 'ubicacion_destino', 'destino_externo',
      'contraparte', 'contraparte_doc', 'contraparte_cargo', 'responsable_traslado', 'responsable_traslado_dni', 'fecha_retorno', 'estado_destino', 'tipo_mantenimiento', 'costo', 'valor_tasacion', 'motivo'];
    const valorCampo = (c) => c === 'responsable_destino' ? nombrePersona(m[c]) : c === 'fecha_retorno' ? fecha(m[c]) : ['costo', 'valor_tasacion'].includes(c) && m[c] ? soles(m[c]) : m[c];
    const dif = (d, k) => {
      const f = (v) => esc(k === 'responsable' ? nombrePersona(v) : k === 'situacion' ? (Core.SITUACIONES[v] || v || '').split(' (')[0] : v) || '—';
      return d.antes && d.antes[k] !== d.despues[k] ? `${f(d.antes[k])} → <b>${f(d.despues[k])}</b>` : f(d.despues[k]);
    };
    marco(`<div class="barra"><h1>${esc(def.nombre)} <span class="mono">${esc(m.numero)}</span></h1>
      <button class="btn primario" id="imp">Imprimir formato${def.anexo !== '—' ? ' (' + esc(def.anexo.split(' /')[0]) + ')' : ''}</button>
      ${def.informe ? '<button class="btn" id="it">Informe Técnico (Anexo N° 01)</button>' : ''}
      ${puede.administrar() && !m.anulado ? '<button class="btn peligro" id="anu">Anular registro</button>' : ''}</div>
      ${m.anulado ? `<div class="aviso bad">Anulado el ${fecha(m.anulado.fecha)} por ${esc(m.anulado.usuario)}: ${esc(m.anulado.motivo)} ${esc(m.anulado.documento || '')}</div>` : ''}
      ${dh > 10 ? `<div class="aviso warn">Registrado ${dh} días hábiles después del acto (plazo de 10 días hábiles, ${ref('art. 23')}).</div>` : ''}
      <div class="tarjeta"><table><tbody><tr><th style="width:30%">Fecha del acto</th><td>${fecha(m.fecha)}</td></tr><tr><th>Base legal</th><td>${esc(def.base)}${m.causal ? ' · ' + esc(Core.causalDef(m.tipo, m.causal).ref || '') : ''}</td></tr>
        ${campos.filter((c) => m[c]).map((c) => `<tr><th>${esc(Core.etiqueta(m.tipo, c))}</th><td>${esc(valorCampo(c))}</td></tr>`).join('')}
        ${m.observaciones ? `<tr><th>Observaciones</th><td>${esc(m.observaciones)}</td></tr>` : ''}
        <tr><th>Registrado por</th><td>${esc(m.usuario)} — ${new Date(m.registrado).toLocaleString('es-PE')}</td></tr></tbody></table></div>
      <div class="tabla-wrap"><table><thead><tr><th>Código</th><th>Denominación</th><th>Situación</th><th>Estado</th><th>Ubicación</th><th>Usuario</th><th class="num">Valor</th></tr></thead>
      <tbody>${m.detalle.map((d) => `<tr class="click" data-ir="#/bien/${esc(d.codigo)}"><td class="mono">${esc(d.codigo)}</td><td>${esc(d.descripcion)}</td>
        <td>${dif(d, 'situacion')}</td><td>${dif(d, 'estado')}</td><td>${dif(d, 'ubicacion')}</td><td>${dif(d, 'responsable')}</td><td class="num">${soles(d.valor)}</td></tr>`).join('')}</tbody></table></div>
      <div class="tarjeta" style="margin-top:1rem"><h2>Documentos firmados ${ref('Sustento del acto')}</h2>
        ${R.adjuntos.disponible ? `${(() => { const ad = S.adjuntos.filter((a) => a.numero === m.numero); return ad.length
          ? `<ul>${ad.map((a) => `<li><a href="${R.adjuntos.url(a.id)}" target="_blank" rel="noopener">${esc(a.nombre)}</a> — ${esc(a.descripcion || '')} <span class="muted pequeno">(${esc(a.subido_por)}, ${fecha(a.fecha)}, ${Math.round(a.tamano / 1024)} KB)</span></li>`).join('')}</ul>`
          : '<p class="muted pequeno">Aún no se adjuntó el formato firmado.</p>'; })()}
          ${puede.registrar() ? `<form id="fadj" class="barra"><input type="file" name="archivo" accept="application/pdf,image/jpeg,image/png" required style="width:auto">
            <input name="descripcion" placeholder="Ej.: Anexo N° 03 firmado" style="width:auto;flex:1"><button class="btn">Adjuntar (PDF/JPG, máx. 10 MB)</button></form>` : ''}`
        : '<p class="muted pequeno">Los documentos firmados se adjuntan en el modo servidor. En modo local, archive el formato impreso y firmado.</p>'}</div>`);
    const fadj = raiz.querySelector('#fadj');
    if (fadj) fadj.onsubmit = async (e) => {
      e.preventDefault(); const fd = new FormData(fadj); const f = fd.get('archivo');
      if (!f || !f.size) return toast('Seleccione un archivo.');
      if (f.size > 10 * 1024 * 1024) return toast('El archivo supera los 10 MB.');
      if (await intentar(() => R.adjuntos.subir(m.numero, f, Core.limpiar(fd.get('descripcion'))))) { await recargar(); toast('Documento adjuntado.'); vistaMovimiento(numero); }
    };
    const salidaOrigen = m.tipo === 'REINGRESO' ? S.movs.find((x) => x.tipo === 'SALIDA' && !x.anulado && x.items.some((c) => m.items.includes(c)) && x.fecha <= m.fecha) : null;
    raiz.querySelector('#imp').onclick = () => Formatos.imprimir(Formatos.movimiento(m, ctx({ salidaOrigen })), true);
    const it = raiz.querySelector('#it');
    if (it) it.onclick = () => Formatos.imprimir(Formatos.informeTecnico(m, ctx()), true);
    const an = raiz.querySelector('#anu');
    if (an) an.onclick = () => anular(m);
  }

  /** Anulación de un registro erróneo (art. 24): solo si ningún bien tuvo actos posteriores. */
  function anular(m) {
    const bloqueados = m.detalle.filter((d) => {
      const b = S.porCodigo[d.codigo];
      if (!b) return true;
      return Core.CAMPOS_TRAZABLES.some((k) => k in d.despues && (b[k] || '') !== (d.despues[k] || ''));
    });
    if (bloqueados.length) {
      return modal(`<h2>No se puede anular</h2><div class="aviso warn">Estos bienes tienen actos posteriores. Anule primero los más recientes o registre un acto correctivo:<ul>
        ${bloqueados.slice(0, 15).map((d) => `<li>${esc(d.codigo)} — ${esc(d.descripcion)}</li>`).join('')}</ul></div><button class="btn" data-cerrar>Cerrar</button>`);
    }
    const esAlta = m.tipo === 'ALTA';
    modal(`<h2>Anular ${esc(m.numero)}</h2><p>Se revertirán ${m.detalle.length} bien(es) a su situación anterior${esAlta ? ' y los bienes incorporados se eliminarán del registro' : ''}.
      El acto queda en el historial, marcado como anulado.</p>
      <form id="fa"><label class="req">Motivo</label><textarea name="motivo" required></textarea>
      <label class="${esAlta ? 'req' : ''}" style="margin-top:.5rem">${esAlta ? 'Resolución de la OGA que aprueba la eliminación del registro (art. 24.2)' : 'Documento de sustento'}</label>
      <input name="documento" ${esAlta ? 'required' : ''}>
      <div class="barra" style="margin-top:1rem"><button class="btn peligro">Anular</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (md, cerrar) => {
      md.querySelector('#fa').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const motivo = Core.limpiar(fd.get('motivo')); const documento = Core.limpiar(fd.get('documento'));
        if ((await intentar(() => R.anular(m.numero, motivo, documento).then(() => true))) !== true) return;
        cerrar(); await recargar(); toast('Registro anulado.'); enrutar();
      };
    });
  }

  // ---------------- Inventario y supervisión (Títulos V y X) ----------------
  function vistaInventarios() {
    const abierto = S.inventarios.find((i) => i.estado === 'ABIERTO');
    marco(`<div class="barra"><h1>Inventario y supervisión</h1>${ref('Arts. 31–37 y 94')}
      ${puede.inventariar() && !abierto ? '<button class="btn primario" id="nuevo">Iniciar proceso</button>' : ''}</div>
      <div class="aviso info"><b>Inventario anual (art. 31):</b> cierre al 31 de diciembre, a cargo de una Comisión designada por resolución (representantes de OGA —quien la preside—, Contabilidad y Abastecimiento, art. 32).
      Fases: planificación, trabajo de campo y trabajo de gabinete (art. 35). Se presenta con el Informe Final (Anexo N° 06) y el Acta de Conciliación (Anexo N° 05) hasta el 15/03 (Organización) o el 31/03 (Entidad) (art. 36).<br>
      <b>Supervisión (art. 94):</b> verificación periódica de existencia, ubicación, estado, condiciones de uso y asignación al usuario. La supervisión integral del Gobierno Regional a las CLAS es como mínimo semestral (D.S. N° 017-2008-SA, art. 103.d); el Gobierno Regional realiza además el inventario de los establecimientos (art. 79.f), para el cual este proceso es el insumo del CLAS.</div>
      <div class="tabla-wrap"><table><thead><tr><th>Código</th><th>Tipo</th><th>Año</th><th>Fecha de corte</th><th>Resolución</th><th>Verificados</th><th>Estado</th></tr></thead><tbody>
      ${S.inventarios.map((i) => `<tr class="click" data-ir="#/inventario/${esc(i.id)}"><td class="mono">${esc(i.id)}</td><td>${i.tipo === 'SUPERVISION' ? 'Supervisión' : 'Inventario anual'}</td><td>${i.anio}</td><td>${fecha(i.fecha_corte)}</td>
        <td>${esc(i.resolucion)}</td><td>${Object.keys(i.verif || {}).length}</td><td>${i.estado === 'ABIERTO' ? '<span class="chip warn">En ejecución</span>' : '<span class="chip ok">Cerrado</span>'}${i.presentado ? ' <span class="chip info">Presentado</span>' : ''}</td></tr>`).join('') ||
        '<tr><td colspan="7" class="muted">No hay procesos registrados.</td></tr>'}</tbody></table></div>`);
    const nb = raiz.querySelector('#nuevo');
    if (nb) nb.onclick = () => modal(`<h2>Iniciar proceso</h2><form id="fi"><div class="campos">
      <div class="campo"><label class="req">Tipo</label><select name="tipo">${opciones([['ANUAL', 'Inventario anual (art. 31)'], ['SUPERVISION', 'Supervisión (art. 94)']], 'ANUAL')}</select></div>
      <div class="campo"><label class="req">Año</label><input name="anio" type="number" value="${new Date().getFullYear()}" required></div>
      <div class="campo"><label class="req">Fecha de corte</label><input name="fecha_corte" type="date" value="${new Date().getFullYear()}-12-31" required></div>
      <div class="campo ancho"><label data-r>Resolución de designación de la Comisión (art. 32.1)</label><input name="resolucion" placeholder="Resolución N° …"></div>
      <div class="campo"><label data-r>Presidente(a) — representante de la OGA</label><input name="presidente"></div>
      <div class="campo"><label data-r>Representante de Contabilidad</label><input name="contabilidad"></div>
      <div class="campo"><label data-r>Representante de Abastecimiento</label><input name="abastecimiento"></div>
      <div class="campo"><label>Personal inventariador / equipo de trabajo (art. 34)</label><input name="equipo"></div></div>
      <div id="err"></div>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Iniciar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      const marcar = () => m.querySelectorAll('[data-r]').forEach((l) => l.classList.toggle('req', m.querySelector('[name=tipo]').value === 'ANUAL'));
      m.querySelector('[name=tipo]').onchange = marcar; marcar();
      m.querySelector('#fi').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target); const g = (k) => Core.limpiar(fd.get(k));
        const tipo = g('tipo');
        if (tipo === 'ANUAL' && (!g('resolucion') || !g('presidente') || !g('contabilidad') || !g('abastecimiento'))) {
          m.querySelector('#err').innerHTML = '<div class="aviso bad">El inventario anual requiere la resolución de designación y los tres representantes mínimos de la Comisión (art. 32.1).</div>';
          return;
        }
        const inv = await intentar(() => R.crearInventario({ tipo, anio: Number(g('anio')), fecha_corte: g('fecha_corte'), resolucion: g('resolucion'), equipo: g('equipo'),
          comision: { presidente: g('presidente'), contabilidad: g('contabilidad'), abastecimiento: g('abastecimiento') } }),
        (err) => { m.querySelector('#err').innerHTML = `<div class="aviso bad">${esc((err.errores || [err.message]).join(' '))}</div>`; });
        if (!inv) return;
        cerrar(); await recargar(); location.hash = '#/inventario/' + inv.id;
      };
    });
  }

  /** Filas del Acta de Conciliación (Anexo N° 05), agrupadas por cuenta contable */
  function filasConciliacion(inv, universo, r) {
    const ubicados = new Set(r.conformes.concat(r.diferencias.map((d) => d.bien)).filter((b) => b.situacion !== 'BAJA').map((b) => b.codigo));
    const g = {};
    universo.filter((b) => b.situacion !== 'BAJA').forEach((b) => {
      const k = b.cuenta_contable || 'Sin cuenta contable';
      const x = g[k] = g[k] || { cuenta: k, patrimonial: 0, inventario: 0 };
      x.patrimonial += Number(b.valor || 0);
      if (ubicados.has(b.codigo)) x.inventario += Number(b.valor || 0);
    });
    return Object.values(g).sort((a, b) => a.cuenta.localeCompare(b.cuenta)).map((x) => Object.assign(x, { contable: (inv.conciliacion || {})[x.cuenta] }));
  }
  function textoInformeDefecto(inv, r) {
    const sobr = (inv.sobrantes || []).length;
    const malos = r.conformes.concat(r.diferencias.map((d) => d.bien)).filter((b) => ['Malo', 'RAEE', 'Chatarra'].includes(((inv.verif[b.codigo] || {}).estado) || b.estado)).length;
    const total = r.conformes.length + r.diferencias.length + r.faltantes.length + r.sinVerificar.length + (r.bajasNoUbicadas || []).length;
    return {
      antecedentes: 'Acciones efectuadas ante las recomendaciones del último inventario: ',
      conclusiones: `Se verificaron ${total - r.sinVerificar.length} de ${total} bienes muebles patrimoniales. Se identificaron ${r.faltantes.length} bienes faltantes, ${sobr} bienes sobrantes y ${r.diferencias.length} bienes con diferencias, cuyos registros fueron actualizados.`,
      recomendaciones: [
        r.faltantes.length && `Iniciar el saneamiento administrativo de los ${r.faltantes.length} bienes faltantes y comunicar al órgano del Sistema Nacional de Control (arts. 44–46).`,
        sobr && `Evaluar el saneamiento de los ${sobr} bienes sobrantes (arts. 38–43).`,
        malos && `Evaluar la baja de los ${malos} bienes en estado Malo, RAEE o Chatarra y su disposición final (arts. 48–49).`,
        'Asignar en uso, con la Ficha del Anexo N° 03, los bienes sin usuario responsable (arts. 26 y 28).',
        'Remitir los resultados a la OCP de la Unidad Ejecutora para la actualización del Módulo de Patrimonio del SIGA MEF (art. 35.6.a).'
      ].filter(Boolean).map((x, i) => `${i + 1}. ${x}`).join(' ')
    };
  }

  function vistaInventario(id) {
    const inv = S.inventarios.find((i) => i.id === id);
    if (!inv) return marco('<div class="aviso bad">Proceso no encontrado.</div>');
    inv.verif = inv.verif || {}; inv.sobrantes = inv.sobrantes || []; inv.informe = inv.informe || {}; inv.conciliacion = inv.conciliacion || {}; inv.comision = inv.comision || {};
    const anual = inv.tipo !== 'SUPERVISION';
    const editable = inv.estado === 'ABIERTO' && puede.inventariar();
    const universo = S.bienes.filter((b) => Core.SITUACIONES_INVENTARIABLES.includes(b.situacion));
    const r = inv.resultados ? {
      conformes: inv.resultados.conformes.map((c) => S.porCodigo[c]).filter(Boolean),
      faltantes: inv.resultados.faltantes.map((c) => S.porCodigo[c]).filter(Boolean),
      sinVerificar: inv.resultados.sinVerificar.map((c) => S.porCodigo[c]).filter(Boolean),
      bajasNoUbicadas: (inv.resultados.bajasNoUbicadas || []).map((c) => S.porCodigo[c]).filter(Boolean),
      diferencias: inv.resultados.diferencias.filter((d) => S.porCodigo[d.codigo]).map((d) => ({ bien: S.porCodigo[d.codigo], cambios: d.cambios }))
    } : Core.resultadosInventario(universo, inv.verif);
    const n = r.conformes.length + r.faltantes.length + r.diferencias.length + r.sinVerificar.length + r.bajasNoUbicadas.length;
    const avance = n ? Math.round((n - r.sinVerificar.length) / n * 100) : 0;
    const usuariosInactivos = S.personal.filter((p) => !p.activo && S.bienes.some((b) => b.responsable === p.id && b.situacion === 'ACTIVO'));
    const porUsuario = S.personal.map((p) => ({ p, n: universo.filter((b) => b.responsable === p.id).length })).filter((x) => x.n);
    const def = textoInformeDefecto(inv, r);
    const conc = filasConciliacion(inv, universo, r);
    const plazoPresentacion = `${inv.anio + 1}-03-15`;
    marco(`<div class="barra"><h1>${anual ? 'Inventario anual' : 'Supervisión'} ${esc(inv.id)}</h1>${ref(anual ? 'Arts. 31–37' : 'Art. 94')}</div>
      <div class="kpis"><div class="kpi"><div class="v">${avance}%</div><div class="l">Avance (${n - r.sinVerificar.length}/${n})</div></div>
        <div class="kpi"><div class="v">${r.conformes.length}</div><div class="l">Conformes</div></div>
        <div class="kpi"><div class="v">${r.diferencias.length}</div><div class="l">Con diferencias</div></div>
        <div class="kpi"><div class="v">${r.faltantes.length}</div><div class="l">Faltantes</div></div>
        <div class="kpi"><div class="v">${inv.sobrantes.length}</div><div class="l">Sobrantes</div></div></div>

      <div class="tarjeta"><h2>1. Planificación ${ref('Arts. 32, 33.a y 35.2')}</h2>
        <table><tbody><tr><th style="width:32%">Resolución de designación</th><td>${esc(inv.resolucion) || '—'}</td></tr>
        <tr><th>Comisión</th><td>${esc([inv.comision.presidente && 'Presidente(a): ' + inv.comision.presidente, inv.comision.contabilidad && 'Contabilidad: ' + inv.comision.contabilidad, inv.comision.abastecimiento && 'Abastecimiento: ' + inv.comision.abastecimiento].filter(Boolean).join(' · ')) || '—'}</td></tr>
        <tr><th>Fecha de corte</th><td>${fecha(inv.fecha_corte)}</td></tr></tbody></table>
        ${anual ? `<div class="campos" style="margin-top:.75rem"><div class="campo"><label>Fecha de presentación del Plan de Inventario (máx. 10 días hábiles de designada, art. 33.a)</label>
          <input type="date" id="planFecha" value="${esc(inv.plan_fecha)}" ${editable ? '' : 'disabled'}></div>
          <div class="campo"><label>Comunicación a las unidades orgánicas (art. 33.b)</label><input id="planCom" value="${esc(inv.plan_comunicacion)}" placeholder="Memorando circular N°…" ${editable ? '' : 'disabled'}></div></div>` : ''}
        <h3 style="margin-top:.75rem">Contraste de usuarios con bienes asignados ${ref('Art. 35.2.b')}</h3>
        ${usuariosInactivos.length ? `<div class="aviso bad">${usuariosInactivos.length} usuario(s) inactivo(s) aún tienen bienes asignados: ${esc(usuariosInactivos.map((p) => p.nombres).join(', '))}. Registre la devolución.</div>` : '<p class="muted pequeno">No hay usuarios inactivos con bienes asignados.</p>'}
        ${porUsuario.length ? `<div class="tabla-wrap"><table><thead><tr><th>Usuario</th><th>Unidad</th><th class="num">Bienes</th><th></th></tr></thead><tbody>${porUsuario.map((x) => `<tr><td>${esc(x.p.nombres)}</td><td>${esc(x.p.unidad || x.p.cargo)}</td><td class="num">${x.n}</td>
          <td><button class="btn chico" data-a07u="${esc(x.p.id)}">Ficha Anexo N° 07</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      </div>

      <div class="tarjeta"><h2>2. Trabajo de campo ${ref('Arts. 35.3–35.5 · Anexo N° 07')}</h2>
        ${editable ? `<p class="muted pequeno">Por ubicación: marque si el bien fue encontrado, si está en uso (U) o en desuso (D), y corrija el estado (Bueno, Regular, Malo, Chatarra, RAEE), la ubicación o el usuario. Los cambios se guardan al instante. Los bienes dados de baja solo se verifican (art. 31.2).</p>
        <div class="filtros"><select id="iu">${opciones(opcUbic(), '', 'Seleccione ubicación…')}</select><input id="iq" placeholder="Buscar por código o denominación (bienes de otra ubicación)">
        <select id="tv">${opciones([['F', 'Verificación física'], ['D', 'Verificación digital (art. 35.4)']], inv.tipo_verificacion || 'F')}</select>
        <div class="barra" style="margin:0"><button class="btn" id="todosOk" type="button">Marcar visibles como encontrados</button><button class="btn" id="a07" type="button">Ficha Anexo N° 07</button></div></div>
        <div class="tabla-wrap"><table><thead><tr><th>Encontrado</th><th>Código</th><th>Denominación</th><th>Uso</th><th>Estado verificado</th><th>Ubicación verificada</th><th>Usuario verificado</th><th>Observación</th></tr></thead>
        <tbody id="it"><tr><td colspan="8" class="muted">Seleccione una ubicación.</td></tr></tbody></table></div>
        <div class="barra" style="margin-top:.75rem"><button class="btn" id="sob" type="button">+ Registrar bien sobrante</button></div>`
        : `<div class="barra"><select id="iu" style="width:auto">${opciones(opcUbic(), '', 'Ubicación…')}</select><button class="btn" id="a07" type="button">Ficha Anexo N° 07 de la ubicación</button></div>`}
        ${inv.sobrantes.length ? `<h3 style="margin-top:.75rem">Sobrantes ${ref('Art. 4.2.f')}</h3><div class="tabla-wrap"><table><thead><tr><th>Denominación</th><th>Marca / serie</th><th>Estado</th><th>Ubicación</th><th>Posesión desde</th><th>Evaluación (arts. 39 y 43)</th></tr></thead><tbody>
          ${inv.sobrantes.map((s) => `<tr><td>${esc(s.descripcion)}</td><td>${esc(s.marca)} ${esc(s.serie)}</td><td>${esc(s.estado)}</td><td>${esc(s.ubicacion)}</td><td>${fecha(s.fecha_posesion)}</td><td>${s.alta ? 'Incorporado: ' + esc(s.alta) : esc(Core.evaluarSobrante(s).texto)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      </div>

      ${anual ? `<div class="tarjeta"><h2>3. Trabajo de gabinete ${ref('Art. 35.6 · Anexos N° 05 y 06')}</h2>
        <h3>Conciliación patrimonio-contable ${ref('Art. 35.6.b')}</h3>
        <p class="muted pequeno">(a) y (c) se calculan con el valor registrado de los bienes. Ingrese (b), el valor neto contable al 31/12 que informa Contabilidad.</p>
        <div class="tabla-wrap"><table><thead><tr><th>Cuenta</th><th class="num">Registro patrimonial (a)</th><th class="num">Registro contable (b)</th><th class="num">Resultado del inventario (c)</th><th class="num">Diferencia (b−c)</th></tr></thead><tbody>
        ${conc.map((f) => `<tr><td>${esc(f.cuenta)}</td><td class="num">${soles(f.patrimonial)}</td><td class="num"><input class="num-in" type="number" step="0.01" data-cta="${esc(f.cuenta)}" value="${esc(f.contable === undefined ? '' : f.contable)}" ${inv.estado === 'ABIERTO' && editable ? '' : 'disabled'}></td>
          <td class="num">${soles(f.inventario)}</td><td class="num">${f.contable === undefined || f.contable === '' ? '' : soles(Number(f.contable) - f.inventario)}</td></tr>`).join('')}</tbody></table></div>
        ${conc.some((f) => f.cuenta === 'Sin cuenta contable') ? '<div class="aviso warn">Hay bienes sin cuenta contable. Regístrela en cada bien (Corregir datos) antes de suscribir el acta.</div>' : ''}
        <h3 style="margin-top:.75rem">Informe Final de Inventario ${ref('Anexo N° 06')}</h3>
        <div class="campos">${[['antecedentes', 'I. Antecedentes'], ['sustento_digital', 'II. Sustento de la verificación digital'], ['actividades', 'III. Actividades desarrolladas'], ['analisis', 'IV. Análisis (comentario adicional)'], ['conclusiones', 'V. Conclusiones'], ['recomendaciones', 'VI. Recomendaciones']]
          .map(([k, l]) => `<div class="campo ancho"><label>${l}</label><textarea data-inf="${k}" ${editable ? '' : 'disabled'} placeholder="${esc(def[k] || '')}">${esc(inv.informe[k] || '')}</textarea></div>`).join('')}</div>
        <div class="barra" style="margin-top:.75rem">${editable ? '<button class="btn" id="proponer" type="button">Completar con texto sugerido</button><button class="btn" id="gGab" type="button">Guardar gabinete</button>' : ''}
          <button class="btn" id="a05" type="button">Acta de Conciliación (Anexo N° 05)</button><button class="btn" id="a06" type="button">Informe Final (Anexo N° 06)</button></div>
      </div>` : ''}

      <div class="tarjeta"><h2>${anual ? '4' : '3'}. Cierre${anual ? ' y presentación' : ''} ${ref(anual ? 'Arts. 35.6.a y 36' : 'Art. 94')}</h2>
        ${inv.estado === 'ABIERTO'
          ? `<p class="pequeno">Al cerrar se registra el acto de regularización: se actualizan el estado, la ubicación y el usuario de los bienes con diferencias, y los no ubicados pasan a situación "Faltante".</p>
             ${editable ? '<button class="btn primario" id="cer" type="button">Cerrar y regularizar</button>' : ''}`
          : `<div class="aviso ok">Cerrado el ${fecha(inv.cerrado)}. Regularización: ${inv.movimiento ? `<a href="#/movimiento/${esc(inv.movimiento)}">${esc(inv.movimiento)}</a>` : 'sin cambios'}.</div>
             ${anual ? `<div class="campos"><div class="campo"><label>N° de oficio de remisión (Anexo N° 09)</label><input id="ofi" value="${esc(inv.oficio)}" ${puede.inventariar() ? '' : 'disabled'}></div>
             <div class="campo"><label>Fecha de presentación (referencial: hasta el ${fecha(plazoPresentacion)} si el establecimiento remite a la OGA)</label><input type="date" id="pre" value="${esc(inv.presentado)}" ${puede.inventariar() ? '' : 'disabled'}></div></div>
             ${inv.presentado && inv.presentado > plazoPresentacion ? `<div class="aviso warn">Presentado después del 15/03 ${ref('Art. 36.1')}.</div>` : ''}
             <div class="barra" style="margin-top:.75rem">${puede.inventariar() ? '<button class="btn" id="gPre" type="button">Guardar presentación</button>' : ''}<button class="btn" id="a09" type="button">Comunicación (Anexo N° 09)</button></div>` : ''}`}
      </div>`);

    const actualizar = (campos) => intentar(() => R.actualizarInventario(id, campos).then(() => true));
    const imprimirA07 = (grupo, bienes) => Formatos.imprimir(Formatos.fichaLevantamiento(inv, grupo, bienes, ctx()), true);
    raiz.querySelectorAll('[data-a07u]').forEach((b) => {
      b.onclick = () => { const p = persona(b.dataset.a07u); imprimirA07({ usuario: p.nombres, unidad: p.unidad || p.cargo, ubicacion: 'Varias' }, universo.filter((x) => x.responsable === p.id)); };
    });
    raiz.querySelector('#a07').onclick = () => {
      const u = val(raiz, '#iu');
      if (!u) return toast('Seleccione una ubicación.');
      const bs = universo.filter((b) => b.ubicacion === u);
      const us = [...new Set(bs.map((b) => b.responsable).filter(Boolean))];
      imprimirA07({ ubicacion: u, usuario: us.length === 1 ? nombrePersona(us[0]) : (us.length ? 'Varios usuarios' : ''), unidad: us.length === 1 ? (persona(us[0]).unidad || '') : '' }, bs);
    };
    const imp = (id2, fn) => { const b = raiz.querySelector(id2); if (b) b.onclick = fn; };
    imp('#a05', () => Formatos.imprimir(Formatos.actaConciliacion(inv, filasConciliacion(inv, universo, r), ctx())));
    imp('#a06', () => Formatos.imprimir(Formatos.informeFinal(Object.assign({}, inv, { informe: Object.assign({}, def, Object.fromEntries(Object.entries(inv.informe).filter(([, v]) => v))) }), r, ctx())));
    imp('#a09', () => Formatos.imprimir(Formatos.comunicacionInventario(inv, ctx())));
    imp('#gPre', async () => { if (await actualizar({ oficio: val(raiz, '#ofi'), presentado: val(raiz, '#pre') })) { await recargar(); toast('Presentación guardada.'); vistaInventario(id); } });
    if (!editable) return;

    const pf = raiz.querySelector('#planFecha');
    if (pf) {
      const gPlan = async () => { inv.plan_fecha = val(raiz, '#planFecha'); inv.plan_comunicacion = val(raiz, '#planCom'); await actualizar({ plan_fecha: inv.plan_fecha, plan_comunicacion: inv.plan_comunicacion }); };
      pf.onchange = gPlan; raiz.querySelector('#planCom').onchange = gPlan;
    }
    const tv = raiz.querySelector('#tv');
    tv.onchange = async () => { inv.tipo_verificacion = tv.value; await actualizar({ tipo_verificacion: tv.value }); };
    let lista = [];
    const pintar = () => {
      const u = val(raiz, '#iu'); const q = val(raiz, '#iq').toLowerCase();
      lista = universo.filter((b) => q ? [b.codigo, b.descripcion, b.serie, b.codigo_interno].join(' ').toLowerCase().includes(q) : (u && b.ubicacion === u)).slice(0, 300);
      raiz.querySelector('#it').innerHTML = lista.map((b) => {
        const v = inv.verif[b.codigo] || {};
        const soloVer = b.situacion === 'BAJA';
        return `<tr data-c="${esc(b.codigo)}"><td><select data-k="encontrado" style="width:auto">${opciones([['', '—'], ['si', 'Sí'], ['no', 'No']], v.encontrado === undefined ? '' : (v.encontrado ? 'si' : 'no'))}</select></td>
          <td class="mono">${esc(b.codigo)}</td><td>${esc(b.descripcion)}${b.situacion !== 'ACTIVO' ? ' ' + chipSituacion(b.situacion) : ''}</td>
          <td><select data-k="uso" style="width:auto" ${soloVer ? 'disabled' : ''}>${opciones([['U', 'U'], ['D', 'D']], v.uso || 'U')}</select></td>
          <td><select data-k="estado" ${soloVer ? 'disabled' : ''}>${opciones(Core.ESTADOS_CONSERVACION, v.estado || b.estado)}</select></td>
          <td><select data-k="ubicacion" ${soloVer ? 'disabled' : ''}>${opciones(opcUbic(), v.ubicacion || b.ubicacion)}</select></td>
          <td><select data-k="responsable" ${soloVer ? 'disabled' : ''}>${opciones(opcPersonal(), v.responsable !== undefined ? v.responsable : b.responsable, '— Sin usuario')}</select></td>
          <td><input data-k="obs" value="${esc(v.obs)}"></td></tr>`;
      }).join('') || '<tr><td colspan="8" class="muted">Sin bienes para el filtro.</td></tr>';
    };
    const registrar = (tr) => {
      const c = tr.dataset.c;
      const g = (k) => tr.querySelector(`[data-k=${k}]`).value;
      const enc = g('encontrado');
      if (!enc) { delete inv.verif[c]; return [c, null]; }
      inv.verif[c] = enc === 'no' ? { encontrado: false, obs: g('obs'), fecha: Core.hoyISO(), usuario: S.usuario.usuario }
        : { encontrado: true, uso: g('uso'), estado: g('estado'), ubicacion: g('ubicacion'), responsable: g('responsable'), obs: g('obs'),
          tipo: inv.tipo_verificacion || 'F', fecha: Core.hoyISO(), usuario: S.usuario.usuario };
      return [c, inv.verif[c]];
    };
    raiz.querySelector('#iu').onchange = () => { raiz.querySelector('#iq').value = ''; pintar(); };
    raiz.querySelector('#iq').oninput = pintar;
    raiz.querySelector('#it').onchange = async (e) => {
      const tr = e.target.closest('tr[data-c]'); if (!tr) return;
      if (e.target.dataset.k !== 'encontrado' && !tr.querySelector('[data-k=encontrado]').value) tr.querySelector('[data-k=encontrado]').value = 'si';
      const [c, v] = registrar(tr); await intentar(() => R.verificar(id, c, v));
    };
    raiz.querySelector('#todosOk').onclick = async () => {
      const mapa = {};
      raiz.querySelectorAll('#it tr[data-c]').forEach((tr) => { const s = tr.querySelector('[data-k=encontrado]'); if (!s.value) { s.value = 'si'; const [c, v] = registrar(tr); mapa[c] = v; } });
      if (Object.keys(mapa).length) await intentar(() => R.verificarVarios(id, mapa));
      toast('Bienes visibles marcados como encontrados.');
    };
    raiz.querySelector('#sob').onclick = () => modal(`<h2>Registrar bien sobrante</h2><p class="muted pequeno">Bien que se encuentra físicamente pero no figura en el registro (art. 4.2.f).
      Su incorporación requiere saneamiento: posesión mínima de 1 año (art. 39), publicación por 10 días hábiles, informe técnico y resolución (art. 41).</p>
      <form id="fs"><div class="campos"><div class="campo ancho"><label class="req">Denominación</label><input name="descripcion" required></div>
      <div class="campo"><label>Marca</label><input name="marca"></div><div class="campo"><label>Serie</label><input name="serie"></div>
      <div class="campo"><label>Estado</label><select name="estado">${opciones(Core.ESTADOS_CONSERVACION, 'Regular')}</select></div>
      <div class="campo"><label>Ubicación</label><select name="ubicacion">${opciones(opcUbic())}</select></div>
      <div class="campo"><label>En posesión desde (declaración jurada, art. 39)</label><input type="date" name="fecha_posesion"></div>
      <div class="campo"><label>Origen conocido / propietario (art. 38)</label><input name="origen"></div>
      <div class="campo ancho"><label>Observaciones</label><input name="obs"></div></div>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Agregar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fs').onsubmit = async (e) => {
        e.preventDefault(); const fd = new FormData(e.target); const o = {};
        ['descripcion', 'marca', 'serie', 'estado', 'ubicacion', 'fecha_posesion', 'origen', 'obs'].forEach((k) => { o[k] = Core.limpiar(fd.get(k)); });
        o.descripcion = o.descripcion.toUpperCase();
        await intentar(() => R.agregarSobrante(id, o)); cerrar(); await recargar(); vistaInventario(id);
      };
    });
    const leerGabinete = () => {
      raiz.querySelectorAll('[data-cta]').forEach((i) => { if (i.value === '') delete inv.conciliacion[i.dataset.cta]; else inv.conciliacion[i.dataset.cta] = Number(i.value); });
      raiz.querySelectorAll('[data-inf]').forEach((t) => { inv.informe[t.dataset.inf] = t.value.trim(); });
    };
    imp('#gGab', async () => { leerGabinete(); if (await actualizar({ conciliacion: inv.conciliacion, informe: inv.informe })) { await recargar(); toast('Gabinete guardado.'); vistaInventario(id); } });
    imp('#proponer', () => { raiz.querySelectorAll('[data-inf]').forEach((t) => { if (!t.value.trim() && def[t.dataset.inf]) t.value = def[t.dataset.inf]; }); toast('Texto sugerido agregado. Revíselo y guarde.'); });
    raiz.querySelector('#cer').onclick = () => {
      if (anual) { leerGabinete(); actualizar({ conciliacion: inv.conciliacion, informe: inv.informe }); }
      const rr = Core.resultadosInventario(universo, inv.verif); // vista previa; el repositorio recalcula al cerrar
      const reg = Core.regularizacionInventario(rr);
      modal(`<h2>Cerrar ${anual ? 'inventario' : 'supervisión'}</h2>
        ${rr.sinVerificar.length ? `<div class="aviso warn">${rr.sinVerificar.length} bienes sin verificar. No se modificarán y quedarán reportados en el informe.</div>` : ''}
        ${rr.bajasNoUbicadas.length ? `<div class="aviso warn">${rr.bajasNoUbicadas.length} bienes dados de baja no fueron ubicados (art. 31.2). Se reportan en el informe.</div>` : ''}
        <p>Se registrará un acto de regularización con ${Object.keys(reg).length} bien(es): ${rr.diferencias.length} con diferencias y ${rr.faltantes.length} faltantes (pasan a situación "Faltante").</p>
        <div class="barra"><button class="btn primario" id="ok">Cerrar</button><button class="btn" data-cerrar>Cancelar</button></div>`,
      (m, cerrar) => {
        m.querySelector('#ok').onclick = async () => {
          if (!(await intentar(() => R.cerrarInventario(id)))) return;
          cerrar(); await recargar(); toast('Proceso cerrado.'); vistaInventario(id);
        };
      });
    };
  }

  // ---------------- Saneamiento (Título VI) ----------------
  function vistaSaneamiento() {
    const faltantes = S.bienes.filter((b) => b.situacion === 'FALTANTE');
    const sobrantes = S.inventarios.flatMap((inv) => (inv.sobrantes || []).map((s, i) => ({ s, inv, i }))).filter((x) => !x.s.alta);
    const causalF = 'Saneamiento administrativo de bienes muebles patrimoniales faltantes';
    const causalS = 'Saneamiento administrativo de bienes muebles sobrantes';
    marco(`<div class="barra"><h1>Saneamiento administrativo</h1>${ref('Título VI · Arts. 38–46')}</div>
      <div class="tarjeta"><h2>Bienes faltantes ${ref('Arts. 44–46')}</h2>
        <p class="pequeno">Procede cuando se desconoce la ubicación del bien y no hay documentación para su baja, o cuando no es posible recuperarlo (art. 44). Requiere un informe técnico y la resolución de la OGA
        que aprueba la baja por la causal del art. 48.1.i (art. 45). La OGA comunica las circunstancias al órgano del Sistema Nacional de Control (art. 46). Si hubo sustracción, use la causal "Sustracción", con denuncia.</p>
        ${faltantes.length ? `<div class="tabla-wrap"><table><thead><tr><th>Código</th><th>Denominación</th><th>Última ubicación</th><th>Último usuario</th><th class="num">Valor</th></tr></thead><tbody>
          ${faltantes.map((b) => `<tr class="click" data-ir="#/bien/${esc(b.codigo)}"><td class="mono">${esc(b.codigo)}</td><td>${esc(b.descripcion)}</td><td>${esc(b.ubicacion)}</td><td>${esc(nombrePersona(b.responsable))}</td><td class="num">${soles(b.valor)}</td></tr>`).join('')}
          </tbody></table></div>${puede.registrar() ? `<div class="barra" style="margin-top:.75rem"><a class="btn primario" href="#/nuevo/BAJA?causal=${encodeURIComponent(causalF)}&sel=${faltantes.map((b) => b.codigo).join(',')}">Baja por saneamiento de faltantes</a>
          <a class="btn" href="#/nuevo/BAJA?causal=Sustracci%C3%B3n&sel=${faltantes.map((b) => b.codigo).join(',')}">Baja por sustracción (con denuncia)</a></div>` : ''}`
        : '<p class="muted">No hay bienes faltantes.</p>'}</div>
      <div class="tarjeta"><h2>Bienes sobrantes ${ref('Arts. 38–43')}</h2>
        <p class="pequeno">Procedimiento (art. 41): 1) verificar la posesión mínima de 1 año (art. 39); 2) si se conoce al propietario, notificarlo para que recoja el bien en 10 días hábiles; si no,
        publicar la relación en la sede y en el portal por 10 días hábiles (oposición, art. 42); 3) informe técnico con la valorización; 4) resolución de la OGA; 5) alta por la causal del art. 16.1.i.
        Los sobrantes RAEE, en chatarra o sin utilidad no se sanean: pasan a disposición (art. 43).</p>
        ${sobrantes.length ? `<div class="tabla-wrap"><table><thead><tr><th>Inventario</th><th>Denominación</th><th>Estado</th><th>Ubicación</th><th>Posesión desde</th><th>Evaluación</th><th></th></tr></thead><tbody>
          ${sobrantes.map((x) => { const ev = Core.evaluarSobrante(x.s); return `<tr><td class="mono">${esc(x.inv.id)}</td><td>${esc(x.s.descripcion)}</td><td>${esc(x.s.estado)}</td><td>${esc(x.s.ubicacion)}</td><td>${fecha(x.s.fecha_posesion)}</td>
            <td>${esc(ev.texto)}</td><td>${ev.procede && puede.registrar() ? `<a class="btn chico" href="#/nuevo/ALTA?causal=${encodeURIComponent(causalS)}&sobrante=${encodeURIComponent(x.inv.id + ':' + x.i)}">Registrar alta</a>` : ''}</td></tr>`; }).join('')}
          </tbody></table></div>` : '<p class="muted">No hay sobrantes pendientes. Se registran durante el trabajo de campo del inventario.</p>'}</div>`);
  }

  // ---------------- Mantenimiento y aseguramiento (Título IX) ----------------
  function vistaMantenimiento() {
    const k = Core.indicadores(S.bienes, S.movs, S.cfg.uit);
    const mantos = S.movs.filter((m) => !m.anulado && (m.tipo === 'MANTENIMIENTO' || (m.tipo === 'SALIDA' && m.causal === 'Mantenimiento')));
    const vigentes = S.bienes.filter((b) => !['DISPUESTO', 'BAJA'].includes(b.situacion));
    const conPoliza = vigentes.filter((b) => b.poliza);
    const vencidas = conPoliza.filter((b) => b.poliza_vence && b.poliza_vence < Core.hoyISO());
    const enMant = S.bienes.filter((b) => b.situacion === 'EN_SALIDA' && S.movs.some((m) => m.tipo === 'SALIDA' && m.causal === 'Mantenimiento' && !m.anulado && m.items.includes(b.codigo)));
    marco(`<div class="barra"><h1>Mantenimiento y aseguramiento</h1>${ref('Título IX · Arts. 83–91')}
      ${puede.registrar() ? '<a class="btn primario" href="#/nuevo/MANTENIMIENTO">+ Registrar mantenimiento</a><a class="btn" href="#/nuevo/SALIDA?causal=Mantenimiento">Salida para mantenimiento</a>' : ''}</div>
      <div class="kpis"><div class="kpi"><div class="v">${soles(k.costoMantenimiento)}</div><div class="l">Costo de mantenimiento ${new Date().getFullYear()}</div></div>
        <div class="kpi"><div class="v">${enMant.length}</div><div class="l">Bienes fuera por mantenimiento</div></div>
        <div class="kpi"><div class="v">${conPoliza.length}</div><div class="l">Bienes con póliza registrada</div></div>
        <div class="kpi"><div class="v">${vencidas.length}</div><div class="l">Pólizas vencidas</div></div></div>
      <div class="grid g2"><div class="tarjeta"><h2>Plan de Mantenimiento ${ref('Directiva art. 86 · Reglamento CLAS art. 81.d')}</h2>
        <p class="pequeno">Documento multianual (mínimo 3 años) aprobado por resolución de la OGA, obligatorio desde 2023. Contiene la clasificación de los bienes, el diagnóstico, el tipo y la frecuencia de mantenimiento, y el cronograma. Además, el Reglamento de la Ley N° 29124 obliga al CLAS a ejecutar un plan anual de mantenimiento de la infraestructura, los vehículos y los equipos (art. 81.d).</p>
        <p>${S.cfg.plan_mantenimiento ? '<span class="chip ok">Aprobado</span> ' + esc(S.cfg.plan_mantenimiento) : '<span class="chip warn">No registrado</span> Regístrelo en Configuración.'}</p></div>
        <div class="tarjeta"><h2>Plan de Aseguramiento ${ref('Arts. 89–90 · 6ª y 7ª DCF')}</h2>
        <p class="pequeno">Desde 2023 los bienes deben contar con póliza de seguro según el Plan de Aseguramiento. El usuario reporta todo siniestro a la OCP en 24 horas (art. 89.4). Registre la póliza en cada bien (Corregir datos).</p>
        <p>${S.cfg.plan_aseguramiento ? '<span class="chip ok">Aprobado</span> ' + esc(S.cfg.plan_aseguramiento) : '<span class="chip warn">No registrado</span> Regístrelo en Configuración.'} · ${k.sinPoliza} bienes sin póliza registrada.</p></div></div>
      <div class="tarjeta"><h2>Registro de mantenimientos ${ref('Art. 88')}</h2>${tablaMovs(mantos)}</div>
      ${vencidas.length ? `<div class="tarjeta"><h2>Pólizas vencidas</h2><div class="tabla-wrap"><table><thead><tr><th>Código</th><th>Denominación</th><th>Póliza</th><th>Venció</th></tr></thead><tbody>
        ${vencidas.map((b) => `<tr class="click" data-ir="#/bien/${esc(b.codigo)}"><td class="mono">${esc(b.codigo)}</td><td>${esc(b.descripcion)}</td><td>${esc(b.poliza)}</td><td>${fecha(b.poliza_vence)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`);
  }

  // ---------------- Reportes ----------------
  function vistaReportes() {
    const k = Core.indicadores(S.bienes, S.movs, S.cfg.uit);
    const porResp = S.personal.map((p) => ({ p, bienes: S.bienes.filter((b) => b.responsable === p.id && !['DISPUESTO', 'BAJA'].includes(b.situacion)) })).filter((x) => x.bienes.length);
    marco(`<div class="barra"><h1>Reportes</h1></div>
      <div class="grid g2">
        <div class="tarjeta"><h2>Exportaciones</h2><div class="barra">
          <button class="btn" id="r1">Registro patrimonial completo (Excel)</button>
          <button class="btn" id="r2">Resumen por ubicación (Excel)</button>
          <button class="btn" id="r3">Candidatos a baja (Excel)</button>
          <button class="btn" id="r4">Calidad del registro (Excel)</button>
          <button class="btn" id="r5">Bienes dados de baja y plazo de disposición (Excel)</button></div></div>
        <div class="tarjeta"><h2>Calidad del registro ${ref('Art. 22')}</h2><table><tbody>
          <tr><td>Activos sin usuario responsable</td><td class="num">${k.sinResponsable}</td></tr><tr><td>Sin ubicación física</td><td class="num">${k.sinUbicacion}</td></tr>
          <tr><td>Sin cuenta contable</td><td class="num">${k.sinCuentaContable}</td></tr><tr><td>Sin código interno</td><td class="num">${k.sinCodigoInterno}</td></tr>
          <tr><td>Sin número de serie</td><td class="num">${k.sinSerie}</td></tr><tr><td>Titularidad no determinada</td><td class="num">${k.origenNoDeterminado}</td></tr>
          <tr><td>Actos registrados después de 10 días hábiles (art. 23)</td><td class="num">${k.registrosExtemporaneos}</td></tr></tbody></table></div></div>
      <div class="tarjeta"><h2>Informe de situación patrimonial ${ref('D.S. 017-2008-SA, arts. 36.n, 43.f, 49.c, 49.h y 104')}</h2>
        <p class="pequeno muted">El Gerente informa mensualmente al Consejo Directivo y semestralmente a la Asamblea General (art. 49.c), presenta un diagnóstico dentro de los 60 días de asumir el cargo (art. 49.h) y rinde cuentas (art. 104).</p>
        <div class="campos"><div class="campo"><label>Tipo de informe</label><select id="itipo">${opciones(Object.entries(Formatos.TIPOS_INFORME).map(([k, v]) => [k, `${v.titulo.split(' — ')[0].replace('INFORME ', '').toLowerCase()} — ${v.a} (${v.ref})`]), 'MENSUAL')}</select></div>
        <div class="campo"><label>Desde</label><input type="date" id="idesde" value="${Core.hoyISO().slice(0, 8)}01"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="ihasta" value="${Core.hoyISO()}"></div></div>
        <div class="barra" style="margin-top:.75rem"><button class="btn primario" id="isit">Imprimir informe</button></div></div>
      <div class="tarjeta"><h2>Fichas de asignación por usuario ${ref('Anexo N° 03')}</h2>
        ${porResp.length ? `<div class="tabla-wrap"><table><thead><tr><th>Usuario</th><th>Unidad</th><th class="num">Bienes</th><th class="num">Valor</th><th></th></tr></thead><tbody>
        ${porResp.map((x) => `<tr><td>${esc(x.p.nombres)}${x.p.activo ? '' : ' <span class="chip bad">Inactivo</span>'}</td><td>${esc(x.p.unidad || x.p.cargo)}</td><td class="num">${x.bienes.length}</td><td class="num">${soles(sumaValor(x.bienes))}</td>
        <td><button class="btn chico" data-p="${esc(x.p.id)}">Imprimir ficha</button></td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted">Aún no hay bienes asignados. Registre el acto "Asignación en uso".</p>'}</div>`);
    const hoy = Core.hoyISO();
    raiz.querySelector('#r1').onclick = () => descargarExcel(`registro_patrimonial_${hoy}.xlsx`, { Registro: S.bienes.map(filaExport) });
    raiz.querySelector('#r2').onclick = () => {
      const g = {};
      S.bienes.filter((b) => !['DISPUESTO', 'BAJA'].includes(b.situacion)).forEach((b) => {
        const x = g[b.ubicacion] = g[b.ubicacion] || { ubicacion: b.ubicacion, bienes: 0, valor: 0, Nuevo: 0, Bueno: 0, Regular: 0, Malo: 0, RAEE: 0, Chatarra: 0, sin_usuario: 0 };
        x.bienes++; x.valor += Number(b.valor || 0); x[b.estado]++; if (!b.responsable) x.sin_usuario++;
      });
      descargarExcel(`resumen_ubicacion_${hoy}.xlsx`, { 'Por ubicación': Object.values(g).sort((a, b) => b.bienes - a.bienes) });
    };
    raiz.querySelector('#r3').onclick = () => descargarExcel(`candidatos_baja_${hoy}.xlsx`, {
      Candidatos: S.bienes.filter((b) => b.situacion === 'ACTIVO' && ['Malo', 'RAEE', 'Chatarra'].includes(b.estado)).map((b) => Object.assign(filaExport(b), {
        causal_sugerida: b.estado === 'RAEE' ? 'RAEE (art. 48.1.h)' : b.estado === 'Chatarra' ? 'Estado de chatarra (art. 48.1.d)' : 'Evaluar: mantenimiento o reparación onerosa (48.1.f), falta de idoneidad (48.1.e) u obsolescencia técnica (48.1.g)',
        requisito: 'Informe técnico (Anexo N° 01) y resolución de la OGA (art. 49.1)' }))
    });
    raiz.querySelector('#r4').onclick = () => descargarExcel(`calidad_registro_${hoy}.xlsx`, {
      Observaciones: S.bienes.filter((b) => b.situacion !== 'DISPUESTO').map((b) => ({ codigo_patrimonial: b.codigo, denominacion: b.descripcion,
        sin_usuario: b.responsable ? '' : 'X', sin_ubicacion: (!b.ubicacion || b.ubicacion === 'SIN UBICACION') ? 'X' : '', sin_cuenta_contable: b.cuenta_contable ? '' : 'X',
        sin_codigo_interno: b.codigo_interno ? '' : 'X', titularidad_no_determinada: b.origen === 'NO_DETERMINADO' ? 'X' : '', sin_orden_compra: b.nro_orden ? '' : 'X', sin_poliza: b.poliza ? '' : 'X' }))
    });
    raiz.querySelector('#r5').onclick = () => descargarExcel(`bajas_${hoy}.xlsx`, {
      Bajas: S.bienes.filter((b) => b.fecha_baja).map((b) => Object.assign(filaExport(b), { plazo_disposicion: b.situacion === 'BAJA' ? Core.sumarMeses(b.fecha_baja, 5) : '', vencido: b.situacion === 'BAJA' && Core.sumarMeses(b.fecha_baja, 5) < hoy ? 'SI' : '' }))
    });
    raiz.querySelectorAll('[data-p]').forEach((btn) => {
      btn.onclick = () => { const x = porResp.find((y) => y.p.id === btn.dataset.p); Formatos.imprimir(Formatos.relacionResponsable(x.p, x.bienes, ctx()), true); };
    });
    const itipo = raiz.querySelector('#itipo');
    itipo.onchange = () => { // propone el período según el tipo de informe
      const h = Core.hoyISO(); const y = h.slice(0, 4); const m = Number(h.slice(5, 7));
      raiz.querySelector('#idesde').value = itipo.value === 'MENSUAL' ? h.slice(0, 8) + '01' : itipo.value === 'DIAGNOSTICO' ? '' : (m <= 6 ? `${y}-01-01` : `${y}-07-01`);
      raiz.querySelector('#ihasta').value = h;
    };
    raiz.querySelector('#isit').onclick = () => {
      const tipo = itipo.value; const desde = val(raiz, '#idesde') || '0000-01-01'; const hasta = val(raiz, '#ihasta') || hoy;
      const movs = S.movs.filter((m) => !m.anulado && m.fecha >= desde && m.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha));
      const vigentes = S.bienes.filter((b) => !['DISPUESTO', 'BAJA'].includes(b.situacion));
      const titularidad = {};
      vigentes.forEach((b) => { const x = titularidad[b.origen] = titularidad[b.origen] || { n: 0, v: 0 }; x.n++; x.v += Number(b.valor || 0); });
      const mantos = movs.filter((m) => m.tipo === 'MANTENIMIENTO');
      Formatos.imprimir(Formatos.informeSituacion(tipo, desde, hasta, {
        indicadores: k, movs, titularidad, alertas: Core.alertasNormativas(S.bienes, S.movs, S.inventarios),
        mantenimientos: mantos.length, costoMantenimiento: mantos.reduce((t, m) => t + Number(m.costo || 0), 0),
        porTransferir: S.bienes.filter((b) => b.situacion !== 'DISPUESTO' && Core.ORIGENES_POR_TRANSFERIR.includes(b.origen))
      }, ctx()));
    };
  }

  // ---------------- Usuarios (servidores) y ubicaciones ----------------
  function vistaMaestros() {
    const ed = puede.registrar();
    marco(`<div class="barra"><h1>Usuarios y ubicaciones</h1></div>
      <p class="muted pequeno">Usuario (art. 4.2.o): servidor civil o persona que recibe bienes para el desempeño de sus actividades. Sus datos se usan solo para el control patrimonial (Ley N° 29733).</p>
      <div class="grid g2">
      <div class="tarjeta"><div class="barra"><h2 style="flex:1;margin:0">Usuarios de bienes</h2>${ed ? '<button class="btn" id="np">+ Agregar</button>' : ''}</div>
        <div class="tabla-wrap"><table><thead><tr><th>Nombres</th><th>DNI</th><th>Unidad</th><th>Condición</th><th class="num">Bienes</th><th></th></tr></thead><tbody>
        ${S.personal.map((p) => `<tr><td>${esc(p.nombres)}${p.activo ? '' : ' <span class="chip">Inactivo</span>'}</td><td>${esc(p.dni)}</td><td>${esc(p.unidad || p.cargo)}</td><td>${esc(p.condicion)}</td>
          <td class="num">${S.bienes.filter((b) => b.responsable === p.id && !['DISPUESTO', 'BAJA'].includes(b.situacion)).length}</td><td>${ed ? `<button class="btn chico" data-ep="${esc(p.id)}">Editar</button>` : ''}</td></tr>`).join('') ||
          '<tr><td colspan="6" class="muted">Sin registros.</td></tr>'}</tbody></table></div></div>
      <div class="tarjeta"><div class="barra"><h2 style="flex:1;margin:0">Ubicaciones físicas</h2>${ed ? '<button class="btn" id="nu">+ Agregar</button>' : ''}</div>
        <div class="tabla-wrap"><table><thead><tr><th>Ubicación</th><th>Piso</th><th class="num">Bienes</th><th></th></tr></thead><tbody>
        ${S.ubic.map((u) => `<tr><td>${esc(u.nombre)}${u.activo ? '' : ' <span class="chip">Inactiva</span>'}</td><td>${esc(u.piso)}</td>
          <td class="num">${S.bienes.filter((b) => b.ubicacion === u.nombre && b.situacion !== 'DISPUESTO').length}</td>
          <td>${ed ? `<button class="btn chico" data-eu="${esc(u.nombre)}">Editar</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div></div>`);
    if (!ed) return;
    const formPersona = (p) => modal(`<h2>${p ? 'Editar' : 'Agregar'} usuario</h2><form id="fp"><div class="campos">
      <div class="campo ancho"><label class="req">Apellidos y nombres</label><input name="nombres" value="${esc(p && p.nombres)}" required></div>
      <div class="campo"><label class="req">DNI</label><input name="dni" value="${esc(p && p.dni)}" pattern="\\d{8}" maxlength="8" required></div>
      <div class="campo"><label>Correo electrónico</label><input type="email" name="correo" value="${esc(p && p.correo)}"></div>
      <div class="campo"><label>Órgano / unidad orgánica / servicio</label><input name="unidad" value="${esc(p && (p.unidad || p.cargo))}"></div>
      <div class="campo"><label>Cargo</label><input name="cargo" value="${esc(p && p.cargo)}"></div>
      <div class="campo"><label>Local o sede</label><input name="local" value="${esc((p && p.local) || S.cfg.establecimiento)}"></div>
      <div class="campo"><label>Dirección (solo teletrabajo, art. 29)</label><input name="direccion" value="${esc(p && p.direccion)}"></div>
      <div class="campo"><label>Condición laboral</label><select name="condicion">${opciones(['D.L. 276', 'D.L. 1057 (CAS)', 'Contrato CLAS (régimen privado)', 'Locación de servicios', 'SERUMS', 'Otro'], p && p.condicion, '—')}</select></div>
      <div class="campo"><label>Activo</label><select name="activo">${opciones([['1', 'Sí'], ['0', 'No (cesado)']], p && !p.activo ? '0' : '1')}</select></div></div>
      <p class="muted pequeno">Al cese del vínculo, registre primero la devolución de los bienes (art. 29.3.a).</p>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fp').onsubmit = async (e) => {
        e.preventDefault(); const fd = new FormData(e.target); const g = (k) => Core.limpiar(fd.get(k));
        const dni = g('dni');
        if (S.personal.some((x) => x.dni === dni && (!p || x.id !== p.id))) return toast('Ya existe un usuario con ese DNI.');
        const activo = fd.get('activo') === '1';
        if (p && !activo && S.bienes.some((b) => b.responsable === p.id && !['DISPUESTO', 'BAJA'].includes(b.situacion))) {
          return toast('El usuario aún tiene bienes asignados. Registre primero la devolución.');
        }
        const o = Object.assign({}, p || {}, { nombres: g('nombres').toUpperCase(), dni, correo: g('correo'), unidad: g('unidad'), cargo: g('cargo'),
          local: g('local'), direccion: g('direccion'), condicion: fd.get('condicion'), activo });
        if (!(await intentar(() => R.guardarPersona(o)))) return;
        cerrar(); await recargar(); vistaMaestros();
      };
    });
    const formUbic = (u) => modal(`<h2>${u ? 'Editar' : 'Agregar'} ubicación</h2><form id="fu"><div class="campos">
      <div class="campo ancho"><label class="req">Nombre</label><input name="nombre" value="${esc(u && u.nombre)}" ${u ? 'readonly' : ''} required></div>
      <div class="campo"><label>Piso</label><input name="piso" value="${esc(u && u.piso)}"></div>
      <div class="campo"><label>Activa</label><select name="activo">${opciones([['1', 'Sí'], ['0', 'No']], u && !u.activo ? '0' : '1')}</select></div></div>
      ${u ? '<p class="muted pequeno">El nombre no se edita, para no romper la trazabilidad. Para unificar ubicaciones, registre un desplazamiento interno y desactive la ubicación antigua.</p>' : ''}
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fu').onsubmit = async (e) => {
        e.preventDefault(); const fd = new FormData(e.target);
        const nombre = Core.limpiar(fd.get('nombre')).toUpperCase();
        if (!u && S.ubic.some((x) => x.nombre === nombre)) return toast('La ubicación ya existe.');
        if ((await intentar(() => R.guardarUbicacion({ nombre, piso: Core.limpiar(fd.get('piso')), activo: fd.get('activo') === '1' }, !u).then(() => true))) !== true) return;
        cerrar(); await recargar(); vistaMaestros();
      };
    });
    raiz.querySelector('#np').onclick = () => formPersona(null);
    raiz.querySelector('#nu').onclick = () => formUbic(null);
    raiz.querySelectorAll('[data-ep]').forEach((b) => { b.onclick = () => formPersona(S.personal.find((p) => p.id === b.dataset.ep)); });
    raiz.querySelectorAll('[data-eu]').forEach((b) => { b.onclick = () => formUbic(S.ubic.find((u) => u.nombre === b.dataset.eu)); });
  }

  // ---------------- Marco normativo ----------------
  function vistaNormativa() {
    const N = Normativa;
    const t = N.informeSustento(S.cfg);
    marco(`<div class="barra"><h1>Marco normativo y sustento legal</h1><button class="btn primario" id="imp">Imprimir informe de sustento legal</button></div>
      <div class="tarjeta"><h2>Naturaleza del aplicativo</h2>${t.analisis.slice(0, 2).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      <div class="tarjeta"><h2>Correspondencia con la Directiva N° 0006-2021-EF/54.01 y el D.S. N° 017-2008-SA</h2><div class="tabla-wrap"><table><thead><tr><th>Módulo</th><th>Artículos</th><th>Formato</th><th>Control que aplica</th></tr></thead><tbody>
        ${N.MATRIZ.map((m) => `<tr><td><b>${esc(m[0])}</b></td><td>${esc(m[1])}</td><td>${esc(m[2])}</td><td>${esc(m[3])}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="tarjeta"><h2>Reglamento de la Ley N° 29124 (D.S. N° 017-2008-SA): disposiciones sobre bienes</h2><div class="tabla-wrap"><table><thead><tr><th>Artículo</th><th>Contenido</th><th>Aplicación en el aplicativo</th></tr></thead><tbody>
        ${N.REGLAMENTO_CLAS.map((r) => `<tr><td style="white-space:nowrap"><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="tarjeta"><h2>Puntos de interpretación por definir con la DIRESA / Unidad Ejecutora</h2>
        ${N.AMBIGUEDADES.map((a) => `<div class="aviso warn"><b>${esc(a[0])}.</b> ${esc(a[1])}</div>`).join('')}</div>
      <div class="tarjeta"><h2>Base legal</h2><div class="tabla-wrap"><table><tbody>
        ${N.BASE_LEGAL.map((b) => `<tr><td style="width:45%"><b>${esc(b[0])}</b></td><td>${esc(b[1])}</td></tr>`).join('')}</tbody></table></div></div>`);
    raiz.querySelector('#imp').onclick = () => Formatos.imprimir(Formatos.sustentoLegal(S.cfg));
  }

  // ---------------- Bitácora ----------------
  async function vistaBitacora() {
    if (!puede.administrar()) return marco('<div class="aviso bad">Acceso restringido.</div>');
    const reg = (await intentar(() => R.bitacora())) || [];
    marco(`<div class="barra"><h1>Bitácora de auditoría</h1><button class="btn" id="exp">Exportar</button></div>
      <p class="muted pequeno">Registro que no se edita desde el aplicativo: ingresos, correcciones, actos, anulaciones, inventarios, cargas y restauraciones.</p>
      <div class="tabla-wrap"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>
      ${reg.slice(0, 1000).map((r) => `<tr><td style="white-space:nowrap">${new Date(r.fecha).toLocaleString('es-PE')}</td><td>${esc(r.usuario)}</td><td>${esc(r.accion)}</td><td>${esc(r.detalle)}</td></tr>`).join('')}
      </tbody></table></div>`);
    raiz.querySelector('#exp').onclick = () => descargarExcel(`bitacora_${Core.hoyISO()}.xlsx`, { Bitacora: reg });
  }

  // ---------------- Configuración ----------------
  async function vistaConfig() {
    if (!puede.administrar()) return marco('<div class="aviso bad">Acceso restringido.</div>');
    const usuarios = (await intentar(() => R.listarUsuarios())) || [];
    const c = S.cfg;
    const campos = [['entidad', 'Entidad u Organización'], ['sigla', 'Siglas (etiquetas)'], ['establecimiento', 'Establecimiento'], ['direccion', 'Dirección del local'],
      ['ubigeo', 'Distrito — provincia — departamento'], ['red', 'Unidad Ejecutora / Red'], ['ruc', 'RUC'], ['jefe', 'Gerente del CLAS / jefe del establecimiento (Reglamento, arts. 48–49)'], ['presidente_cd', 'Presidente(a) del Consejo Directivo (Reglamento, art. 44)'],
      ['oga_nombre', 'OGA: oficina o cargo (art. 4.1.h)'], ['oga_responsable', 'OGA: responsable'], ['responsable_patrimonio', 'Responsable de Control Patrimonial (OCP)'],
      ['responsable_patrimonio_dni', 'DNI del responsable de la OCP'], ['responsable_contabilidad', 'Responsable de Contabilidad'],
      ['plan_mantenimiento', 'Plan de Mantenimiento: documento (Directiva art. 86; plan anual, Reglamento art. 81.d)'], ['plan_aseguramiento', 'Plan de Aseguramiento: resolución (art. 90)'],
      ['uit', 'Valor UIT (S/)'], ['uit_anio', 'Año de la UIT']];
    marco(`<div class="barra"><h1>Configuración</h1></div>
      <div class="tarjeta"><h2>Datos institucionales y responsables</h2><form id="fc"><div class="campos">
        ${campos.map(([k, l]) => `<div class="campo"><label>${l}</label><input name="${k}" value="${esc(c[k])}" ${k.startsWith('uit') ? 'type="number" step="1"' : ''}></div>`).join('')}</div>
        <p class="muted pequeno">Estos datos aparecen en los formatos. La UIT se usa para la clasificación referencial (1/4 UIT): actualícela cada año.</p>
        <button class="btn primario">Guardar</button></form></div>
      <div class="tarjeta"><h2>Carga del inventario</h2>
        <p class="pequeno">Importa un Excel con las columnas del inventario institucional (codigo_patrimonial, codigo_INTERNO, descripcion, MARCA, modelo, nro_serie, medidas, color,
        ESTADO CONSERVACION, nombre_depend, ubicac_fisica, nro_orden, fecha_compra, valor_inicial y, opcionalmente, cuenta_contable). Los códigos ya registrados se omiten (art. 20.3).</p>
        <div class="barra"><button class="btn" id="semilla" ${S.bienes.length ? 'disabled' : ''}>Cargar inventario 2025 incluido (537 bienes)</button>
        <label class="btn" style="margin:0">Importar Excel…<input type="file" id="xls" accept=".xlsx,.xls" hidden></label></div></div>
      <div class="tarjeta"><h2>Respaldo</h2>
        ${R.modo === 'servidor'
          ? '<p class="pequeno">Los datos están en el servidor institucional (Cloudflare D1), con recuperación a cualquier minuto de los últimos 30 días y copia semanal automática en el almacenamiento R2. Además puede descargar una copia manual.</p>'
          : '<p class="pequeno">Los datos se guardan en este navegador. Descargue un respaldo al menos una vez por semana y guárdelo en un medio institucional.</p>'}
        <div class="barra"><button class="btn primario" id="resp">Descargar respaldo (JSON)</button>
        ${R.modo === 'servidor' ? '' : '<label class="btn peligro" style="margin:0">Restaurar respaldo…<input type="file" id="rest" accept=".json" hidden></label>'}</div></div>
      <div class="tarjeta"><div class="barra"><h2 style="flex:1;margin:0">Usuarios del sistema</h2><button class="btn" id="nus">+ Agregar usuario</button></div>
        <div class="tabla-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
        ${usuarios.map((u) => `<tr><td>${esc(u.usuario)}</td><td>${esc(u.nombre)}</td><td>${ROLES[u.rol] || u.rol}</td><td>${u.activo ? 'Activo' : 'Inactivo'}</td>
          <td>${u.usuario !== S.usuario.usuario ? `<button class="btn chico" data-u="${esc(u.usuario)}">${u.activo ? 'Desactivar' : 'Activar'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`);
    raiz.querySelector('#fc').onsubmit = async (e) => {
      e.preventDefault(); const fd = new FormData(e.target); const n = {};
      campos.forEach(([k]) => { n[k] = k.startsWith('uit') ? Number(fd.get(k)) : Core.limpiar(fd.get(k)); });
      if ((await intentar(() => R.guardarConfig(n).then(() => true))) !== true) return;
      await recargar(); toast('Configuración guardada.');
    };
    raiz.querySelector('#semilla').onclick = async () => {
      try {
        const filas = await (await fetch('data/inventario-2025.json')).json();
        const r = await R.cargaInicial(filas, 'INVENTARIO_CLAS_QUERENCIA_2025.xlsx');
        await recargar(); toast(`${r.cargados} bienes cargados; ${r.omitidos} omitidos.`); vistaConfig();
      } catch (err) { toast('No se pudo leer el archivo incluido. Si abrió la app con doble clic, use "Importar Excel".'); }
    };
    raiz.querySelector('#xls').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (typeof XLSX === 'undefined') return toast('No se pudo cargar la librería de Excel.');
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
      const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true });
      const r = await intentar(() => R.cargaInicial(filas, f.name));
      if (!r) return;
      await recargar(); toast(`${r.cargados} bienes cargados; ${r.omitidos} omitidos.`); vistaConfig();
    };
    raiz.querySelector('#resp').onclick = async () => {
      const d = await intentar(() => R.respaldo());
      if (d) descargarJSON(`respaldo_inventario_${Core.hoyISO()}.json`, d);
    };
    if (raiz.querySelector('#rest')) raiz.querySelector('#rest').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      modal(`<h2>Restaurar respaldo</h2><div class="aviso bad">Se reemplazarán TODOS los datos actuales por los del archivo "${esc(f.name)}".</div>
        <div class="barra"><button class="btn peligro" id="ok">Restaurar</button><button class="btn" data-cerrar>Cancelar</button></div>`, (m, cerrar) => {
        m.querySelector('#ok').onclick = async () => {
          try { await R.restaurar(JSON.parse(await f.text())); cerrar(); salir(); toast('Respaldo restaurado. Ingrese nuevamente.'); }
          catch (err) { toast(err.message); }
        };
      });
    };
    raiz.querySelector('#nus').onclick = () => modal(`<h2>Agregar usuario del sistema</h2><form id="fu"><div class="campos">
      <div class="campo"><label class="req">Usuario</label><input name="usuario" pattern="[a-z0-9._]{3,}" required></div>
      <div class="campo"><label class="req">Nombre</label><input name="nombre" required></div>
      <div class="campo"><label class="req">Rol</label><select name="rol">${opciones(Object.entries(ROLES), 'CONSULTA')}</select></div>
      <div class="campo"><label class="req">Clave temporal (mín. 8)</label><input name="clave" type="password" minlength="8" required></div></div>
      <p class="muted pequeno">El usuario deberá cambiar la clave en su primer ingreso.</p>
      <div class="barra" style="margin-top:1rem"><button class="btn primario">Crear</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (m, cerrar) => {
      m.querySelector('#fu').onsubmit = async (e) => {
        e.preventDefault(); const fd = new FormData(e.target); const u = Core.limpiar(fd.get('usuario')).toLowerCase();
        if ((await intentar(() => R.crearUsuario({ usuario: u, nombre: Core.limpiar(fd.get('nombre')), rol: fd.get('rol'), clave: fd.get('clave') }).then(() => true))) !== true) return;
        cerrar(); vistaConfig();
      };
    });
    raiz.querySelectorAll('[data-u]').forEach((b) => {
      b.onclick = async () => {
        const u = usuarios.find((x) => x.usuario === b.dataset.u);
        await intentar(() => R.activarUsuario(u.usuario, !u.activo));
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
      case 'etiquetas': return vistaEtiquetas();
      case 'actos': return vistaActos();
      case 'movimientos': return vistaMovimientos(q);
      case 'nuevo': return vistaNuevo(id, q);
      case 'movimiento': return vistaMovimiento(id);
      case 'inventario': return id ? vistaInventario(id) : vistaInventarios();
      case 'saneamiento': return vistaSaneamiento();
      case 'mantenimiento': return vistaMantenimiento();
      case 'reportes': return vistaReportes();
      case 'maestros': return vistaMaestros();
      case 'normativa': return vistaNormativa();
      case 'bitacora': return vistaBitacora();
      case 'config': return vistaConfig();
      default: return vistaPanel();
    }
  }

  async function iniciar() {
    try {
      R = await Repo.detectar();
      await R.iniciar();
      window.addEventListener('sesion-expirada', () => { if (S.usuario) { S.usuario = null; pantallaLogin('Su sesión expiró. Ingrese nuevamente.'); } });
      S.usuario = await R.sesionActual();
      if (S.usuario && !S.usuario.debeCambiar) await recargar();
      window.addEventListener('hashchange', enrutar);
      // navegación por filas de tabla (sin manejadores en línea, compatible con CSP estricta)
      document.addEventListener('click', (e) => {
        const f = e.target.closest('[data-ir]');
        if (f && !e.target.closest('a, button, input, select, textarea')) location.hash = f.dataset.ir;
      });
      enrutar();
    } catch (e) {
      raiz.innerHTML = `<div class="login"><div class="tarjeta"><div class="aviso bad">No se pudo iniciar el aplicativo: ${esc(e.message)}.
        Use un navegador actualizado (Chrome, Edge o Firefox) fuera del modo incógnito.</div></div></div>`;
    }
  }
  iniciar();
})();
