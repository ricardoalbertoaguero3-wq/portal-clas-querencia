/* =====================================================================
 * core.js — Reglas de negocio de gestión de bienes muebles patrimoniales
 * CLAS Agregado La Querencia
 *
 * Implementa la Directiva N° 0006-2021-EF/54.01 "Directiva para la gestión
 * de bienes muebles patrimoniales en el marco del Sistema Nacional de
 * Abastecimiento" (R.D. N° 0015-2021-EF/54.01), complementada con el
 * Reglamento de la Ley N° 29124 de cogestión CLAS (D.S. N° 017-2008-SA).
 * Cada catálogo indica el artículo que lo sustenta.
 *
 * No depende del navegador: se usa en la app y en las pruebas (node --test).
 * ===================================================================== */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------
  // Catálogos
  // ---------------------------------------------------------------
  /** Escala del Apéndice A (Anexo N° 01): Nuevo, Bueno, Regular, Malo, RAEE, Chatarra */
  const ESTADOS_CONSERVACION = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'RAEE', 'Chatarra'];

  /** Situación administrativa del bien (independiente del estado físico) */
  const SITUACIONES = {
    ACTIVO: 'Activo (en uso o disponible)',
    EN_SALIDA: 'Fuera de la sede (Anexo N° 04)',
    AFECTADO: 'Afectado en uso a otra entidad (art. 54)',
    FALTANTE: 'Faltante (art. 4.2.d)',
    BAJA: 'Dado de baja, pendiente de disposición (art. 50)',
    DISPUESTO: 'Excluido del patrimonio (disposición o art. 60.3)'
  };

  /* Titularidad. Los bienes adquiridos o donados al CLAS durante el ejercicio se transfieren
   * a título gratuito al Gobierno Regional y se incorporan al patrimonio del Estado
   * (arts. 63.d y 68.d del D.S. N° 017-2008-SA). */
  const ORIGENES = {
    UE: 'Patrimonio del Estado (Gobierno Regional / UE), en administración del CLAS',
    CLAS: 'Adquirido por el CLAS — pendiente de transferir al Gobierno Regional (art. 63.d)',
    DONACION: 'Donado al CLAS — pendiente de transferir al Gobierno Regional (art. 68.d)',
    AFECTACION: 'Recibido en afectación en uso de otra entidad',
    NO_DETERMINADO: 'No determinado (sanear)'
  };
  const ORIGENES_POR_TRANSFERIR = ['CLAS', 'DONACION'];

  /** Art. 27 */
  const MODALIDADES_ASIGNACION = ['Sede institucional (art. 28)', 'Teletrabajo (art. 29)'];

  /** Art. 84 */
  const TIPOS_MANTENIMIENTO = ['Preventivo', 'Predictivo', 'Correctivo', 'En uso (a cargo del usuario)'];

  /* Causales de alta — art. 16.1 (documento exigido: art. 17.1).
   * La compra no es causal del art. 16: se registra con PECOSA/NEA (art. 21.3).
   * acta: se formaliza con Acta de Entrega–Recepción (Anexo N° 02).
   * resolucion: exige informe técnico y resolución. */
  const CAUSALES_ALTA = [
    { nombre: 'Adquisición por compra (registro con PECOSA / NEA)', ref: 'art. 21.3', doc: 'PECOSA, NEA y orden de compra' },
    { nombre: 'Aceptación de donación', ref: 'arts. 7–10, 16.1.a', doc: 'Resolución que acepta la donación', acta: true, resolucion: true },
    { nombre: 'Reposición', ref: 'arts. 11–12, 16.1.b', doc: 'Resolución que aprueba la reposición', acta: true, resolucion: true },
    { nombre: 'Fabricación', ref: 'arts. 13–14, 16.1.c', doc: 'Informe de bienes muebles fabricados' },
    { nombre: 'Permuta', ref: 'arts. 16.1.d, 81–82', doc: 'Documento que aprueba la permuta', acta: true, resolucion: true },
    { nombre: 'Transferencia', ref: 'art. 16.1.e', doc: 'Documento emitido por el transferente', acta: true },
    { nombre: 'Disposición legal', ref: 'art. 16.1.f', doc: 'Norma con rango de ley' },
    { nombre: 'Resolución judicial o laudo arbitral firme', ref: 'art. 16.1.g', doc: 'Resolución judicial o laudo' },
    { nombre: 'Saneamiento administrativo de bienes muebles sobrantes', ref: 'arts. 16.1.i, 38–43', doc: 'Resolución que aprueba el saneamiento', resolucion: true },
    { nombre: 'Otra causal (opinión de OAJ y resolución de OGA)', ref: 'art. 16.2', doc: 'Resolución de OGA', resolucion: true }
  ];

  /* Causales de baja — art. 48.1 (la causal l, invalidez de semoviente, no aplica al establecimiento).
   * estado: el bien debe tener ese estado de conservación.
   * denuncia: exige denuncia policial o fiscal.
   * faltante: aplicable a bienes en situación FALTANTE.
   * sinDisposicion: no requiere acto de disposición (art. 60.3). */
  const CAUSALES_BAJA = [
    { nombre: 'Daño', ref: 'art. 48.1.a' },
    { nombre: 'Ejecución de garantía', ref: 'art. 48.1.b' },
    { nombre: 'Estado de excedencia', ref: 'art. 48.1.c' },
    { nombre: 'Estado de chatarra', ref: 'art. 48.1.d', estado: 'Chatarra' },
    { nombre: 'Falta de idoneidad del bien', ref: 'art. 48.1.e' },
    { nombre: 'Mantenimiento o reparación onerosa', ref: 'art. 48.1.f' },
    { nombre: 'Obsolescencia técnica', ref: 'art. 48.1.g' },
    { nombre: 'RAEE', ref: 'art. 48.1.h; arts. 49.2, Directiva N° 001-2020-EF/54.01', estado: 'RAEE' },
    { nombre: 'Saneamiento administrativo de bienes muebles patrimoniales faltantes', ref: 'arts. 44–46, 48.1.i', faltante: true, soloFaltante: true, sinDisposicion: true },
    { nombre: 'Sustracción', ref: 'art. 48.1.j', denuncia: true, faltante: true },
    { nombre: 'Transformación', ref: 'art. 48.1.k' },
    { nombre: 'Otra causal (opinión de OAJ y resolución de OGA)', ref: 'art. 48.2' }
  ];

  /* Disposición final — actos de disposición (art. 61) y eliminación (8ª DCF) */
  const MODALIDADES_DISPOSICION = [
    { nombre: 'Transferencia', ref: 'arts. 62–63' },
    { nombre: 'Donación', ref: 'arts. 64–65; Ley N° 27995 (art. 60.2)' },
    { nombre: 'Subasta pública', ref: 'arts. 66–80; Anexo N° 10', tasacion: true },
    { nombre: 'Permuta', ref: 'arts. 81–82', tasacion: true },
    { nombre: 'Eliminación o destrucción (chatarra)', ref: '8ª Disp. Complementaria Final; D.Leg. N° 1278', noRAEE: true },
    { nombre: 'Entrega de RAEE a operador autorizado', ref: 'art. 49.2; Directiva N° 001-2020-EF/54.01; D.S. N° 009-2019-MINAM', soloRAEE: true }
  ];

  /** Motivos de la Orden de Salida (Anexo N° 04) */
  const MOTIVOS_SALIDA = [
    { nombre: 'Mantenimiento', ref: 'art. 87', mantenimiento: true },
    { nombre: 'Comisión de servicios', ref: 'arts. 28.3–28.4' },
    { nombre: 'Capacitación y/o evento', ref: 'Anexo N° 04' }
  ];

  /** Causales de extinción de la afectación en uso — art. 58, más el vencimiento del plazo (art. 56) */
  const CAUSALES_EXTINCION = [
    { nombre: 'Vencimiento del plazo', ref: 'art. 56' },
    { nombre: 'Daño o sustracción', ref: 'art. 58.a' },
    { nombre: 'Extinción de la afectataria', ref: 'art. 58.b' },
    { nombre: 'Incumplimiento de la finalidad', ref: 'art. 58.c; 59.1' },
    { nombre: 'Necesidad ante Estado de Emergencia', ref: 'art. 58.d' },
    { nombre: 'Renuncia', ref: 'art. 58.e' }
  ];

  const CAUSALES_POR_TIPO = {
    ALTA: CAUSALES_ALTA, BAJA: CAUSALES_BAJA, DISPOSICION: MODALIDADES_DISPOSICION,
    SALIDA: MOTIVOS_SALIDA, EXTINCION_AFECTACION: CAUSALES_EXTINCION
  };
  const causalDef = (tipo, nombre) => (CAUSALES_POR_TIPO[tipo] || []).find((c) => c.nombre === nombre) || {};

  /** Agrupación de los actos según los Títulos de la Directiva */
  const GRUPOS = [
    { id: 'III', titulo: 'Título III — Alta y registro', arts: 'Arts. 15–25' },
    { id: 'IV', titulo: 'Título IV — Asignación en uso', arts: 'Arts. 26–30 · Anexo N° 03' },
    { id: 'TRASLADO', titulo: 'Salida, reingreso y desplazamiento interno', arts: 'Arts. 28.4, 30.c y 87 · Anexo N° 04' },
    { id: 'IX', titulo: 'Título IX — Mantenimiento', arts: 'Arts. 83–88' },
    { id: 'VII', titulo: 'Título VII — Baja', arts: 'Arts. 47–51' },
    { id: 'VIII', titulo: 'Título VIII — Disposición final', arts: 'Arts. 52–82' },
    { id: 'CLAS', titulo: 'Cogestión CLAS — Bienes adquiridos o donados al CLAS', arts: 'D.S. N° 017-2008-SA, arts. 63.d y 68.d' }
  ];

  /* Tipos de movimiento.
   * desde: situaciones desde las que se permite el acto.
   * campos: campos del formulario; requiere: obligatorios (además de los condicionados por causal).
   * informe: el acto se sustenta en Informe Técnico (Anexo N° 01).
   * etiquetas: rótulos propios del acto. */
  const TIPOS_MOVIMIENTO = {
    ALTA: {
      nombre: 'Alta', prefijo: 'ALT', grupo: 'III', base: 'Arts. 15–18 y 21', anexo: 'Anexo N° 02 / Apéndice A', informe: true, desde: null,
      campos: ['causal', 'documento', 'informe_tecnico', 'resolucion', 'contraparte', 'contraparte_doc', 'contraparte_cargo', 'motivo'],
      requiere: ['causal', 'documento'],
      etiquetas: { documento: 'Documento que acredita la causal (art. 17.1)', contraparte: 'Quien entrega (donante, transferente, proveedor)' },
      descripcion: 'Incorpora bienes al registro patrimonial.'
    },
    ASIGNACION: {
      nombre: 'Asignación en uso', prefijo: 'ASG', grupo: 'IV', base: 'Arts. 26–28 y 30', anexo: 'Anexo N° 03', desde: ['ACTIVO'],
      campos: ['responsable_destino', 'modalidad', 'ubicacion_destino', 'documento', 'motivo'],
      requiere: ['responsable_destino', 'modalidad'],
      etiquetas: { responsable_destino: 'Usuario que recibe (art. 4.2.o)' },
      descripcion: 'Entrega bienes al usuario, que asume su custodia (art. 30). Los bienes de uso común se asignan al jefe de la unidad (art. 28.2).'
    },
    DEVOLUCION: {
      nombre: 'Devolución', prefijo: 'DEV', grupo: 'IV', base: 'Arts. 29.3 y 30.e', anexo: 'Anexo N° 03', desde: ['ACTIVO'],
      campos: ['ubicacion_destino', 'estado_destino', 'documento', 'motivo'],
      requiere: ['motivo'],
      etiquetas: { estado_destino: 'Estado verificado al devolver (si difiere)', motivo: 'Motivo (cese, rotación, término de teletrabajo, etc.)' },
      descripcion: 'El usuario devuelve los bienes; se deja constancia de daños no propios del uso (art. 29.3.c).'
    },
    DESPLAZAMIENTO: {
      nombre: 'Desplazamiento interno', prefijo: 'DSP', grupo: 'TRASLADO', base: 'Arts. 28.4 y 30.c', anexo: 'Anexo N° 04', desde: ['ACTIVO'],
      campos: ['ubicacion_destino', 'responsable_destino', 'responsable_traslado', 'responsable_traslado_dni', 'documento', 'motivo'],
      requiere: ['ubicacion_destino'],
      etiquetas: { responsable_destino: 'Nuevo usuario responsable (opcional)' },
      descripcion: 'Traslado entre ambientes de la sede. El usuario no traslada bienes sin comunicarlo a la OCP (art. 30.c).'
    },
    SALIDA: {
      nombre: 'Salida', prefijo: 'SAL', grupo: 'TRASLADO', base: 'Arts. 28.3–28.4 y 87', anexo: 'Anexo N° 04', desde: ['ACTIVO'],
      campos: ['causal', 'documento', 'responsable_traslado', 'responsable_traslado_dni', 'destino_externo', 'contraparte', 'fecha_retorno', 'tipo_mantenimiento', 'motivo'],
      requiere: ['causal', 'documento', 'responsable_traslado', 'destino_externo', 'fecha_retorno'],
      etiquetas: { causal: 'Motivo (Anexo N° 04)', documento: 'Documento que autoriza el traslado', destino_externo: 'Destino: proveedor u órgano, dirección', contraparte: 'Representante del destino' },
      descripcion: 'Salida temporal de bienes del local, autorizada por Control Patrimonial (art. 87).'
    },
    REINGRESO: {
      nombre: 'Reingreso', prefijo: 'REI', grupo: 'TRASLADO', base: 'Arts. 28.4 y 87', anexo: 'Anexo N° 04', desde: ['EN_SALIDA'],
      campos: ['estado_destino', 'documento', 'motivo'],
      requiere: [],
      etiquetas: { estado_destino: 'Estado al reingresar (si difiere)' },
      descripcion: 'Retorno de los bienes que salieron con orden de salida.'
    },
    MANTENIMIENTO: {
      nombre: 'Registro de mantenimiento', prefijo: 'MNT', grupo: 'IX', base: 'Arts. 83–88', anexo: '—', desde: ['ACTIVO', 'EN_SALIDA'],
      campos: ['tipo_mantenimiento', 'destino_externo', 'documento', 'costo', 'estado_destino', 'motivo'],
      requiere: ['tipo_mantenimiento', 'motivo'],
      etiquetas: { destino_externo: 'Ejecutado por (proveedor o personal propio)', documento: 'Orden de servicio / conformidad', motivo: 'Trabajos realizados' },
      descripcion: 'Registra el mantenimiento realizado (art. 88), dentro del Plan de Mantenimiento (art. 86).'
    },
    CAMBIO_ESTADO: {
      nombre: 'Actualización del estado de conservación', prefijo: 'CEC', grupo: 'IX', base: 'Art. 22', anexo: 'Apéndice A', informe: true, desde: ['ACTIVO', 'EN_SALIDA', 'AFECTADO'],
      campos: ['estado_destino', 'informe_tecnico', 'motivo'],
      requiere: ['estado_destino', 'motivo'],
      etiquetas: { informe_tecnico: 'Informe técnico / evaluación (si existe)' },
      descripcion: 'Mantiene actualizado el estado de conservación en el registro (art. 22.2). Paso previo a una baja por chatarra o RAEE.'
    },
    BAJA: {
      nombre: 'Baja', prefijo: 'BAJ', grupo: 'VII', base: 'Arts. 47–49', anexo: 'Anexo N° 01 / Apéndice A', informe: true, desde: ['ACTIVO', 'FALTANTE'],
      campos: ['causal', 'informe_tecnico', 'resolucion', 'denuncia', 'motivo'],
      requiere: ['causal', 'informe_tecnico', 'resolucion', 'motivo'],
      etiquetas: { motivo: 'Sustento de la causal' },
      descripcion: 'Cancela la anotación del bien en el registro patrimonial (art. 47). La disposición debe ejecutarse en un plazo de 5 meses (art. 50.1).'
    },
    AFECTACION: {
      nombre: 'Afectación en uso (otorgada)', prefijo: 'AFE', grupo: 'VIII', base: 'Arts. 53–57', anexo: 'Anexo N° 02', informe: true, desde: ['ACTIVO'],
      campos: ['destino_externo', 'informe_tecnico', 'resolucion', 'contraparte', 'contraparte_doc', 'contraparte_cargo', 'fecha_retorno', 'motivo'],
      requiere: ['destino_externo', 'informe_tecnico', 'fecha_retorno', 'motivo'],
      etiquetas: { destino_externo: 'Entidad afectataria', fecha_retorno: 'Vencimiento (máximo 1 año — art. 56.1)', motivo: 'Finalidad pública', resolucion: 'Resolución de OGA (o informe técnico refrendado — art. 57.2.b)' },
      descripcion: 'Entrega la posesión gratuita y temporal a otra entidad. Es un acto de administración (art. 53).'
    },
    EXTINCION_AFECTACION: {
      nombre: 'Extinción de la afectación en uso', prefijo: 'EXA', grupo: 'VIII', base: 'Arts. 55.4, 58–59', anexo: 'Anexo N° 02', informe: true, desde: ['AFECTADO'],
      campos: ['causal', 'informe_tecnico', 'resolucion', 'estado_destino', 'contraparte', 'motivo'],
      requiere: ['causal', 'resolucion'],
      etiquetas: { estado_destino: 'Estado al ser devuelto', contraparte: 'Quien devuelve (afectataria)' },
      descripcion: 'Devolución del bien al término de la afectación.'
    },
    DISPOSICION: {
      nombre: 'Disposición', prefijo: 'DIS', grupo: 'VIII', base: 'Arts. 52, 60–82; 8ª DCF', anexo: 'Anexo N° 02', informe: true, desde: ['BAJA'],
      campos: ['causal', 'informe_tecnico', 'resolucion', 'destino_externo', 'contraparte', 'contraparte_doc', 'contraparte_cargo', 'valor_tasacion', 'motivo'],
      requiere: ['causal', 'informe_tecnico', 'resolucion', 'destino_externo'],
      etiquetas: { causal: 'Acto de disposición', destino_externo: 'Beneficiario / adjudicatario / operador', valor_tasacion: 'Valor de tasación S/ (arts. 92–93)' },
      descripcion: 'Otorga la propiedad de bienes ya dados de baja (art. 60.1).'
    },
    TRANSFERENCIA_GR: {
      nombre: 'Transferencia al Gobierno Regional', prefijo: 'TGR', grupo: 'CLAS',
      base: 'Arts. 63.d y 68.d del D.S. N° 017-2008-SA; art. 16.1.e de la Directiva', anexo: 'Anexo N° 02', desde: ['ACTIVO', 'EN_SALIDA'],
      origenes: ORIGENES_POR_TRANSFERIR,
      campos: ['documento', 'destino_externo', 'contraparte', 'contraparte_doc', 'contraparte_cargo', 'motivo'],
      requiere: ['documento', 'destino_externo'],
      etiquetas: { documento: 'Documento de transferencia emitido por el CLAS (art. 17.1.e de la Directiva)', destino_externo: 'Autoridad Sanitaria Regional / Gobierno Regional receptor',
        contraparte: 'Representante que recibe' },
      descripcion: 'Transfiere a título gratuito los bienes que el CLAS adquirió o recibió en donación durante el ejercicio, para su incorporación al patrimonio del Estado. Los bienes siguen en uso en el establecimiento.'
    },
    INVENTARIO: {
      nombre: 'Regularización por inventario', prefijo: 'INV', grupo: null, base: 'Art. 35.6.a', anexo: 'Anexo N° 06', desde: ['ACTIVO', 'EN_SALIDA', 'FALTANTE', 'AFECTADO'],
      campos: [], requiere: [],
      descripcion: 'Actualiza el registro con los resultados de la verificación.'
    }
  };

  const ETIQUETAS_CAMPO = {
    causal: 'Causal',
    documento: 'Documento de sustento',
    informe_tecnico: 'N° de Informe Técnico (Anexo N° 01)',
    resolucion: 'N° y fecha de resolución que aprueba',
    responsable_destino: 'Usuario responsable',
    modalidad: 'Modalidad (art. 27)',
    ubicacion_destino: 'Ubicación de destino',
    destino_externo: 'Destino externo',
    contraparte: 'Nombre del representante',
    contraparte_doc: 'DNI / RUC del representante',
    contraparte_cargo: 'Cargo / razón social',
    responsable_traslado: 'Responsable del traslado',
    responsable_traslado_dni: 'DNI del responsable del traslado',
    fecha_retorno: 'Fecha prevista de retorno',
    estado_destino: 'Nuevo estado de conservación',
    tipo_mantenimiento: 'Tipo de mantenimiento (art. 84)',
    costo: 'Costo S/',
    denuncia: 'N° de denuncia policial o fiscal (art. 48.1.j)',
    valor_tasacion: 'Valor de tasación S/',
    motivo: 'Motivo / sustento'
  };
  const etiqueta = (tipo, campo) => ((TIPOS_MOVIMIENTO[tipo] || {}).etiquetas || {})[campo] || ETIQUETAS_CAMPO[campo] || campo;

  // ---------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------
  const limpiar = (v) => (v === null || v === undefined) ? '' : String(v).replace(/\s+/g, ' ').trim();

  function hoyISO(d) {
    const x = d || new Date();
    const z = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}`;
  }
  const aFecha = (iso) => new Date(iso + 'T12:00:00');

  /** Días hábiles (lunes a viernes) transcurridos después de `desde` hasta `hasta`, inclusive.
   *  No descuenta feriados: es un cálculo referencial. */
  function diasHabiles(desde, hasta) {
    if (!desde || !hasta || hasta <= desde) return 0;
    let n = 0;
    const d = aFecha(desde);
    const fin = aFecha(hasta);
    while (d < fin) {
      d.setDate(d.getDate() + 1);
      const s = d.getDay();
      if (s !== 0 && s !== 6) n++;
    }
    return n;
  }
  function sumarMeses(iso, meses) {
    const d = aFecha(iso);
    d.setMonth(d.getMonth() + meses);
    return hoyISO(d);
  }

  /** Código patrimonial: 12 dígitos = 8 de catálogo + 4 correlativo (art. 20.2; 2ª DCT) */
  function validarCodigoPatrimonial(codigo) {
    const c = limpiar(codigo);
    if (!/^\d{12}$/.test(c)) return { ok: false, error: 'El código patrimonial debe tener 12 dígitos numéricos (art. 20.2).' };
    return { ok: true, catalogo: c.slice(0, 8), correlativo: c.slice(8) };
  }

  function normalizarEstado(v) {
    const s = limpiar(v).toLowerCase();
    if (!s) return 'Regular';
    const map = { n: 'Nuevo', b: 'Bueno', r: 'Regular', m: 'Malo', x: 'RAEE' };
    if (map[s]) return map[s];
    return ESTADOS_CONSERVACION.find((e) => e.toLowerCase() === s) || 'Regular';
  }

  function aFechaISO(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return hoyISO(v);
    if (typeof v === 'number') {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    const s = limpiar(v);
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }

  function aNumero(v) {
    if (typeof v === 'number') return v;
    const n = parseFloat(limpiar(v).replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  /** Fila del Excel institucional (INVENTARIO_CLAS_QUERENCIA) → bien */
  function filaExcelABien(fila) {
    const f = {};
    Object.keys(fila).forEach((k) => { f[limpiar(k).toLowerCase().replace(/\s+/g, '_')] = fila[k]; });
    const nroOrden = limpiar(f.nro_orden);
    return {
      codigo: limpiar(f.codigo_patrimonial),
      codigo_interno: limpiar(f.codigo_interno),
      descripcion: limpiar(f.descripcion).toUpperCase(),
      marca: limpiar(f.marca),
      modelo: limpiar(f.modelo),
      serie: limpiar(f.nro_serie),
      medidas: limpiar(f.medidas),
      color: limpiar(f.color),
      estado: normalizarEstado(f.estado_conservacion),
      dependencia: limpiar(f.nombre_depend),
      ubicacion: limpiar(f.ubicac_fisica) || 'SIN UBICACION',
      // 9998 se usa en el inventario como "sin orden de compra registrada"
      nro_orden: nroOrden === '9998' ? '' : nroOrden,
      fecha_adquisicion: aFechaISO(f.fecha_compra),
      valor: aNumero(f.valor_inicial),
      situacion: 'ACTIVO',
      origen: 'NO_DETERMINADO',
      responsable: '',
      cuenta_contable: limpiar(f.cuenta_contable),
      observaciones: ''
    };
  }

  /** Art. 5.c: activo fijo o bien no depreciable (cuentas de orden) según el SNC.
   *  El umbral de 1/4 UIT es referencial; la clasificación la define Contabilidad. */
  function clasificacionContable(valor, uit) {
    if (!uit) return '—';
    return aNumero(valor) >= uit / 4 ? 'Activo fijo (≥ 1/4 UIT)' : 'Bien no depreciable — cuentas de orden (< 1/4 UIT)';
  }

  /** Correlativo PREFIJO-AAAA-NNNN */
  function siguienteNumero(tipo, anio, existentes) {
    const pref = TIPOS_MOVIMIENTO[tipo].prefijo + '-' + anio + '-';
    let max = 0;
    (existentes || []).forEach((n) => {
      if (n && n.startsWith(pref)) max = Math.max(max, parseInt(n.slice(pref.length), 10) || 0);
    });
    return pref + String(max + 1).padStart(4, '0');
  }

  // ---------------------------------------------------------------
  // Validación de movimientos
  // ---------------------------------------------------------------
  /** Campos obligatorios del acto, incluidos los que dependen de la causal */
  function camposObligatorios(mov) {
    const def = TIPOS_MOVIMIENTO[mov.tipo];
    const req = def.requiere.slice();
    const c = causalDef(mov.tipo, mov.causal);
    if (mov.tipo === 'ALTA' && c.resolucion) req.push('informe_tecnico', 'resolucion');
    if (mov.tipo === 'ALTA' && c.acta) req.push('contraparte');
    if (mov.tipo === 'BAJA' && c.denuncia) req.push('denuncia');
    if (mov.tipo === 'DISPOSICION' && c.tasacion) req.push('valor_tasacion');
    if (mov.tipo === 'SALIDA' && c.mantenimiento) req.push('tipo_mantenimiento');
    return [...new Set(req)];
  }

  /** Devuelve la lista de errores (vacía si el acto es válido) */
  function validarMovimiento(mov, bienesPorCodigo, hoy) {
    const errores = [];
    const def = TIPOS_MOVIMIENTO[mov.tipo];
    if (!def) return ['Tipo de movimiento no reconocido.'];
    const h = hoy || hoyISO();
    if (!mov.fecha) errores.push('La fecha del acto es obligatoria.');
    if (mov.fecha && mov.fecha > h) errores.push('La fecha del acto no puede ser futura.');
    camposObligatorios(mov).forEach((c) => {
      if (!limpiar(mov[c])) errores.push(`Falta: ${etiqueta(mov.tipo, c)}.`);
    });
    const c = causalDef(mov.tipo, mov.causal);
    if (CAUSALES_POR_TIPO[mov.tipo] && mov.causal && !c.nombre) errores.push('La causal no corresponde a las previstas en la Directiva.');
    if (['SALIDA', 'AFECTACION'].includes(mov.tipo) && mov.fecha_retorno && mov.fecha && mov.fecha_retorno <= mov.fecha) {
      errores.push('La fecha de retorno o de vencimiento debe ser posterior a la fecha del acto.');
    }
    if (mov.tipo === 'AFECTACION' && mov.fecha && mov.fecha_retorno && mov.fecha_retorno > sumarMeses(mov.fecha, 12)) {
      errores.push('La afectación en uso se aprueba hasta por un plazo máximo de un (1) año (art. 56.1).');
    }
    if (mov.costo && aNumero(mov.costo) < 0) errores.push('El costo no puede ser negativo.');

    if (mov.tipo === 'ALTA') {
      if (!mov.nuevos || !mov.nuevos.length) errores.push('Registre al menos un bien a incorporar.');
      (mov.nuevos || []).forEach((b) => {
        const v = validarCodigoPatrimonial(b.codigo);
        if (!v.ok) errores.push(`${b.codigo || '(sin código)'}: ${v.error}`);
        else if (bienesPorCodigo[b.codigo]) errores.push(`${b.codigo}: el código ya existe; no puede haber dos bienes con el mismo código (art. 20.3).`);
        if (!limpiar(b.descripcion)) errores.push(`${b.codigo}: falta la denominación del bien.`);
        if (!(aNumero(b.valor) > 0)) errores.push(`${b.codigo}: el valor debe ser mayor a 0 (art. 22.1).`);
      });
      return errores;
    }

    if (!mov.items || !mov.items.length) errores.push('Seleccione al menos un bien.');
    (mov.items || []).forEach((cod) => {
      const b = bienesPorCodigo[cod];
      if (!b) { errores.push(`${cod}: no existe en el registro.`); return; }
      if (def.desde && !def.desde.includes(b.situacion)) {
        errores.push(`${cod}: la situación "${SITUACIONES[b.situacion]}" no permite ${def.nombre.toLowerCase()}.`);
        return;
      }
      switch (mov.tipo) {
        case 'ASIGNACION':
          if (b.responsable && b.responsable === mov.responsable_destino) errores.push(`${cod}: ya está asignado a ese usuario.`);
          break;
        case 'DEVOLUCION':
          if (!b.responsable) errores.push(`${cod}: no tiene usuario asignado.`);
          break;
        case 'DESPLAZAMIENTO':
          if (b.ubicacion === mov.ubicacion_destino && (!mov.responsable_destino || mov.responsable_destino === b.responsable)) {
            errores.push(`${cod}: ya se encuentra en la ubicación de destino.`);
          }
          break;
        case 'CAMBIO_ESTADO':
          if (b.estado === mov.estado_destino) errores.push(`${cod}: ya tiene estado "${b.estado}".`);
          break;
        case 'BAJA':
          if (b.situacion === 'FALTANTE' && c.nombre && !c.faltante) {
            errores.push(`${cod}: un bien faltante solo se da de baja por saneamiento de faltantes o por sustracción (arts. 44–45, 48.1.j).`);
          }
          if (c.soloFaltante && b.situacion !== 'FALTANTE') errores.push(`${cod}: la causal "${c.nombre}" solo procede para bienes faltantes (art. 44).`);
          if (c.estado && b.estado !== c.estado) errores.push(`${cod}: para la causal "${c.nombre}" el bien debe figurar en estado "${c.estado}". Actualice antes su estado de conservación.`);
          break;
        case 'TRANSFERENCIA_GR':
          if (!ORIGENES_POR_TRANSFERIR.includes(b.origen)) errores.push(`${cod}: no figura como bien adquirido o donado al CLAS pendiente de transferencia; su titularidad es "${(ORIGENES[b.origen] || b.origen).split(' (')[0]}".`);
          break;
        case 'DISPOSICION':
          if (c.noRAEE && b.estado === 'RAEE') errores.push(`${cod}: los RAEE no pueden ser eliminados (8ª Disp. Complementaria Final).`);
          if (c.soloRAEE && b.estado !== 'RAEE') errores.push(`${cod}: solo se entregan a un operador RAEE los bienes calificados como RAEE.`);
          break;
        default:
      }
    });
    return errores;
  }

  // ---------------------------------------------------------------
  // Aplicación de movimientos
  // ---------------------------------------------------------------
  /** Campos del bien que cambian por actos (se guardan antes/después para el kardex y la anulación) */
  const CAMPOS_TRAZABLES = ['situacion', 'estado', 'ubicacion', 'responsable', 'origen', 'fecha_transferencia', 'fecha_baja', 'causal_baja', 'resolucion_baja', 'afectataria', 'afectacion_vence', 'ultimo_mantenimiento'];
  const instantanea = (b) => CAMPOS_TRAZABLES.reduce((o, k) => (o[k] = b[k] || '', o), {});

  /** Aplica el movimiento a un bien y devuelve {bien, antes, despues}, sin mutar el original */
  function aplicarMovimiento(mov, bien) {
    const b = Object.assign({}, bien);
    const antes = instantanea(b);
    const nuevoEstado = () => { if (mov.estado_destino) b.estado = mov.estado_destino; };
    switch (mov.tipo) {
      case 'ASIGNACION':
        b.responsable = mov.responsable_destino;
        if (mov.ubicacion_destino) b.ubicacion = mov.ubicacion_destino;
        break;
      case 'DEVOLUCION':
        b.responsable = '';
        if (mov.ubicacion_destino) b.ubicacion = mov.ubicacion_destino;
        nuevoEstado();
        break;
      case 'DESPLAZAMIENTO':
        b.ubicacion = mov.ubicacion_destino;
        if (mov.responsable_destino) b.responsable = mov.responsable_destino;
        break;
      case 'SALIDA':
        b.situacion = 'EN_SALIDA';
        break;
      case 'REINGRESO':
        b.situacion = 'ACTIVO';
        nuevoEstado();
        break;
      case 'MANTENIMIENTO':
        b.ultimo_mantenimiento = mov.fecha;
        nuevoEstado();
        break;
      case 'CAMBIO_ESTADO':
        b.estado = mov.estado_destino;
        break;
      case 'BAJA': {
        const c = causalDef('BAJA', mov.causal);
        // Sin disposición posterior (art. 60.3): sale del patrimonio con la baja
        b.situacion = c.sinDisposicion ? 'DISPUESTO' : 'BAJA';
        b.responsable = ''; // queda en custodia de la OCP (art. 50.2)
        b.fecha_baja = mov.fecha;
        b.causal_baja = mov.causal;
        b.resolucion_baja = mov.resolucion;
        break;
      }
      case 'AFECTACION':
        b.situacion = 'AFECTADO';
        b.responsable = '';
        b.afectataria = mov.destino_externo;
        b.afectacion_vence = mov.fecha_retorno;
        break;
      case 'EXTINCION_AFECTACION':
        b.situacion = 'ACTIVO';
        b.afectataria = '';
        b.afectacion_vence = '';
        nuevoEstado();
        break;
      case 'DISPOSICION':
        b.situacion = 'DISPUESTO';
        break;
      case 'TRANSFERENCIA_GR':
        b.origen = 'UE';
        b.fecha_transferencia = mov.fecha;
        break;
      case 'INVENTARIO': {
        const r = (mov.regularizacion || {})[b.codigo] || {};
        ['situacion', 'estado', 'ubicacion'].forEach((k) => { if (r[k]) b[k] = r[k]; });
        if (r.responsable !== undefined) b.responsable = r.responsable;
        break;
      }
      default:
        throw new Error('Tipo no aplicable: ' + mov.tipo);
    }
    return { bien: b, antes, despues: instantanea(b) };
  }

  // ---------------------------------------------------------------
  // Inventario (Título V)
  // ---------------------------------------------------------------
  /** Situaciones que se verifican en el inventario. Los dados de baja solo se verifican (art. 31.2). */
  const SITUACIONES_INVENTARIABLES = ['ACTIVO', 'EN_SALIDA', 'FALTANTE', 'AFECTADO', 'BAJA'];

  /** Compara la verificación con el registro.
   *  verif: codigo -> {encontrado, estado, ubicacion, responsable, uso:'U'|'D', tipo:'F'|'D'} */
  function resultadosInventario(bienes, verif) {
    const res = { conformes: [], faltantes: [], diferencias: [], sinVerificar: [], bajasNoUbicadas: [] };
    bienes.filter((b) => SITUACIONES_INVENTARIABLES.includes(b.situacion)).forEach((b) => {
      const v = verif[b.codigo];
      if (!v) { res.sinVerificar.push(b); return; }
      if (b.situacion === 'BAJA') { // solo verificación (art. 31.2)
        if (v.encontrado) res.conformes.push(b); else res.bajasNoUbicadas.push(b);
        return;
      }
      if (!v.encontrado) {
        // los bienes fuera de la sede con orden o afectados en uso no son faltantes
        if (['EN_SALIDA', 'AFECTADO'].includes(b.situacion)) res.conformes.push(b);
        else res.faltantes.push(b);
        return;
      }
      const cambios = {};
      if (v.estado && v.estado !== b.estado) cambios.estado = v.estado;
      if (v.ubicacion && v.ubicacion !== b.ubicacion) cambios.ubicacion = v.ubicacion;
      if (v.responsable !== undefined && v.responsable !== (b.responsable || '')) cambios.responsable = v.responsable;
      if (b.situacion === 'FALTANTE') cambios.situacion = 'ACTIVO';
      if (Object.keys(cambios).length) res.diferencias.push({ bien: b, cambios });
      else res.conformes.push(b);
    });
    return res;
  }

  function regularizacionInventario(resultados) {
    const reg = {};
    resultados.faltantes.forEach((b) => { reg[b.codigo] = { situacion: 'FALTANTE' }; });
    resultados.diferencias.forEach((d) => { reg[d.bien.codigo] = d.cambios; });
    return reg;
  }

  /** Sobrante: ¿procede saneamiento? (arts. 39 y 43) */
  function evaluarSobrante(s, hoy) {
    if (['RAEE', 'Chatarra'].includes(s.estado)) return { procede: false, texto: 'No se sanea; corresponde un acto de disposición (art. 43).' };
    if (!s.fecha_posesion) return { procede: false, texto: 'Falta acreditar la fecha de inicio de la posesión (art. 39).' };
    const cumple = sumarMeses(s.fecha_posesion, 12) <= (hoy || hoyISO());
    return cumple
      ? { procede: true, texto: 'Cumple 1 año de posesión: iniciar el saneamiento (art. 41).' }
      : { procede: false, texto: `Recién cumple 1 año de posesión el ${sumarMeses(s.fecha_posesion, 12)} (art. 39).` };
  }

  // ---------------------------------------------------------------
  // Indicadores y alertas de plazos
  // ---------------------------------------------------------------
  function indicadores(bienes, movimientos, uit, hoy) {
    const h = hoy || hoyISO();
    const enPatrimonio = bienes.filter((b) => !['DISPUESTO', 'BAJA'].includes(b.situacion));
    const sum = (arr) => arr.reduce((s, b) => s + aNumero(b.valor), 0);
    const contar = (arr, k) => arr.reduce((o, b) => (o[b[k] || '—'] = (o[b[k] || '—'] || 0) + 1, o), {});
    const movsVigentes = (movimientos || []).filter((m) => !m.anulado);
    return {
      total: enPatrimonio.length,
      valor: sum(enPatrimonio),
      porEstado: contar(enPatrimonio, 'estado'),
      porSituacion: contar(bienes, 'situacion'),
      porUbicacion: contar(enPatrimonio, 'ubicacion'),
      sinResponsable: enPatrimonio.filter((b) => b.situacion === 'ACTIVO' && !b.responsable).length,
      sinUbicacion: enPatrimonio.filter((b) => !b.ubicacion || b.ubicacion === 'SIN UBICACION').length,
      sinCodigoInterno: enPatrimonio.filter((b) => !b.codigo_interno).length,
      sinSerie: enPatrimonio.filter((b) => !b.serie || /^(no aplica|sin serie|s\/s|\.+)$/i.test(b.serie)).length,
      sinCuentaContable: enPatrimonio.filter((b) => !b.cuenta_contable).length,
      sinPoliza: enPatrimonio.filter((b) => !b.poliza).length,
      origenNoDeterminado: enPatrimonio.filter((b) => b.origen === 'NO_DETERMINADO').length,
      candidatosBaja: enPatrimonio.filter((b) => ['Malo', 'RAEE', 'Chatarra'].includes(b.estado) && b.situacion === 'ACTIVO').length,
      pendientesDisposicion: bienes.filter((b) => b.situacion === 'BAJA').length,
      faltantes: bienes.filter((b) => b.situacion === 'FALTANTE').length,
      afectados: bienes.filter((b) => b.situacion === 'AFECTADO').length,
      activoFijo: uit ? enPatrimonio.filter((b) => aNumero(b.valor) >= uit / 4).length : 0,
      cuentasOrden: uit ? enPatrimonio.filter((b) => aNumero(b.valor) < uit / 4).length : 0,
      registrosExtemporaneos: movsVigentes.filter((m) => m.registrado && diasHabiles(m.fecha, m.registrado.slice(0, 10)) > 10).length,
      costoMantenimiento: movsVigentes.filter((m) => m.tipo === 'MANTENIMIENTO' && m.fecha.slice(0, 4) === h.slice(0, 4)).reduce((s, m) => s + aNumero(m.costo), 0)
    };
  }

  /** Alertas de cumplimiento de plazos y obligaciones de la Directiva.
   *  Devuelve [{nivel:'bad'|'warn'|'info', texto, ref, enlace, codigos}] */
  function alertasNormativas(bienes, movimientos, inventarios, hoy) {
    const h = hoy || hoyISO();
    const anio = Number(h.slice(0, 4));
    const mes = Number(h.slice(5, 7));
    const al = [];
    const add = (nivel, lista, texto, ref, enlace) => { if (lista.length) al.push({ nivel, texto: texto(lista.length), ref, enlace, codigos: lista.map((b) => b.codigo || b) }); };
    const movs = (movimientos || []).filter((m) => !m.anulado);

    // Salidas con retorno vencido (Anexo N° 04)
    const enSalida = new Set(bienes.filter((b) => b.situacion === 'EN_SALIDA').map((b) => b.codigo));
    const salidas = movs.filter((m) => m.tipo === 'SALIDA' && m.fecha_retorno < h && m.items.some((c) => enSalida.has(c)));
    add('bad', salidas.map((m) => m.numero), (n) => `${n} orden(es) de salida con fecha de retorno vencida`, 'Arts. 28.4 y 87', '#/movimientos?tipo=SALIDA');

    // Baja: disposición en 5 meses (art. 50.1)
    const bajas = bienes.filter((b) => b.situacion === 'BAJA' && b.fecha_baja);
    add('bad', bajas.filter((b) => sumarMeses(b.fecha_baja, 5) < h), (n) => `${n} bienes dados de baja superan los 5 meses sin acto de disposición`, 'Art. 50.1', '#/bienes?situacion=BAJA');
    add('warn', bajas.filter((b) => sumarMeses(b.fecha_baja, 5) >= h && sumarMeses(b.fecha_baja, 4) < h), (n) => `${n} bienes dados de baja vencen su plazo de disposición en menos de 1 mes`, 'Art. 50.1', '#/bienes?situacion=BAJA');

    // Afectación en uso: vencida o por vencer en 15 días hábiles (art. 56.2)
    const afect = bienes.filter((b) => b.situacion === 'AFECTADO' && b.afectacion_vence);
    add('bad', afect.filter((b) => b.afectacion_vence < h), (n) => `${n} bienes con afectación en uso vencida, pendientes de devolución`, 'Arts. 56 y 59', '#/bienes?situacion=AFECTADO');
    add('warn', afect.filter((b) => b.afectacion_vence >= h && diasHabiles(h, b.afectacion_vence) <= 15), (n) => `${n} afectaciones en uso vencen en 15 días hábiles o menos: coordinar la devolución`, 'Art. 56.2', '#/bienes?situacion=AFECTADO');

    // Faltantes pendientes de saneamiento (arts. 44–46)
    add('bad', bienes.filter((b) => b.situacion === 'FALTANTE'), (n) => `${n} bienes faltantes pendientes de saneamiento o baja, con comunicación al OCI`, 'Arts. 44–46', '#/saneamiento');

    // Asignación en uso dentro de 20 días hábiles de incorporado (art. 26.2)
    add('warn', bienes.filter((b) => b.situacion === 'ACTIVO' && !b.responsable && b.fecha_alta && diasHabiles(b.fecha_alta, h) > 20),
      (n) => `${n} bienes incorporados hace más de 20 días hábiles sin asignar en uso`, 'Art. 26.2', '#/bienes?resp=no');

    // Inventario anual (arts. 31 y 36)
    const anuales = (inventarios || []).filter((i) => (i.tipo || 'ANUAL') === 'ANUAL');
    const cerrado = (y) => anuales.some((i) => i.anio === y && i.estado === 'CERRADO');
    if (mes <= 3 && !cerrado(anio - 1)) {
      al.push({ nivel: 'bad', texto: `Inventario ${anio - 1}: no está cerrado. Presentación hasta el 15/03 (Organización) o el 31/03 (Entidad)`, ref: 'Arts. 31.1 y 36.1', enlace: '#/inventario' });
    }
    if (mes >= 10 && !anuales.some((i) => i.anio === anio)) {
      al.push({ nivel: 'warn', texto: `Inventario ${anio}: designar la comisión por resolución y elaborar el plan de inventario (cierre al 31/12)`, ref: 'Arts. 31–33', enlace: '#/inventario' });
    }

    // Candidatos a baja y calidad del registro
    add('warn', bienes.filter((b) => b.situacion === 'ACTIVO' && ['Malo', 'RAEE', 'Chatarra'].includes(b.estado)),
      (n) => `${n} bienes en estado Malo, RAEE o Chatarra: evaluar la baja con informe técnico`, 'Arts. 48–49', '#/bienes?estado=baja');
    add('info', bienes.filter((b) => b.situacion === 'ACTIVO' && !b.responsable),
      (n) => `${n} bienes sin usuario responsable: falta la ficha de asignación en uso`, 'Arts. 26 y 28 · Anexo N° 03', '#/bienes?resp=no');
    add('info', bienes.filter((b) => !['DISPUESTO', 'BAJA'].includes(b.situacion) && (!b.ubicacion || b.ubicacion === 'SIN UBICACION')),
      (n) => `${n} bienes sin ubicación física registrada`, 'Art. 22.1', '#/bienes?ubicacion=SIN%20UBICACION');
    add('info', bienes.filter((b) => b.poliza_vence && b.poliza_vence < h && !['DISPUESTO'].includes(b.situacion)),
      (n) => `${n} bienes con póliza de seguro vencida`, 'Art. 89; 7ª DCF', '#/mantenimiento');
    // Transferencia anual de bienes adquiridos o donados al CLAS (D.S. N° 017-2008-SA, arts. 63.d y 68.d)
    const porTransferir = bienes.filter((b) => b.situacion !== 'DISPUESTO' && ORIGENES_POR_TRANSFERIR.includes(b.origen));
    const anioIngreso = (b) => Number(String(b.fecha_alta || b.fecha_adquisicion || h).slice(0, 4));
    add('warn', porTransferir.filter((b) => anioIngreso(b) < anio),
      (n) => `${n} bienes adquiridos o donados al CLAS en ejercicios anteriores siguen sin transferir al Gobierno Regional`, 'D.S. 017-2008-SA, arts. 63.d y 68.d', '#/nuevo/TRANSFERENCIA_GR');
    add('info', porTransferir.filter((b) => anioIngreso(b) >= anio),
      (n) => `${n} bienes adquiridos o donados al CLAS en ${anio}: transferir al Gobierno Regional al cierre del ejercicio`, 'D.S. 017-2008-SA, arts. 63.d y 68.d', '#/nuevo/TRANSFERENCIA_GR');
    add('info', bienes.filter((b) => !['DISPUESTO', 'BAJA'].includes(b.situacion) && b.origen === 'NO_DETERMINADO'),
      (n) => `${n} bienes sin titularidad registrada (Estado o CLAS pendiente de transferir)`, 'D.S. 017-2008-SA, art. 63.d', '#/normativa');
    const extemp = movs.filter((m) => m.registrado && diasHabiles(m.fecha, m.registrado.slice(0, 10)) > 10 && m.fecha.slice(0, 4) === String(anio));
    add('info', extemp.map((m) => m.numero), (n) => `${n} actos registrados después de 10 días hábiles de ocurridos`, 'Art. 23', '#/movimientos');
    return al;
  }

  const API = {
    ESTADOS_CONSERVACION, SITUACIONES, ORIGENES, ORIGENES_POR_TRANSFERIR, MODALIDADES_ASIGNACION, TIPOS_MANTENIMIENTO,
    CAUSALES_ALTA, CAUSALES_BAJA, MODALIDADES_DISPOSICION, MOTIVOS_SALIDA, CAUSALES_EXTINCION, CAUSALES_POR_TIPO,
    GRUPOS, TIPOS_MOVIMIENTO, ETIQUETAS_CAMPO, CAMPOS_TRAZABLES, SITUACIONES_INVENTARIABLES,
    causalDef, etiqueta, camposObligatorios, limpiar, hoyISO, diasHabiles, sumarMeses, aFechaISO, aNumero,
    validarCodigoPatrimonial, normalizarEstado, filaExcelABien, clasificacionContable, siguienteNumero,
    validarMovimiento, aplicarMovimiento, resultadosInventario, regularizacionInventario, evaluarSobrante,
    indicadores, alertasNormativas
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Core = API;
})(typeof window !== 'undefined' ? window : globalThis);
