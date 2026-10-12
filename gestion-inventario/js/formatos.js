/* =====================================================================
 * formatos.js — Documentos imprimibles que sustentan cada acto
 * (A4, se imprimen o guardan como PDF desde el diálogo del navegador)
 * ===================================================================== */
(function () {
  'use strict';
  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const soles = (n) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fecha = (iso) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';

  function cabecera(cfg, titulo, numero) {
    return `
      <div class="cab"><div><b>${esc(cfg.entidad)}</b><br>${esc(cfg.establecimiento)}<br>${esc(cfg.red)}</div>
      <div style="text-align:right">Control Patrimonial<br>${esc(cfg.ubigeo)}<br>Impreso: ${fecha(new Date().toISOString())}</div></div>
      <h1>${esc(titulo)}</h1>${numero ? `<div class="num">N° ${esc(numero)}</div>` : ''}`;
  }

  function tablaBienes(filas, conCambio) {
    let total = 0;
    const cuerpo = filas.map((b, i) => {
      total += Number(b.valor || 0);
      return `<tr><td>${i + 1}</td><td>${esc(b.codigo)}</td><td>${esc(b.descripcion)}</td><td>${esc(b.marca)}</td>
        <td>${esc(b.modelo)}</td><td>${esc(b.serie)}</td><td>${esc(b.estado)}</td>
        ${conCambio ? `<td>${esc(conCambio(b))}</td>` : ''}<td style="text-align:right">${soles(b.valor)}</td></tr>`;
    }).join('');
    return `<table><thead><tr><th>N°</th><th>Código patrimonial</th><th>Denominación</th><th>Marca</th><th>Modelo</th>
      <th>Serie</th><th>Estado</th>${conCambio ? '<th>Detalle</th>' : ''}<th>Valor</th></tr></thead>
      <tbody>${cuerpo}</tbody><tfoot><tr><td colspan="${conCambio ? 8 : 7}" style="text-align:right"><b>Total (${filas.length} bienes)</b></td>
      <td style="text-align:right"><b>${soles(total)}</b></td></tr></tfoot></table>`;
  }

  const firmas = (lista) => `<div class="firmas">${lista.map((f) => `<div>${esc(f[0])}<br><b>${esc(f[1] || '')}</b></div>`).join('')}</div>`;
  const pie = (cfg) => `<div class="pie">Documento generado por el aplicativo de Gestión de Inventario — ${esc(cfg.entidad)}.
    Marco: D.Leg. N° 1439, D.S. N° 217-2019-EF y Directiva N° 0006-2021-EF/54.01. Sin firmas no surte efecto.</div>`;

  function datos(pares) {
    return `<table class="datos">${pares.filter((p) => p[1]).map((p) => `<tr><td>${esc(p[0])}:</td><td>${esc(p[1])}</td></tr>`).join('')}</table>`;
  }

  /** Formato del movimiento según su tipo */
  function movimiento(m, ctx) {
    const def = Core.TIPOS_MOVIMIENTO[m.tipo];
    const cfg = ctx.config;
    const nom = ctx.nombrePersona;
    const filas = m.detalle.map((d) => Object.assign({}, d, { estado: d.despues ? d.despues.estado || d.estado : d.estado }));
    const respDestino = nom(m.responsable_destino);
    const respOrigen = [...new Set(m.detalle.map((d) => d.antes && nom(d.antes.responsable)).filter(Boolean))].join(', ');
    const pares = [
      ['Tipo de acto', def.nombre], ['Fecha', fecha(m.fecha)], ['Causal', m.causal],
      ['Documento de sustento', m.documento], ['Responsable que entrega', respOrigen],
      ['Responsable que recibe', respDestino], ['Ubicación de destino', m.ubicacion_destino],
      ['Destino / beneficiario externo', m.destino_externo], ['Fecha prevista de retorno', fecha(m.fecha_retorno)],
      ['Nuevo estado de conservación', m.estado_destino], ['Motivo / sustento', m.motivo], ['Observaciones', m.observaciones]
    ];
    let texto = '';
    let firmasDoc = [['Entrega', respOrigen || 'Control Patrimonial'], ['Recibe', respDestino || ''], ['V°B° Control Patrimonial', cfg.responsable_patrimonio]];
    let cambio = null;
    switch (m.tipo) {
      case 'ASIGNACION':
        texto = `El/la servidor(a) que suscribe recibe en asignación en uso los bienes muebles patrimoniales detallados, asumiendo la responsabilidad
          de su custodia, buen uso y conservación, debiendo comunicar a Control Patrimonial cualquier desplazamiento, pérdida, deterioro o siniestro,
          y devolverlos al término de su vínculo laboral o contractual o cuando le sean requeridos.`;
        firmasDoc = [['Entrega — Control Patrimonial', cfg.responsable_patrimonio], ['Recibe — Usuario responsable', respDestino], ['V°B° Jefatura', cfg.jefe]];
        break;
      case 'DEVOLUCION':
        texto = 'Se deja constancia de la devolución de los bienes detallados, quedando el/la servidor(a) liberado(a) de su custodia a partir de la fecha.';
        firmasDoc = [['Entrega — Usuario', respOrigen], ['Recibe — Control Patrimonial', cfg.responsable_patrimonio], ['V°B° Jefatura', cfg.jefe]];
        break;
      case 'DESPLAZAMIENTO':
        cambio = (d) => `${d.antes.ubicacion} → ${d.despues.ubicacion}`;
        texto = 'Se autoriza el desplazamiento interno de los bienes detallados, con actualización de su ubicación y/o responsable en el registro patrimonial.';
        break;
      case 'SALIDA':
        texto = `Se autoriza la salida temporal de los bienes detallados de las instalaciones del establecimiento, debiendo retornar a más tardar el
          ${fecha(m.fecha_retorno)}. El personal de vigilancia verificará la correspondencia física con la presente orden.`;
        firmasDoc = [['Autoriza — Jefatura', cfg.jefe], ['Control Patrimonial', cfg.responsable_patrimonio], ['Retira / transporta', '']];
        break;
      case 'REINGRESO':
        texto = 'Se deja constancia del reingreso de los bienes detallados, verificándose su estado de conservación.';
        break;
      case 'CAMBIO_ESTADO':
        cambio = (d) => `${d.antes.estado} → ${d.despues.estado}`;
        texto = 'Se constata el estado de conservación de los bienes detallados, actualizándose el registro patrimonial.';
        firmasDoc = [['Usuario responsable', respOrigen], ['Control Patrimonial', cfg.responsable_patrimonio], ['Soporte técnico / evaluador', '']];
        break;
      case 'BAJA':
        texto = `Relación de bienes muebles patrimoniales comprendidos en el procedimiento de baja por la causal "${esc(m.causal)}", sustentado en
          ${esc(m.documento)}. La baja implica la extracción contable y patrimonial de los bienes y su posterior disposición conforme a la normativa del
          Sistema Nacional de Abastecimiento.`;
        firmasDoc = [['Control Patrimonial', cfg.responsable_patrimonio], ['Contabilidad', ''], ['Jefatura', cfg.jefe]];
        break;
      case 'DISPOSICION':
        texto = `Se hace entrega de los bienes detallados, previamente dados de baja, a ${esc(m.destino_externo)} mediante ${esc(m.causal)},
          conforme a ${esc(m.documento)}.`;
        firmasDoc = [['Entrega — Control Patrimonial', cfg.responsable_patrimonio], ['Recibe — ' + (m.destino_externo || ''), ''], ['Jefatura', cfg.jefe]];
        break;
      case 'ALTA':
        texto = `Se incorporan al registro patrimonial los bienes detallados por la causal "${esc(m.causal)}", sustentado en ${esc(m.documento)}.`;
        firmasDoc = [['Almacén / quien entrega', ''], ['Control Patrimonial', cfg.responsable_patrimonio], ['Contabilidad', '']];
        break;
      case 'INVENTARIO':
        cambio = (d) => Object.keys(d.despues).filter((k) => d.antes[k] !== d.despues[k])
          .map((k) => `${k}: ${k === 'responsable' ? nom(d.antes[k]) || '—' : d.antes[k] || '—'} → ${k === 'responsable' ? nom(d.despues[k]) || '—' : d.despues[k]}`).join('; ');
        texto = 'Regularización del registro patrimonial derivada de los resultados de la toma de inventario físico.';
        firmasDoc = [['Presidente(a) Comisión de Inventario', ''], ['Miembro', ''], ['Control Patrimonial', cfg.responsable_patrimonio]];
        break;
    }
    return cabecera(cfg, def.formato, m.numero) + datos(pares) + `<p class="texto">${texto}</p>` +
      tablaBienes(filas, cambio) + firmas(firmasDoc) + pie(cfg) +
      (m.anulado ? `<p style="color:#a00;font-weight:bold;text-align:center">ANULADO el ${fecha(m.anulado.fecha)} — ${esc(m.anulado.motivo)}</p>` : '');
  }

  /** Relación de bienes a cargo de un servidor (útil para cese, rotación o inventario) */
  function relacionResponsable(persona, bienes, ctx) {
    const cfg = ctx.config;
    return cabecera(cfg, 'RELACIÓN DE BIENES MUEBLES PATRIMONIALES ASIGNADOS EN USO', '') +
      datos([['Servidor(a)', persona.nombres], ['DNI', persona.dni], ['Cargo', persona.cargo], ['Condición', persona.condicion]]) +
      '<p class="texto">El/la servidor(a) declara tener bajo su custodia los bienes detallados, en el estado de conservación indicado.</p>' +
      tablaBienes(bienes) + firmas([['Servidor(a) responsable', persona.nombres], ['Control Patrimonial', cfg.responsable_patrimonio], ['V°B° Jefatura', cfg.jefe]]) + pie(cfg);
  }

  /** Ficha individual del bien con su historial (kardex) */
  function fichaBien(b, movs, ctx) {
    const cfg = ctx.config;
    const hist = movs.map((m) => `<tr><td>${fecha(m.fecha)}</td><td>${esc(m.numero)}</td><td>${esc(Core.TIPOS_MOVIMIENTO[m.tipo].nombre)}</td>
      <td>${esc(m.causal || m.motivo || '')}</td><td>${esc(m.documento || '')}</td><td>${m.anulado ? 'ANULADO' : ''}</td></tr>`).join('');
    return cabecera(cfg, 'FICHA DEL BIEN MUEBLE PATRIMONIAL', b.codigo) +
      datos([['Denominación', b.descripcion], ['Código interno', b.codigo_interno], ['Marca / Modelo', `${b.marca} / ${b.modelo}`],
        ['Serie', b.serie], ['Medidas', b.medidas], ['Color', b.color], ['Estado de conservación', b.estado],
        ['Situación', Core.SITUACIONES[b.situacion]], ['Ubicación', b.ubicacion], ['Responsable', ctx.nombrePersona(b.responsable)],
        ['Origen', Core.ORIGENES[b.origen]], ['Orden de compra', b.nro_orden], ['Fecha de adquisición', fecha(b.fecha_adquisicion)],
        ['Valor de adquisición', soles(b.valor)], ['Clasificación contable (ref.)', Core.clasificacionContable(b.valor, cfg.uit)],
        ['Cuenta contable', b.cuenta_contable], ['Observaciones', b.observaciones]]) +
      `<h3 style="margin-top:10px">Historial de movimientos</h3><table><thead><tr><th>Fecha</th><th>N°</th><th>Acto</th><th>Causal / motivo</th>
      <th>Documento</th><th></th></tr></thead><tbody>${hist || '<tr><td colspan="6">Sin movimientos registrados desde la carga inicial.</td></tr>'}</tbody></table>` + pie(cfg);
  }

  /** Informe de resultados de la toma de inventario */
  function informeInventario(inv, r, ctx) {
    const cfg = ctx.config;
    const suma = (a) => a.reduce((s, b) => s + Number(b.valor || 0), 0);
    const resumen = `<table><thead><tr><th>Resultado</th><th>Cantidad</th><th>Valor</th></tr></thead><tbody>
      <tr><td>Conformes</td><td>${r.conformes.length}</td><td style="text-align:right">${soles(suma(r.conformes))}</td></tr>
      <tr><td>Con diferencias (estado/ubicación/responsable)</td><td>${r.diferencias.length}</td><td style="text-align:right">${soles(suma(r.diferencias.map((d) => d.bien)))}</td></tr>
      <tr><td>Faltantes</td><td>${r.faltantes.length}</td><td style="text-align:right">${soles(suma(r.faltantes))}</td></tr>
      <tr><td>Sobrantes (encontrados sin registro)</td><td>${(inv.sobrantes || []).length}</td><td></td></tr>
      <tr><td>Sin verificar</td><td>${r.sinVerificar.length}</td><td style="text-align:right">${soles(suma(r.sinVerificar))}</td></tr></tbody></table>`;
    const sob = (inv.sobrantes || []).map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.descripcion)}</td><td>${esc(s.marca)}</td><td>${esc(s.serie)}</td><td>${esc(s.ubicacion)}</td><td>${esc(s.obs)}</td></tr>`).join('');
    return cabecera(cfg, `INFORME DE RESULTADOS DEL INVENTARIO DE BIENES MUEBLES PATRIMONIALES ${inv.anio}`, inv.id) +
      datos([['Fecha de corte', fecha(inv.fecha_corte)], ['Comisión de inventario', inv.comision], ['Documento de conformación', inv.documento],
        ['Estado del proceso', inv.estado === 'CERRADO' ? 'Cerrado el ' + fecha(inv.cerrado) : 'En ejecución']]) +
      '<h3>Resumen</h3>' + resumen +
      (r.faltantes.length ? '<h3 style="margin-top:10px">Bienes faltantes</h3>' + tablaBienes(r.faltantes) : '') +
      (sob ? `<h3 style="margin-top:10px">Bienes sobrantes</h3><table><thead><tr><th>N°</th><th>Descripción</th><th>Marca</th><th>Serie</th><th>Ubicación</th><th>Obs.</th></tr></thead><tbody>${sob}</tbody></table>` : '') +
      `<p class="texto">Los bienes faltantes deben ser materia de investigación y, de corresponder, del procedimiento de baja por la causal de pérdida,
      robo o sustracción, previo deslinde de responsabilidades. Los sobrantes deben incorporarse mediante alta por la causal correspondiente.
      El informe se concilia con el registro contable y se remite a la Unidad Ejecutora en el plazo que establezca la normativa vigente.</p>` +
      firmas([['Presidente(a) de la Comisión', ''], ['Miembro', ''], ['Miembro', '']]) + pie(cfg);
  }

  function imprimir(html) {
    const area = document.getElementById('impresion');
    area.innerHTML = `<div class="doc">${html}</div>`;
    window.print();
  }

  window.Formatos = { movimiento, relacionResponsable, fichaBien, informeInventario, imprimir, esc, soles, fecha };
})();
