/* =====================================================================
 * formatos.js — Formatos de la Directiva N° 0006-2021-EF/54.01
 *   Anexo N° 01  Informe Técnico (con Apéndice A)
 *   Anexo N° 02  Acta de Entrega – Recepción
 *   Anexo N° 03  Ficha de Asignación en Uso y Devolución
 *   Anexo N° 04  Orden de Salida, Reingreso y Desplazamiento Interno
 *   Anexo N° 05  Acta de Conciliación de Inventario
 *   Anexo N° 06  Informe Final de Inventario
 *   Anexo N° 07  Ficha de Levantamiento de Información
 *   Anexo N° 09  Comunicación de Cumplimiento de Inventario
 * Se imprimen en A4 o se guardan como PDF desde el navegador.
 * Los Anexos N° 08 (vehículos) y N° 10 (bases de subasta) no se generan.
 * ===================================================================== */
(function () {
  'use strict';
  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const soles = (n) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fecha = (iso) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
  const X = (v) => v ? '<b>X</b>' : '&nbsp;';
  const lineas = (arr) => arr.map((p) => `<p class="texto">${esc(p)}</p>`).join('');
  const caja = (html) => `<div class="caja">${html || '&nbsp;'}</div>`;

  function cabecera(cfg, anexo, titulo, numero) {
    return `
      <div class="cab"><div><b>${esc(cfg.entidad)}</b><br>${esc(cfg.establecimiento)}<br>${esc(cfg.red)}</div>
      <div style="text-align:right">${esc(anexo || '')}<br>${esc(cfg.ubigeo)}<br>Impreso: ${fecha(new Date().toISOString())}</div></div>
      <h1>${esc(titulo)}</h1>${numero ? `<div class="num">${/N[°º]/.test(numero) ? '' : 'N° '}${esc(numero)}</div>` : ''}`;
  }
  const firmas = (lista) => `<div class="firmas" style="grid-template-columns:repeat(${Math.min(lista.length, 3)},1fr)">${lista.map((f) => `<div>${esc(f[0])}<br><b>${esc(f[1] || '')}</b></div>`).join('')}</div>`;
  const pie = (cfg) => `<div class="pie">${esc(cfg.entidad)} — Generado con el aplicativo Gestión de Inventario. Formato conforme a la Directiva N° 0006-2021-EF/54.01
    (R.D. N° 0015-2021-EF/54.01). Sin firmas no surte efecto.</div>`;
  const datos = (pares) => `<table class="datos">${pares.filter((p) => p[1]).map((p) => `<tr><td>${esc(p[0])}:</td><td>${esc(p[1])}</td></tr>`).join('')}</table>`;
  const salto = '<div class="salto"></div>';

  /** Apéndice A — Ficha de descripción de los bienes muebles patrimoniales.
   *  opts.extendida añade cuenta contable, valor, causal y ubicación (ficha para alta y baja). */
  function apendiceA(filas, opts) {
    const o = opts || {};
    let total = 0;
    const cuerpo = filas.map((b, i) => {
      total += Number(b.valor || 0);
      return `<tr><td>${i + 1}</td><td>${esc(b.codigo)}</td><td>${esc(b.descripcion)}</td>${o.lote ? '<td></td>' : ''}<td>${esc(b.marca)}</td><td>${esc(b.modelo)}</td>
        <td>${esc(b.color)}</td><td>${esc(b.medidas)}</td><td>${esc(b.serie)}</td><td>${esc(b.otros || '')}</td><td>${esc(b.estado)}</td>
        ${o.extendida ? `<td>${esc(b.cuenta_contable)}</td><td style="text-align:right">${soles(b.valor)}</td><td>${esc(o.causal || '')}</td>${o.tasacion !== undefined ? `<td style="text-align:right">${o.tasacion ? soles(o.tasacion) : ''}</td>` : ''}<td>${esc(b.ubicacion)}</td>` : ''}</tr>`;
    }).join('');
    const colsExt = o.extendida ? 4 + (o.tasacion !== undefined ? 1 : 0) : 0;
    return `<h3 class="sub">${esc(o.titulo || 'APÉNDICE A — FICHA DE DESCRIPCIÓN DE LOS BIENES MUEBLES PATRIMONIALES')}</h3>
      <table><thead><tr><th rowspan="2">N° de orden</th><th rowspan="2">Código patrimonial</th><th rowspan="2">Denominación</th>${o.lote ? '<th rowspan="2">N° lote</th>' : ''}
      <th colspan="6">Detalle técnico</th><th rowspan="2">Estado de conservación</th>
      ${o.extendida ? `<th rowspan="2">Cuenta contable</th><th rowspan="2">Valor S/</th><th rowspan="2">Causal de alta/baja</th>${o.tasacion !== undefined ? '<th rowspan="2">Valor tasación S/</th>' : ''}<th rowspan="2">Ubicación física</th>` : ''}</tr>
      <tr><th>Marca</th><th>Modelo</th><th>Color</th><th>Dimensiones</th><th>Serie</th><th>Otros</th></tr></thead>
      <tbody>${cuerpo}</tbody>
      ${o.extendida ? `<tfoot><tr><td colspan="${11 + (o.lote ? 1 : 0)}" style="text-align:right"><b>Total (${filas.length} bienes)</b></td><td style="text-align:right"><b>${soles(total)}</b></td><td colspan="${colsExt - 2}"></td></tr></tfoot>` : ''}</table>
      <p class="nota">Estado: Nuevo, Bueno, Regular, Malo, RAEE, Chatarra.</p>`;
  }

  // ---------------------------------------------------------------
  // Anexo N° 01 — Informe Técnico
  // ---------------------------------------------------------------
  const BASE_POR_TIPO = {
    ALTA: 'Arts. 15, 16, 17 y 21',
    CAMBIO_ESTADO: 'Arts. 22 y 35.3.c',
    BAJA: 'Arts. 47, 48 y 49',
    AFECTACION: 'Arts. 53 a 57',
    EXTINCION_AFECTACION: 'Arts. 58 y 59',
    DISPOSICION: 'Arts. 52, 60 y 61'
  };
  function informeTecnico(m, ctx) {
    const cfg = ctx.config;
    const def = Core.TIPOS_MOVIMIENTO[m.tipo];
    const c = Core.causalDef(m.tipo, m.causal);
    const filas = m.detalle || [];
    const total = filas.reduce((s, b) => s + Number(b.valor || 0), 0);
    const asunto = `${def.nombre}${m.causal ? ' por la causal / modalidad "' + m.causal + '"' : ''} de ${filas.length} bien(es) mueble(s) patrimonial(es)`;
    const base = ['Decreto Legislativo N° 1439, Decreto Legislativo del Sistema Nacional de Abastecimiento.',
      'Decreto Supremo N° 217-2019-EF, Reglamento del Decreto Legislativo N° 1439.',
      `Directiva N° 0006-2021-EF/54.01 (R.D. N° 0015-2021-EF/54.01): ${BASE_POR_TIPO[m.tipo] || def.base}${c.ref ? '; ' + c.ref : ''}.`];
    if (m.tipo === 'BAJA' && c.estado === 'RAEE') base.push('Directiva N° 001-2020-EF/54.01 y Decreto Supremo N° 009-2019-MINAM.');
    if (m.tipo === 'DISPOSICION' && /Eliminación/.test(m.causal)) base.push('Decreto Legislativo N° 1278 (8ª Disposición Complementaria Final de la Directiva).');
    const analisis = {
      BAJA: `Los bienes descritos se encuentran incursos en la causal "${m.causal}" (${c.ref}). ${m.motivo || ''}${m.denuncia ? ` Se adjunta la denuncia N° ${m.denuncia}.` : ''}`,
      DISPOSICION: `Los bienes descritos fueron dados de baja y se encuentran en custodia de Control Patrimonial (art. 50.2). Se propone su ${String(m.causal).toLowerCase()} a favor de ${m.destino_externo}${m.valor_tasacion ? `, con un valor de tasación de ${soles(m.valor_tasacion)}` : ''}. ${m.motivo || ''}`,
      ALTA: `Se acredita la causal "${m.causal}" (${c.ref}) mediante ${m.documento}. ${m.motivo || ''}`,
      AFECTACION: `${m.destino_externo} solicita la afectación en uso de los bienes descritos para la finalidad pública: ${m.motivo}. El plazo vence el ${fecha(m.fecha_retorno)} (máximo 1 año, art. 56.1). La afectataria asume la conservación y el aseguramiento (art. 55).`,
      EXTINCION_AFECTACION: `Se configura la causal de extinción "${m.causal}" (${c.ref}). ${m.motivo || ''}`,
      CAMBIO_ESTADO: `La evaluación realizada determina que el estado de conservación de los bienes descritos es "${m.estado_destino}". ${m.motivo || ''}`
    }[m.tipo] || (m.motivo || '');
    const recomendacion = {
      BAJA: `Emitir la resolución que apruebe la baja de los bienes descritos de los registros patrimonial y contable (art. 49.1)${c.sinDisposicion ? '. Por tratarse de bienes faltantes, no se requiere acto de disposición (art. 60.3) y corresponde comunicar el hecho al órgano del Sistema Nacional de Control (art. 46)' : ', y ejecutar el acto de disposición dentro de los 5 meses siguientes (art. 50.1)'}.`,
      DISPOSICION: `Emitir la resolución que apruebe la ${String(m.causal).toLowerCase()} de los bienes descritos (art. 52.2) y formalizar la entrega mediante Acta de Entrega – Recepción (Anexo N° 02).`,
      ALTA: c.resolucion ? 'Emitir la resolución que apruebe el alta y disponer la suscripción del Acta de Entrega – Recepción (Anexo N° 02).' : 'Proceder al alta y registro de los bienes en el Módulo de Patrimonio del SIGA MEF (art. 17.1) y a su asignación en uso dentro de 20 días hábiles (art. 26.2).',
      AFECTACION: 'Emitir la resolución (o refrendar el presente informe, art. 57.2.b) que apruebe la afectación en uso con el plazo y la finalidad indicados, y suscribir el Acta de Entrega – Recepción (Anexo N° 02).',
      EXTINCION_AFECTACION: 'Emitir la resolución que apruebe la extinción de la afectación en uso y requerir la devolución del bien (art. 59.2).',
      CAMBIO_ESTADO: 'Actualizar el estado de conservación en el registro patrimonial (art. 22.2) y, de corresponder, iniciar el procedimiento de baja.'
    }[m.tipo] || '';
    const adjuntos = [m.documento, m.denuncia && 'Denuncia N° ' + m.denuncia, 'Apéndice A — Ficha de descripción de los bienes', 'Panel fotográfico (recomendado)'].filter(Boolean);
    return cabecera(cfg, 'ANEXO N° 01', 'INFORME TÉCNICO', m.informe_tecnico || '(número por asignar)') +
      datos([['A', cfg.oga_responsable || 'Responsable de la OGA'], ['DE', cfg.responsable_patrimonio || 'Responsable de la OCP'], ['ASUNTO', asunto], ['FECHA', fecha(m.fecha)]]) +
      '<h3 class="sub">I. BASE LEGAL</h3>' + caja(base.map((x) => '• ' + esc(x)).join('<br>')) +
      '<h3 class="sub">II. ANTECEDENTES</h3>' + caja(esc(m.documento || m.motivo || '')) +
      '<h3 class="sub">III. DESCRIPCIÓN DE LOS BIENES MUEBLES PATRIMONIALES</h3>' + caja(`${filas.length} bien(es), con un valor registrado total de ${soles(total)}. Detalle en el Apéndice A.`) +
      '<h3 class="sub">IV. ANÁLISIS Y EVALUACIÓN</h3>' + caja(esc(analisis)) +
      '<h3 class="sub">V. OBSERVACIONES Y COMENTARIOS</h3>' + caja(esc(m.observaciones || '')) +
      '<h3 class="sub">VI. CONCLUSIONES</h3>' + caja(esc(`Procede ${def.nombre.toLowerCase()} de los bienes descritos${m.causal ? ' por "' + m.causal + '"' : ''}, conforme a la Directiva N° 0006-2021-EF/54.01.`)) +
      '<h3 class="sub">VII. RECOMENDACIONES</h3>' + caja(esc(recomendacion)) +
      '<h3 class="sub">VIII. DOCUMENTACIÓN QUE SE ADJUNTA</h3><table>' + adjuntos.map((a, i) => `<tr><td style="width:24px">${i + 1}</td><td>${esc(a)}</td></tr>`).join('') + '</table>' +
      firmas([['Responsable de la OCP', cfg.responsable_patrimonio]]) + salto +
      apendiceA(filas, { extendida: true, causal: m.causal, tasacion: m.tipo === 'DISPOSICION' ? m.valor_tasacion : undefined }) + pie(cfg);
  }

  // ---------------------------------------------------------------
  // Anexo N° 02 — Acta de Entrega – Recepción
  // ---------------------------------------------------------------
  function actaEntregaRecepcion(m, ctx) {
    const cfg = ctx.config;
    const entregaOCP = !['ALTA', 'EXTINCION_AFECTACION'].includes(m.tipo); // la OCP entrega o recibe
    const motivo = {
      ALTA: `alta por ${m.causal}`, DISPOSICION: `${m.causal} aprobada por ${m.resolucion}`,
      AFECTACION: `afectación en uso aprobada por ${m.resolucion || m.informe_tecnico}, con vencimiento el ${fecha(m.fecha_retorno)}`,
      EXTINCION_AFECTACION: `extinción de la afectación en uso por ${m.causal} (${m.resolucion})`,
      TRANSFERENCIA_GR: `transferencia a título gratuito de los bienes adquiridos o recibidos en donación por el ${cfg.entidad}, para su incorporación al patrimonio de bienes del Estado y a las cuentas contables correspondientes (arts. 63.d y 68.d del D.S. N° 017-2008-SA), según ${m.documento}`
    }[m.tipo] || m.motivo;
    const favor = entregaOCP ? (m.destino_externo || m.contraparte) : cfg.entidad;
    const hora = new Date(m.registrado || Date.now()).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    return cabecera(cfg, 'ANEXO N° 02', 'ACTA DE ENTREGA – RECEPCIÓN', m.numero) +
      `<p class="texto">Siendo las ${esc(hora)} del ${fecha(m.fecha)}, en las instalaciones de ${esc(cfg.establecimiento)}, ubicada en ${esc(cfg.direccion || '—')},
      del ${esc(cfg.ubigeo)}, se reúnen:</p>
      <table style="width:80%;margin:0 auto"><tr><th>Por parte de la OCP:</th><th>Por parte de:</th></tr>
      <tr><td>${esc(cfg.responsable_patrimonio)}</td><td>${esc(m.contraparte)}</td></tr>
      <tr><td>${esc(cfg.responsable_patrimonio_dni || 'DNI: ')}</td><td>${esc(m.contraparte_doc)}</td></tr>
      <tr><td>Responsable de Control Patrimonial — ${esc(cfg.establecimiento)}</td><td>${esc(m.contraparte_cargo)}${m.destino_externo ? ' — ' + esc(m.destino_externo) : ''}</td></tr></table>
      <p class="texto">La reunión tuvo como finalidad proceder a la entrega y recepción de los bienes descritos en el Apéndice A "Ficha de descripción de los bienes
      muebles patrimoniales", a favor de ${esc(favor)}. La entrega de los bienes muebles se efectúa en razón de ${esc(motivo)}.
      Estando de acuerdo las partes, previa verificación de la existencia y el estado de los bienes entregados, firman la presente en señal de conformidad.</p>` +
      firmas(m.tipo === 'TRANSFERENCIA_GR' ? [['Por la entrega — Gerente del CLAS', cfg.jefe], ['Por la entrega — Control Patrimonial', cfg.responsable_patrimonio], ['Por la recepción', m.contraparte]]
        : entregaOCP ? [['Por la entrega', cfg.responsable_patrimonio], ['Por la recepción', m.contraparte]] : [['Por la entrega', m.contraparte], ['Por la recepción', cfg.responsable_patrimonio]]) +
      salto + apendiceA(m.detalle, { lote: /Subasta/.test(m.causal || '') }) + pie(cfg);
  }

  // ---------------------------------------------------------------
  // Anexo N° 03 — Ficha de Asignación en Uso y Devolución
  // ---------------------------------------------------------------
  function fichaAsignacion(tipo, persona, filas, ctx, extra) {
    const cfg = ctx.config;
    const p = persona || {};
    const e = extra || {};
    const teletrabajo = /Teletrabajo/.test(e.modalidad || '');
    const cuerpo = filas.map((b, i) => `<tr><td>${i + 1}</td><td>${esc(b.codigo)}</td><td>${esc(b.descripcion)}</td><td>${esc(b.marca)}</td><td>${esc(b.modelo)}</td>
      <td>${esc(b.color)}</td><td>${esc(b.serie)}</td><td>${esc(b.otros || '')}</td><td>${esc(b.estado)}</td><td>${esc(b.obs || '')}</td></tr>`).join('');
    return cabecera(cfg, 'ANEXO N° 03', 'FICHA DE ASIGNACIÓN EN USO Y DEVOLUCIÓN DE BIENES MUEBLES PATRIMONIALES', e.numero) +
      `<table class="datos"><tr><td>Entidad u Organización de la Entidad:</td><td>${esc(cfg.entidad)} — ${esc(cfg.establecimiento)}</td></tr>
       <tr><td>Fecha:</td><td>${fecha(e.fecha)}</td></tr>
       <tr><td>Tipo:</td><td>[${X(tipo === 'ASIGNACION')}] Asignación en uso &nbsp; [${X(tipo === 'DEVOLUCION')}] Devolución &nbsp; — Modalidad: ${esc(e.modalidad || 'Sede institucional')}</td></tr></table>
      <table style="width:70%;margin:6px 0"><tr><th colspan="4">DATOS DEL USUARIO</th></tr>
       <tr><td>Nombres y apellidos</td><td>${esc(p.nombres)}</td><td>N° DNI</td><td>${esc(p.dni)}</td></tr>
       <tr><td>Correo electrónico</td><td colspan="3">${esc(p.correo)}</td></tr>
       <tr><td>Órgano o unidad orgánica</td><td colspan="3">${esc(p.unidad || p.cargo)}</td></tr>
       <tr><td>Local o sede</td><td colspan="3">${esc(p.local || cfg.establecimiento)}</td></tr>
       <tr><td>Dirección (teletrabajo)</td><td colspan="3">${teletrabajo ? esc(p.direccion) : ''}</td></tr></table>
      <table><thead><tr><th rowspan="2">N° de orden</th><th rowspan="2">Código patrimonial</th><th rowspan="2">Denominación</th><th colspan="5">Descripción</th>
      <th rowspan="2">Estado de conservación</th><th rowspan="2">Observaciones</th></tr>
      <tr><th>Marca</th><th>Modelo</th><th>Color</th><th>Serie</th><th>Otros</th></tr></thead><tbody>${cuerpo}</tbody></table>
      <p class="nota">Estado: nuevo, bueno, regular o malo. La dirección se consigna solo para la entrega o devolución por teletrabajo.</p>
      <p class="texto"><b>CONSIDERACIONES:</b><br>➢ El usuario es responsable de la permanencia y conservación de cada uno de los bienes descritos; se recomienda tomar las
      precauciones del caso para evitar sustracciones, deterioros, etc. (art. 30).<br>➢ Cualquier necesidad de traslado del bien mueble patrimonial dentro o fuera del local de la
      Entidad u Organización de la Entidad es previamente comunicada al encargado de la OCP (art. 30.c).<br>➢ En caso de sustracción o daño, el usuario formula la denuncia
      policial o fiscal y comunica a la OCP en un plazo máximo de 24 horas de conocido el hecho (arts. 30.d y 89.4).</p>` +
      firmas([['Usuario', p.nombres], ['Personal de la OCP', cfg.responsable_patrimonio]]) + pie(cfg);
  }

  // ---------------------------------------------------------------
  // Anexo N° 04 — Orden de Salida, Reingreso y Desplazamiento Interno
  // ---------------------------------------------------------------
  function ordenSalida(m, ctx) {
    const cfg = ctx.config;
    const motivo = m.tipo === 'REINGRESO' ? (ctx.salidaOrigen || {}).causal : m.causal;
    const destino = m.tipo === 'DESPLAZAMIENTO' ? m.ubicacion_destino : m.tipo === 'REINGRESO' ? cfg.establecimiento : m.destino_externo;
    const resp = m.responsable_traslado || ctx.nombrePersona(m.responsable_destino);
    const cuerpo = m.detalle.map((d, i) => `<tr><td>${i + 1}</td><td>${esc(d.codigo)}</td><td>${esc(d.descripcion)}</td><td>${esc(d.marca)}</td><td>${esc(d.modelo)}</td>
      <td>${esc(d.color)}</td><td>${esc(d.serie)}</td><td></td><td>${esc((d.despues && d.despues.estado) || d.estado)}</td>
      <td>${m.tipo === 'DESPLAZAMIENTO' && d.antes ? 'De: ' + esc(d.antes.ubicacion) : ''}</td></tr>`).join('');
    return cabecera(cfg, 'ANEXO N° 04', 'ORDEN DE SALIDA, REINGRESO Y DESPLAZAMIENTO INTERNO DE BIENES MUEBLES PATRIMONIALES', m.numero) +
      `<table class="datos"><tr><td>Entidad u Organización de la Entidad:</td><td>${esc(cfg.entidad)} — ${esc(cfg.establecimiento)}</td></tr><tr><td>Fecha:</td><td>${fecha(m.fecha)}</td></tr></table>
      <table style="margin:4px 0"><tr><th>TIPO:</th><td>[${X(m.tipo === 'SALIDA')}] Salida</td><td>[${X(m.tipo === 'REINGRESO')}] Reingreso</td><td>[${X(m.tipo === 'DESPLAZAMIENTO')}] Desplazamiento interno</td></tr>
      <tr><th>MOTIVO:</th><td>[${X(motivo === 'Mantenimiento')}] Mantenimiento${m.tipo_mantenimiento ? ' (' + esc(m.tipo_mantenimiento) + ')' : ''}</td><td>[${X(motivo === 'Comisión de servicios')}] Comisión de servicios</td>
      <td>[${X(motivo === 'Capacitación y/o evento')}] Capacitación y/o evento</td></tr></table>
      <p class="texto">Documento que autoriza el traslado: <b>${esc(m.documento || '')}</b>${m.tipo === 'SALIDA' ? ` — Retorno previsto: <b>${fecha(m.fecha_retorno)}</b>` : ''}</p>
      <table style="margin:4px 0"><tr><th colspan="2">DATOS DEL RESPONSABLE</th><th colspan="2">DESTINO</th></tr>
      <tr><td>Nombres y apellidos</td><td>${esc(resp)}</td><td>Representante proveedor / usuario</td><td>${esc(m.contraparte || (m.tipo === 'DESPLAZAMIENTO' ? ctx.nombrePersona(m.responsable_destino) : ''))}</td></tr>
      <tr><td>N° DNI</td><td>${esc(m.responsable_traslado_dni || '')}</td><td>Dirección</td><td>${esc(m.tipo === 'SALIDA' ? m.destino_externo : cfg.direccion || '')}</td></tr>
      <tr><td>Órgano o unidad orgánica</td><td></td><td>Proveedor / órgano o unidad orgánica</td><td>${esc(destino)}</td></tr>
      <tr><td>Local o sede</td><td>${esc(cfg.establecimiento)}</td><td>Local o sede</td><td>${esc(m.tipo === 'SALIDA' ? '' : cfg.establecimiento)}</td></tr></table>
      <table><thead><tr><th rowspan="2">N° de orden</th><th rowspan="2">Código patrimonial</th><th rowspan="2">Denominación</th><th colspan="5">Descripción</th>
      <th rowspan="2">Estado de conservación</th><th rowspan="2">Observación</th></tr><tr><th>Marca</th><th>Modelo</th><th>Color</th><th>Serie</th><th>Otros</th></tr></thead>
      <tbody>${cuerpo}</tbody></table><p class="nota">Estado: bueno, regular o malo.</p>` +
      firmas([['Responsable del traslado', resp], ['V°B° Oficina de Control Patrimonial', cfg.responsable_patrimonio], ['V°B° de Seguridad', '']]) + pie(cfg);
  }

  // ---------------------------------------------------------------
  // Formatos de actos sin anexo propio
  // ---------------------------------------------------------------
  function constancia(m, ctx, titulo, texto, firmasDoc) {
    const cfg = ctx.config;
    return cabecera(cfg, Core.TIPOS_MOVIMIENTO[m.tipo].base, titulo, m.numero) +
      datos([['Fecha', fecha(m.fecha)], ['Causal', m.causal], ['Documento', m.documento], ['Informe técnico', m.informe_tecnico], ['Resolución', m.resolucion],
        ['Tipo de mantenimiento', m.tipo_mantenimiento], ['Ejecutado por', m.tipo === 'MANTENIMIENTO' ? m.destino_externo : ''], ['Costo', m.costo ? soles(m.costo) : ''],
        ['Nuevo estado', m.estado_destino], ['Motivo / sustento', m.motivo], ['Observaciones', m.observaciones]]) +
      `<p class="texto">${esc(texto)}</p>` + apendiceA(m.detalle.map((d) => Object.assign({}, d, { estado: (d.despues && d.despues.estado) || d.estado })), { titulo: 'RELACIÓN DE BIENES' }) +
      firmas(firmasDoc) + pie(cfg);
  }

  /** Formato principal de un movimiento según su tipo */
  function movimiento(m, ctx) {
    const cfg = ctx.config;
    const c = Core.causalDef(m.tipo, m.causal);
    let html;
    switch (m.tipo) {
      case 'ASIGNACION':
        html = fichaAsignacion('ASIGNACION', ctx.persona(m.responsable_destino), m.detalle, ctx, m);
        break;
      case 'DEVOLUCION': { // una ficha por usuario que devuelve
        const grupos = {};
        m.detalle.forEach((d) => { const k = (d.antes && d.antes.responsable) || ''; (grupos[k] = grupos[k] || []).push(Object.assign({}, d, { estado: d.despues.estado })); });
        html = Object.entries(grupos).map(([k, filas]) => fichaAsignacion('DEVOLUCION', ctx.persona(k), filas, ctx, m)).join(salto);
        break;
      }
      case 'SALIDA': case 'REINGRESO': case 'DESPLAZAMIENTO':
        html = ordenSalida(m, ctx);
        break;
      case 'ALTA':
        html = c.acta ? actaEntregaRecepcion(m, ctx)
          : cabecera(cfg, 'Arts. 15–17 y 21', 'REGISTRO DE ALTA DE BIENES MUEBLES PATRIMONIALES', m.numero) +
            datos([['Fecha', fecha(m.fecha)], ['Causal', `${m.causal} (${c.ref || ''})`], ['Documento que acredita la causal', m.documento], ['Informe técnico', m.informe_tecnico], ['Resolución', m.resolucion]]) +
            apendiceA(m.detalle, { extendida: true, causal: m.causal }) +
            firmas([['Almacén (entrega con PECOSA)', ''], ['Control Patrimonial', cfg.responsable_patrimonio], ['Contabilidad', cfg.responsable_contabilidad]]) + pie(cfg);
        break;
      case 'AFECTACION': case 'EXTINCION_AFECTACION': case 'DISPOSICION':
        html = actaEntregaRecepcion(m, ctx);
        break;
      case 'TRANSFERENCIA_GR':
        html = actaEntregaRecepcion(m, ctx) + salto + apendiceA(m.detalle, { extendida: true, causal: 'Transferencia (art. 16.1.e)', titulo: 'RELACIÓN VALORIZADA DE LOS BIENES TRANSFERIDOS (para el alta en el registro de la entidad receptora)' });
        break;
      case 'BAJA':
        html = cabecera(cfg, 'Arts. 47–49', 'RELACIÓN DE BIENES MUEBLES PATRIMONIALES DADOS DE BAJA', m.numero) +
          datos([['Causal', `${m.causal} (${c.ref})`], ['Informe técnico', m.informe_tecnico], ['Resolución que aprueba la baja', m.resolucion], ['Denuncia', m.denuncia], ['Fecha', fecha(m.fecha)]]) +
          apendiceA(m.detalle, { extendida: true, causal: m.causal }) +
          `<p class="texto">${c.sinDisposicion ? 'Baja por saneamiento de faltantes: no requiere acto de disposición (art. 60.3). Comunicar al órgano del Sistema Nacional de Control (art. 46).'
            : 'Los bienes quedan en custodia de Control Patrimonial hasta la ejecución del acto de disposición, en un plazo que no exceda los cinco (5) meses de emitida la resolución de baja (art. 50).'}</p>` +
          firmas([['Control Patrimonial', cfg.responsable_patrimonio], ['Contabilidad', cfg.responsable_contabilidad], ['OGA', cfg.oga_responsable]]) + pie(cfg);
        break;
      case 'CAMBIO_ESTADO':
        html = constancia(m, ctx, 'ACTA DE CONSTATACIÓN DEL ESTADO DE CONSERVACIÓN', 'Se constata el estado de conservación de los bienes detallados y se actualiza el registro patrimonial (art. 22.2).',
          [['Usuario / jefe de la unidad', ''], ['Control Patrimonial', cfg.responsable_patrimonio], ['Área técnica evaluadora', '']]);
        break;
      case 'MANTENIMIENTO':
        html = constancia(m, ctx, 'CONSTANCIA DE MANTENIMIENTO DE BIENES MUEBLES PATRIMONIALES', 'Se deja constancia del mantenimiento ejecutado (arts. 83–88).',
          [['Ejecutor del mantenimiento', m.destino_externo], ['Usuario / jefe de la unidad', ''], ['Control Patrimonial', cfg.responsable_patrimonio]]);
        break;
      case 'INVENTARIO': {
        const nom = ctx.nombrePersona;
        const filas = m.detalle.map((d) => Object.assign({}, d, { estado: d.despues.estado, otros: Object.keys(d.despues).filter((k) => d.antes[k] !== d.despues[k])
          .map((k) => `${k}: ${k === 'responsable' ? nom(d.antes[k]) || '—' : d.antes[k] || '—'} → ${k === 'responsable' ? nom(d.despues[k]) || '—' : d.despues[k]}`).join('; ') }));
        html = cabecera(cfg, 'Art. 35.6.a', 'ACTUALIZACIÓN DEL REGISTRO POR RESULTADOS DEL INVENTARIO', m.numero) + datos([['Fecha', fecha(m.fecha)], ['Sustento', m.motivo], ['Resolución de la comisión', m.documento]]) +
          apendiceA(filas, { titulo: 'BIENES REGULARIZADOS (la columna "Otros" detalla el cambio)' }) +
          firmas([['Presidente(a) de la Comisión de Inventario', cfg.oga_responsable], ['Miembro', ''], ['Control Patrimonial', cfg.responsable_patrimonio]]) + pie(cfg);
        break;
      }
      default: html = '';
    }
    if (m.anulado) html += `<p style="color:#a00;font-weight:bold;text-align:center">REGISTRO ANULADO el ${fecha(m.anulado.fecha)} — ${esc(m.anulado.motivo)} (${esc(m.anulado.documento || '')})</p>`;
    return html;
  }

  /** Relación consolidada de bienes del usuario, en formato Anexo N° 03 */
  function relacionResponsable(persona, bienes, ctx) {
    return fichaAsignacion('ASIGNACION', persona, bienes, ctx, { fecha: Core.hoyISO(), modalidad: 'Sede institucional (art. 28)' });
  }

  function fichaBien(b, movs, ctx) {
    const cfg = ctx.config;
    const hist = movs.map((m) => `<tr><td>${fecha(m.fecha)}</td><td>${esc(m.numero)}</td><td>${esc(Core.TIPOS_MOVIMIENTO[m.tipo].nombre)}</td>
      <td>${esc(m.causal || m.motivo || '')}</td><td>${esc([m.resolucion, m.informe_tecnico, m.documento].filter(Boolean).join(' / '))}</td><td>${m.anulado ? 'ANULADO' : ''}</td></tr>`).join('');
    return cabecera(cfg, 'Art. 22', 'FICHA DE REGISTRO DEL BIEN MUEBLE PATRIMONIAL', b.codigo) +
      datos([['Denominación', b.descripcion], ['Código interno', b.codigo_interno], ['Marca / Modelo', `${b.marca} / ${b.modelo}`],
        ['Serie', b.serie], ['Dimensiones', b.medidas], ['Color', b.color], ['Estado de conservación', b.estado],
        ['Situación', Core.SITUACIONES[b.situacion]], ['Ubicación física', b.ubicacion], ['Usuario responsable', ctx.nombrePersona(b.responsable)],
        ['Titularidad / origen', Core.ORIGENES[b.origen]], ['Orden de compra', b.nro_orden], ['Fecha de adquisición', fecha(b.fecha_adquisicion)],
        ['Valor', soles(b.valor)], ['Clasificación (art. 5.c, referencial)', Core.clasificacionContable(b.valor, cfg.uit)],
        ['Cuenta contable', b.cuenta_contable], ['Póliza de seguro', b.poliza ? `${b.poliza} (vence ${fecha(b.poliza_vence)})` : ''],
        ['Último mantenimiento', fecha(b.ultimo_mantenimiento)], ['Baja', b.fecha_baja ? `${fecha(b.fecha_baja)} — ${b.causal_baja} — ${b.resolucion_baja}` : ''],
        ['Afectada a', b.afectataria ? `${b.afectataria} hasta ${fecha(b.afectacion_vence)}` : ''], ['Observaciones', b.observaciones]]) +
      `<h3 class="sub">Historial de actos (kardex)</h3><table><thead><tr><th>Fecha</th><th>N°</th><th>Acto</th><th>Causal / motivo</th>
      <th>Sustento</th><th></th></tr></thead><tbody>${hist || '<tr><td colspan="6">Sin actos registrados desde la carga inicial.</td></tr>'}</tbody></table>` + pie(cfg);
  }

  // ---------------------------------------------------------------
  // Inventario: Anexos N° 07, 05, 06 y 09
  // ---------------------------------------------------------------
  /** Anexo N° 07 — Ficha de levantamiento de información (por ubicación o por usuario) */
  function fichaLevantamiento(inv, grupo, bienes, ctx) {
    const cfg = ctx.config;
    const v = inv.verif || {};
    const tipos = new Set(bienes.map((b) => (v[b.codigo] || {}).tipo || inv.tipo_verificacion || 'F'));
    const cuerpo = bienes.map((b, i) => {
      const x = v[b.codigo] || {};
      const obs = x.encontrado === false ? 'NO UBICADO' : [x.ubicacion && x.ubicacion !== b.ubicacion ? 'Ubicado en: ' + x.ubicacion : '', x.obs || ''].filter(Boolean).join(' · ');
      return `<tr><td>${i + 1}</td><td>${esc(b.codigo)}</td><td>${esc(b.descripcion)}</td><td>${esc(b.marca)}</td><td>${esc(b.modelo)}</td><td></td>
        <td>${esc(b.color)}</td><td>${esc(b.serie)}</td><td>${esc(b.medidas)}</td><td></td><td>${x.encontrado ? esc(x.uso || 'U') : ''}</td>
        <td>${esc(x.encontrado ? x.estado : '')}</td><td>${esc(obs)}</td></tr>`;
    }).join('');
    return cabecera(cfg, 'ANEXO N° 07', `FICHA DE LEVANTAMIENTO DE INFORMACIÓN — INVENTARIO PATRIMONIAL ${inv.anio}`, inv.id) +
      `<table class="datos"><tr><td>Entidad u Organización de la Entidad:</td><td>${esc(cfg.entidad)}</td><td>Fecha:</td><td>${fecha(Core.hoyISO())}</td></tr>
      <tr><td>Usuario:</td><td>${esc(grupo.usuario || '')}</td><td>Personal inventariador:</td><td>${esc(inv.equipo || '')}</td></tr>
      <tr><td>Órgano o unidad orgánica:</td><td>${esc(grupo.unidad || '')}</td><td>Equipo de trabajo:</td><td>${esc(inv.id)}</td></tr>
      <tr><td>Ubicación física de los bienes:</td><td>${esc(grupo.ubicacion || '')}</td><td>Tipo de verificación:</td><td>Física [${X(tipos.has('F'))}] Digital [${X(tipos.has('D'))}]</td></tr></table>
      <table><thead><tr><th rowspan="2">N° de orden</th><th rowspan="2">Código patrimonial</th><th rowspan="2">Denominación</th><th colspan="9">Descripción</th><th rowspan="2">Observación</th></tr>
      <tr><th>Marca</th><th>Modelo</th><th>Tipo</th><th>Color</th><th>Serie</th><th>Dimensiones</th><th>Otros</th><th>Situación (1)</th><th>Estado (2)</th></tr></thead>
      <tbody>${cuerpo}</tbody></table>
      <p class="nota">(1) Uso (U), Desuso (D). (2) Bueno, Regular, Malo, Chatarra y RAEE.</p>
      <p class="texto"><b>CONSIDERACIONES:</b><br>➢ El usuario declara haber mostrado todos los bienes muebles que se encuentran bajo su responsabilidad y no contar con más bienes muebles materia de inventario.
      <br>➢ El usuario es responsable de la permanencia y conservación de cada uno de los bienes descritos.<br>➢ Cualquier necesidad de traslado del bien mueble patrimonial es previamente comunicada al encargado de la OCP.</p>` +
      firmas([['Usuario', grupo.usuario], ['Personal inventariador', inv.equipo]]) + pie(cfg);
  }

  /** Anexo N° 05 — Acta de Conciliación de Inventario */
  function actaConciliacion(inv, filas, ctx) {
    const cfg = ctx.config;
    const s = (k) => filas.reduce((t, f) => t + Number(f[k] || 0), 0);
    const cuerpo = filas.map((f) => `<tr><td>${esc(f.cuenta)}</td><td style="text-align:right">${soles(f.patrimonial)}</td>
      <td style="text-align:right">${f.contable === '' || f.contable === undefined ? '' : soles(f.contable)}</td><td style="text-align:right">${soles(f.inventario)}</td>
      <td style="text-align:right">${f.contable === '' || f.contable === undefined ? '' : soles(Number(f.contable) - f.inventario)}</td></tr>`).join('');
    const c = inv.comision || {};
    return cabecera(cfg, 'ANEXO N° 05', 'ACTA DE CONCILIACIÓN DE INVENTARIO', inv.id) +
      `<p class="texto">En las instalaciones de ${esc(cfg.establecimiento)}, ubicada en ${esc(cfg.direccion || '—')}, del ${esc(cfg.ubigeo)}, siendo las ____ horas del
      ____/____/______, se reunieron los integrantes de la Comisión de Inventario ${inv.anio}, designada mediante ${esc(inv.resolucion || '—')}, conjuntamente con los responsables
      de la Oficina de Contabilidad y de la Oficina de Control Patrimonial: ${esc([c.presidente, c.contabilidad, c.abastecimiento, cfg.responsable_contabilidad, cfg.responsable_patrimonio].filter(Boolean).join('; '))}.</p>
      <p class="texto">Debidamente instaladas ambas partes, se procede a conciliar los saldos al cierre del ejercicio presupuestal del ${inv.anio}, conforme se detalla a continuación:</p>
      <table><thead><tr><th rowspan="2">Cuentas</th><th>Registro patrimonial (a)</th><th>Registro contable (b)</th><th>Resultado del inventario (c)</th><th rowspan="2">Diferencia registro contable / resultado del inventario (b−c)</th></tr>
      <tr><th>Valor OCP al 31-12-${inv.anio}</th><th>Valor neto contable al 31-12-${inv.anio}</th><th>Valor OCP al 31-12-${inv.anio}</th></tr></thead>
      <tbody>${cuerpo}</tbody><tfoot><tr><td><b>TOTAL</b></td><td style="text-align:right"><b>${soles(s('patrimonial'))}</b></td><td></td><td style="text-align:right"><b>${soles(s('inventario'))}</b></td><td></td></tr></tfoot></table>
      <p class="nota">(a) y (c) se calculan con el valor registrado de los bienes en el aplicativo; el valor neto (con depreciación) lo informa Contabilidad. Los bienes sin cuenta contable
      registrada se agrupan como "Sin cuenta contable" y deben clasificarse antes de suscribir el acta.</p>
      <p class="texto">Luego de dar lectura al acta, los participantes proceden a suscribirla en señal de conformidad.</p>` +
      firmas([['Presidente(a) de la Comisión de Inventario', c.presidente], ['Miembro de la Comisión de Inventario', c.contabilidad], ['Miembro de la Comisión de Inventario', c.abastecimiento]]) +
      firmas([['Responsable de la OCP', cfg.responsable_patrimonio], ['Responsable de la Oficina de Contabilidad', cfg.responsable_contabilidad]]) + pie(cfg);
  }

  /** Anexo N° 06 — Informe Final de Inventario */
  function informeFinal(inv, r, ctx) {
    const cfg = ctx.config;
    const t = inv.informe || {};
    const suma = (a) => soles(a.reduce((s, b) => s + Number(b.valor || 0), 0));
    const v = inv.verif || {};
    const ubicados = r.conformes.concat(r.diferencias.map((d) => d.bien));
    const enUso = ubicados.filter((b) => (v[b.codigo] || {}).uso !== 'D');
    const desuso = ubicados.filter((b) => (v[b.codigo] || {}).uso === 'D');
    const digitales = ubicados.filter((b) => (v[b.codigo] || {}).tipo === 'D');
    const fuera = r.conformes.filter((b) => ['AFECTADO', 'EN_SALIDA'].includes(b.situacion));
    const baja = r.conformes.filter((b) => b.situacion === 'BAJA').concat(r.bajasNoUbicadas || []);
    const malos = ubicados.filter((b) => ['Malo', 'RAEE', 'Chatarra'].includes(((v[b.codigo] || {}).estado) || b.estado));
    const fila = (txt, arr) => `<tr><td>${esc(txt)}</td><td style="text-align:right">${arr.length}</td><td style="text-align:right">${suma(arr)}</td></tr>`;
    const c = inv.comision || {};
    const lista = (titulo, arr) => arr.length ? `<h3 class="sub">${esc(titulo)}</h3>` + apendiceA(arr, { titulo: titulo }) : '';
    return cabecera(cfg, 'ANEXO N° 06', 'INFORME FINAL DE INVENTARIO', `${inv.id} — Año ${inv.anio}`) +
      datos([['A', cfg.oga_responsable || 'Responsable de la OGA'], ['FECHA', fecha(inv.cerrado || Core.hoyISO())], ['Comisión designada por', inv.resolucion]]) +
      '<h3 class="sub">I. ANTECEDENTES</h3>' + caja(esc(t.antecedentes || '')) +
      '<h3 class="sub">II. SUSTENTO DE LA VERIFICACIÓN DIGITAL (de corresponder)</h3>' + caja(esc(t.sustento_digital || (digitales.length ? `${digitales.length} bienes verificados digitalmente.` : 'No se efectuó verificación digital.'))) +
      '<h3 class="sub">III. ACTIVIDADES DESARROLLADAS</h3>' + caja(esc(t.actividades || `Planificación (plan presentado el ${fecha(inv.plan_fecha) || '—'}), trabajo de campo por ubicación con fichas de levantamiento (Anexo N° 07), trabajo de gabinete: actualización del registro y conciliación patrimonio-contable (Anexo N° 05).`)) +
      `<h3 class="sub">IV. ANÁLISIS DE LOS RESULTADOS</h3><table><thead><tr><th>Resultado</th><th>Cantidad</th><th>Valor</th></tr></thead><tbody>
        ${fila('Bienes muebles patrimoniales ubicados', ubicados)}${fila(' — de ellos, verificados digitalmente', digitales)}
        ${fila('Bienes en uso', enUso)}${fila('Bienes que no se encuentran en uso (desuso)', desuso)}
        ${fila('Bienes afectados en uso o en salida temporal (indicando afectataria o destino)', fuera)}
        ${fila('Bienes con diferencias de estado, ubicación o usuario (actualizados)', r.diferencias.map((d) => d.bien))}
        ${fila('Bienes faltantes', r.faltantes)}
        <tr><td>Bienes sobrantes</td><td style="text-align:right">${(inv.sobrantes || []).length}</td><td></td></tr>
        ${fila('Bienes dados de baja pendientes de disposición (verificados, art. 31.2)', baja)}
        ${fila('Bienes en estado Malo, RAEE o Chatarra (recomendar baja)', malos)}
        ${fila('Bienes sin verificar', r.sinVerificar)}</tbody></table>
        <p class="texto">${esc(t.analisis || '')}</p>` +
      '<h3 class="sub">V. CONCLUSIONES</h3>' + caja(esc(t.conclusiones || '')) +
      '<h3 class="sub">VI. RECOMENDACIONES</h3>' + caja(esc(t.recomendaciones || '')) +
      firmas([['Presidente(a) de la Comisión de Inventario', c.presidente], ['Miembro de la Comisión de Inventario', c.contabilidad], ['Miembro de la Comisión de Inventario', c.abastecimiento]]) +
      salto + lista('Relación de bienes muebles patrimoniales faltantes', r.faltantes) +
      ((inv.sobrantes || []).length ? '<h3 class="sub">Relación de bienes muebles sobrantes</h3><table><thead><tr><th>N°</th><th>Denominación</th><th>Marca</th><th>Serie</th><th>Estado</th><th>Ubicación</th><th>Posesión desde</th><th>Observación</th></tr></thead><tbody>' +
        inv.sobrantes.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.descripcion)}</td><td>${esc(s.marca)}</td><td>${esc(s.serie)}</td><td>${esc(s.estado)}</td><td>${esc(s.ubicacion)}</td><td>${fecha(s.fecha_posesion)}</td><td>${esc(s.obs)}</td></tr>`).join('') + '</tbody></table>' : '') +
      lista('Relación de bienes dados de baja pendientes de disposición', baja) +
      lista('Bienes en estado Malo, RAEE o Chatarra — se recomienda su baja y disposición final', malos) +
      lista('Bienes que no se encuentran en uso', desuso) + pie(cfg);
  }

  /** Anexo N° 09 — Comunicación de cumplimiento de inventario */
  function comunicacionInventario(inv, ctx) {
    const cfg = ctx.config;
    return `<div class="doc-carta">
      <p style="text-align:right">${esc((cfg.ubigeo || '').split('—')[0])}, ${fecha(inv.presentado || Core.hoyISO())}</p>
      <p><b>OFICIO N° ${esc(inv.oficio || '______')}</b></p>
      <p>Señor(a)<br><b>${esc(cfg.oga_responsable || '[Nombre del funcionario]')}</b><br><b>${esc(cfg.oga_nombre || '[Cargo]')}</b><br><b>${esc(cfg.red)}</b></p>
      <table class="datos"><tr><td>Asunto:</td><td>Presentación del inventario de bienes muebles patrimoniales correspondiente al año ${inv.anio}</td></tr>
      <tr><td>Referencia:</td><td>Directiva N° 0006-2021-EF/54.01</td></tr></table>
      <p class="texto">Tengo el agrado de dirigirme a usted, en relación con el documento de la referencia, a fin de remitir la documentación concerniente al inventario de
      bienes muebles patrimoniales correspondiente al año ${inv.anio}, efectuado por ${esc(cfg.entidad)} — ${esc(cfg.establecimiento)}, de la provincia de Huaral y
      departamento de Lima: Informe Final de Inventario (Anexo N° 06) y Acta de Conciliación de Inventario (Anexo N° 05).</p>
      <p class="texto">Hago propicia la ocasión para expresarle los sentimientos de mi especial consideración.</p><p>Atentamente,</p>
      <div style="margin-top:60px;width:50%;border-top:1px solid #000;text-align:center;font-size:9pt">${esc(cfg.jefe)}<br>Gerente del CLAS<br>${esc(cfg.entidad)}</div>
      <p class="nota" style="margin-top:20px">Plazo (art. 36.1): las Organizaciones de la Entidad remiten el sustento de inventario a la OGA de la Entidad hasta el 15 de marzo; la Entidad lo remite a la DGA hasta el 31 de marzo del año siguiente.</p></div>`;
  }

  // ---------------------------------------------------------------
  // Informe de situación patrimonial (D.S. N° 017-2008-SA, arts. 36.n, 43.f, 49.c, 49.h y 104)
  // ---------------------------------------------------------------
  const TIPOS_INFORME = {
    MENSUAL: { titulo: 'INFORME MENSUAL DE SITUACIÓN PATRIMONIAL', a: 'Consejo Directivo', ref: 'arts. 43.f y 49.c' },
    SEMESTRAL: { titulo: 'INFORME SEMESTRAL DE SITUACIÓN PATRIMONIAL', a: 'Asamblea General', ref: 'arts. 36.n y 49.c' },
    RENDICION: { titulo: 'INFORME PATRIMONIAL PARA LA RENDICIÓN DE CUENTAS', a: 'DIRESA / comunidad', ref: 'art. 104' },
    DIAGNOSTICO: { titulo: 'DIAGNÓSTICO DE LA SITUACIÓN PATRIMONIAL — INICIO DE GESTIÓN DEL GERENTE', a: 'Consejo Directivo', ref: 'art. 49.h' }
  };
  function informeSituacion(tipo, desde, hasta, datos, ctx) {
    const cfg = ctx.config;
    const t = TIPOS_INFORME[tipo];
    const k = datos.indicadores;
    const tabla = (cab, filas) => `<table><thead><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((c, i) => `<td${i ? ' style="text-align:right"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const porTipo = {};
    datos.movs.forEach((m) => { const x = porTipo[m.tipo] = porTipo[m.tipo] || { n: 0, bienes: 0 }; x.n++; x.bienes += m.items.length; });
    const recom = datos.alertas.map((a) => `${a.texto} (${a.ref}).`);
    return cabecera(cfg, 'D.S. N° 017-2008-SA, ' + t.ref, t.titulo, '') +
      datos_([['A', `${t.a}${t.a === 'Consejo Directivo' && cfg.presidente_cd ? ' — ' + cfg.presidente_cd + ', Presidente(a)' : ''}`], ['DE', `${cfg.jefe || 'Gerente'} — Gerente del CLAS`],
        ['ASUNTO', `Situación de los bienes patrimoniales administrados por el ${cfg.entidad}`], ['PERÍODO', tipo === 'DIAGNOSTICO' ? `Situación al ${fecha(hasta)}` : `Del ${fecha(desde)} al ${fecha(hasta)}`], ['FECHA', fecha(Core.hoyISO())]]) +
      `<h3 class="sub">I. BASE LEGAL</h3>${caja('• Ley N° 29124 y su Reglamento, D.S. N° 017-2008-SA: ' + esc(t.ref) + ', 43.f, 49.e, 63.d y 68.d.<br>• Directiva N° 0006-2021-EF/54.01 (R.D. N° 0015-2021-EF/54.01).')}
      <h3 class="sub">II. BIENES ADMINISTRADOS</h3>` +
      tabla(['Concepto', 'Cantidad', 'Valor'], [
        ['Bienes en patrimonio (activos, en salida, afectados o faltantes)', k.total, soles(k.valor)],
        ['— Activo fijo (≥ 1/4 UIT, referencial)', k.activoFijo, ''], ['— Bienes no depreciables (< 1/4 UIT, referencial)', k.cuentasOrden, ''],
        ['Dados de baja, pendientes de disposición', k.pendientesDisposicion, ''], ['Faltantes', k.faltantes, ''], ['Afectados en uso a otras entidades', k.afectados, '']]) +
      '<h3 class="sub">Por estado de conservación</h3>' + tabla(['Estado', 'Bienes'], Core.ESTADOS_CONSERVACION.map((e) => [esc(e), k.porEstado[e] || 0])) +
      '<h3 class="sub">Por titularidad</h3>' + tabla(['Titularidad', 'Bienes', 'Valor'], Object.entries(datos.titularidad).map(([o, x]) => [esc((Core.ORIGENES[o] || o)), x.n, soles(x.v)])) +
      `<h3 class="sub">III. ACTOS REGISTRADOS EN EL PERÍODO</h3>` +
      (datos.movs.length ? tabla(['Acto', 'N° de actos', 'Bienes comprendidos'], Object.entries(porTipo).map(([tp, x]) => [esc(Core.TIPOS_MOVIMIENTO[tp].nombre), x.n, x.bienes]))
        + '<table style="margin-top:4px"><thead><tr><th>N°</th><th>Fecha</th><th>Acto</th><th>Causal / motivo</th><th>Sustento</th><th>Bienes</th></tr></thead><tbody>'
        + datos.movs.map((m) => `<tr><td>${esc(m.numero)}</td><td>${fecha(m.fecha)}</td><td>${esc(Core.TIPOS_MOVIMIENTO[m.tipo].nombre)}</td><td>${esc(m.causal || m.motivo || '')}</td><td>${esc(m.resolucion || m.documento || '')}</td><td style="text-align:right">${m.items.length}</td></tr>`).join('') + '</tbody></table>'
        : caja('No se registraron actos en el período.')) +
      `<h3 class="sub">IV. MANTENIMIENTO ${tipo === 'DIAGNOSTICO' ? '' : 'EN EL PERÍODO'} (art. 81.d)</h3>${caja(`${datos.mantenimientos} registro(s) de mantenimiento, con un costo de ${soles(datos.costoMantenimiento)}.`)}
      <h3 class="sub">V. BIENES ADQUIRIDOS O DONADOS PENDIENTES DE TRANSFERIR AL GOBIERNO REGIONAL (arts. 63.d y 68.d)</h3>` +
      (datos.porTransferir.length ? apendiceA(datos.porTransferir, { titulo: `${datos.porTransferir.length} bien(es)` }) : caja('No hay bienes pendientes de transferencia.')) +
      `<h3 class="sub">VI. OBSERVACIONES Y ACCIONES RECOMENDADAS</h3>${caja(recom.length ? recom.map((r, i) => `${i + 1}. ${esc(r)}`).join('<br>') : 'Sin observaciones.')}` +
      firmas([['Gerente del CLAS', cfg.jefe], ['Responsable de Control Patrimonial', cfg.responsable_patrimonio]]) + pie(cfg);
  }
  const datos_ = (pares) => datos(pares);

  // ---------------------------------------------------------------
  // Etiquetas de identificación (arts. 20.1, 20.4 y 35.3.d)
  // ---------------------------------------------------------------
  function etiquetas(bienes, cfg, anioInventario) {
    return `<div class="etiquetas">${bienes.map((b) => `<div class="etq"><div class="etq-ent">${esc(cfg.sigla || cfg.entidad)}</div>
      <div class="etq-cod">${esc(b.codigo)}</div><div class="etq-den">${esc(b.descripcion.slice(0, 48))}</div>
      ${anioInventario ? `<div class="etq-inv">INVENTARIO ${esc(anioInventario)}</div>` : ''}</div>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------
  // Informe de sustento legal del aplicativo (estructura del Anexo N° 01)
  // ---------------------------------------------------------------
  function sustentoLegal(cfg) {
    const N = Normativa;
    const t = N.informeSustento(cfg);
    return cabecera(cfg, 'Estructura del Anexo N° 01', 'INFORME', 'Sustento legal del aplicativo de Gestión de Inventario') +
      datos([['A', (cfg.presidente_cd ? cfg.presidente_cd + ', Presidente(a) del Consejo Directivo' : 'Consejo Directivo del CLAS') + (cfg.jefe ? ' / ' + cfg.jefe + ', Gerente' : '')], ['DE', cfg.responsable_patrimonio || 'Responsable de Control Patrimonial'], ['ASUNTO', t.asunto], ['FECHA', fecha(Core.hoyISO())]]) +
      '<h3 class="sub">I. BASE LEGAL</h3><table>' + N.BASE_LEGAL.map((b, i) => `<tr><td style="width:20px">${i + 1}</td><td><b>${esc(b[0])}</b><br>${esc(b[1])}</td></tr>`).join('') + '</table>' +
      '<h3 class="sub">II. ANTECEDENTES</h3>' + lineas(t.antecedentes) +
      '<h3 class="sub">III. ANÁLISIS</h3>' + lineas(t.analisis) +
      '<h3 class="sub">III-A. REGLAMENTO DE LA LEY N° 29124 (D.S. N° 017-2008-SA): DISPOSICIONES SOBRE BIENES</h3><table><thead><tr><th>Artículo</th><th>Contenido</th><th>Aplicación en el aplicativo</th></tr></thead><tbody>' +
      N.REGLAMENTO_CLAS.map((r) => `<tr><td style="width:12%"><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('') + '</tbody></table>' +
      '<h3 class="sub">IV. PUNTOS DE INTERPRETACIÓN POR DEFINIR</h3><table>' + N.AMBIGUEDADES.map((a) => `<tr><td style="width:28%"><b>${esc(a[0])}</b></td><td>${esc(a[1])}</td></tr>`).join('') + '</table>' +
      '<h3 class="sub">V. CONCLUSIONES</h3>' + lineas(t.conclusiones.map((x, i) => `${i + 1}. ${x}`)) +
      '<h3 class="sub">VI. RECOMENDACIONES</h3>' + lineas(t.recomendaciones.map((x, i) => `${i + 1}. ${x}`)) +
      firmas([['Responsable de Control Patrimonial', cfg.responsable_patrimonio]]) + salto +
      '<h3 class="sub">ANEXO: MATRIZ DE CORRESPONDENCIA APLICATIVO — DIRECTIVA N° 0006-2021-EF/54.01 Y D.S. N° 017-2008-SA</h3><table><thead><tr><th>Módulo</th><th>Artículos</th><th>Formato</th><th>Control que aplica el aplicativo</th></tr></thead><tbody>' +
      N.MATRIZ.map((m) => `<tr><td><b>${esc(m[0])}</b></td><td>${esc(m[1])}</td><td>${esc(m[2])}</td><td>${esc(m[3])}</td></tr>`).join('') + '</tbody></table>' + pie(cfg);
  }

  /** Imprime en A4. horizontal: tablas anchas (Apéndice A extendido, Anexos 03, 04 y 07). */
  function imprimir(html, horizontal) {
    const area = document.getElementById('impresion');
    area.innerHTML = `<style>@page { size: A4 ${horizontal ? 'landscape' : 'portrait'}; margin: 12mm 10mm; }</style><div class="doc">${html}</div>`;
    window.print();
  }

  window.Formatos = {
    movimiento, informeTecnico, actaEntregaRecepcion, fichaAsignacion, ordenSalida, relacionResponsable, fichaBien,
    fichaLevantamiento, actaConciliacion, informeFinal, comunicacionInventario, informeSituacion, TIPOS_INFORME, etiquetas, sustentoLegal, imprimir, esc, soles, fecha
  };
})();
