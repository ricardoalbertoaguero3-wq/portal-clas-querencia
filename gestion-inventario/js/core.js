/* =====================================================================
 * core.js — Reglas de negocio de gestión de bienes muebles patrimoniales
 * CLAS Agregado La Querencia
 *
 * Marco normativo de referencia (ver README, sección "Normativa"):
 *  - D.Leg. N° 1439, Sistema Nacional de Abastecimiento, y su Reglamento
 *    (D.S. N° 217-2019-EF).
 *  - Directiva N° 0006-2021-EF/54.01 "Directiva para la Gestión de Bienes
 *    Muebles Patrimoniales en el marco del Sistema Nacional de
 *    Abastecimiento" (R.D. N° 0015-2021-EF/54.01).
 *  - D.S. N° 009-2019-MINAM (Régimen especial de gestión de RAEE).
 *
 * Este archivo no depende del navegador: se usa en la app y en las
 * pruebas (node --test).
 * ===================================================================== */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------
  // Catálogos
  // ---------------------------------------------------------------
  const ESTADOS_CONSERVACION = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'RAEE', 'Chatarra'];

  // Situación administrativa del bien (independiente del estado físico)
  const SITUACIONES = {
    ACTIVO: 'Activo (en uso / disponible)',
    EN_SALIDA: 'Fuera de la sede (salida temporal)',
    FALTANTE: 'Faltante (no ubicado en inventario)',
    BAJA: 'Dado de baja (pendiente de disposición)',
    DISPUESTO: 'Dispuesto (salió del patrimonio)'
  };

  const ORIGENES = {
    PROPIO: 'Adquirido por el CLAS',
    AFECTADO: 'Afectado en uso por la Unidad Ejecutora',
    DONACION: 'Recibido en donación',
    TRANSFERENCIA: 'Recibido en transferencia',
    NO_DETERMINADO: 'No determinado (sanear)'
  };

  const CAUSALES_ALTA = [
    'Adquisición (compra)',
    'Donación recibida',
    'Transferencia recibida',
    'Reposición / reembolso',
    'Permuta',
    'Fabricación o elaboración',
    'Sobrante de inventario',
    'Saneamiento',
    'Otra (especificar en motivo)'
  ];

  // Causales de baja — Directiva N° 0006-2021-EF/54.01 (verificar
  // modificatorias vigentes con el Órgano de Control Patrimonial de la UE)
  const CAUSALES_BAJA = [
    'Estado de excedencia',
    'Obsolescencia técnica',
    'Mantenimiento o reparación onerosa',
    'Pérdida, robo o sustracción',
    'Destrucción o siniestro',
    'Reembolso o reposición',
    'Residuos de aparatos eléctricos y electrónicos (RAEE)',
    'Otra (especificar en motivo)'
  ];

  const MODALIDADES_DISPOSICION = [
    'Donación',
    'Transferencia a otra entidad',
    'Compraventa (subasta / venta directa)',
    'Permuta',
    'Destrucción',
    'Entrega de RAEE a operador autorizado'
  ];

  const MOTIVOS_SALIDA = [
    'Mantenimiento / reparación',
    'Préstamo a otro establecimiento',
    'Comisión de servicio / actividad extramural',
    'Evaluación técnica',
    'Otro (especificar)'
  ];

  /* Definición de los tipos de movimiento.
   * desde: situaciones desde las que se permite el acto.
   * requiere: campos obligatorios del movimiento.
   * formato: título del documento imprimible que sustenta el acto. */
  const TIPOS_MOVIMIENTO = {
    ALTA: {
      nombre: 'Alta (incorporación)', prefijo: 'ALT', desde: null,
      requiere: ['causal', 'documento'],
      formato: 'ACTA DE ALTA DE BIENES MUEBLES PATRIMONIALES'
    },
    ASIGNACION: {
      nombre: 'Asignación en uso', prefijo: 'ASG', desde: ['ACTIVO'],
      requiere: ['responsable_destino'],
      formato: 'FORMATO DE ASIGNACIÓN EN USO DE BIENES MUEBLES PATRIMONIALES'
    },
    DEVOLUCION: {
      nombre: 'Devolución / desasignación', prefijo: 'DEV', desde: ['ACTIVO'],
      requiere: ['motivo'],
      formato: 'FORMATO DE DEVOLUCIÓN DE BIENES MUEBLES PATRIMONIALES'
    },
    DESPLAZAMIENTO: {
      nombre: 'Desplazamiento interno', prefijo: 'DSP', desde: ['ACTIVO'],
      requiere: ['ubicacion_destino'],
      formato: 'FORMATO DE DESPLAZAMIENTO INTERNO DE BIENES MUEBLES PATRIMONIALES'
    },
    SALIDA: {
      nombre: 'Salida temporal', prefijo: 'SAL', desde: ['ACTIVO'],
      requiere: ['causal', 'destino_externo', 'fecha_retorno'],
      formato: 'ORDEN DE SALIDA DE BIENES MUEBLES PATRIMONIALES'
    },
    REINGRESO: {
      nombre: 'Reingreso', prefijo: 'REI', desde: ['EN_SALIDA'],
      requiere: [],
      formato: 'ACTA DE REINGRESO DE BIENES MUEBLES PATRIMONIALES'
    },
    CAMBIO_ESTADO: {
      nombre: 'Cambio de estado de conservación', prefijo: 'CEC', desde: ['ACTIVO', 'EN_SALIDA'],
      requiere: ['estado_destino', 'motivo'],
      formato: 'ACTA DE CONSTATACIÓN DE ESTADO DE CONSERVACIÓN'
    },
    BAJA: {
      nombre: 'Baja', prefijo: 'BAJ', desde: ['ACTIVO', 'FALTANTE'],
      requiere: ['causal', 'documento', 'motivo'],
      formato: 'RELACIÓN DE BIENES MUEBLES PATRIMONIALES PROPUESTOS / APROBADOS PARA BAJA'
    },
    DISPOSICION: {
      nombre: 'Disposición', prefijo: 'DIS', desde: ['BAJA'],
      requiere: ['causal', 'documento', 'destino_externo'],
      formato: 'ACTA DE ENTREGA-RECEPCIÓN POR ACTO DE DISPOSICIÓN'
    },
    INVENTARIO: {
      nombre: 'Regularización por inventario', prefijo: 'INV', desde: ['ACTIVO', 'EN_SALIDA', 'FALTANTE'],
      requiere: [],
      formato: 'RESULTADOS DEL INVENTARIO — REGULARIZACIÓN'
    }
  };

  const ETIQUETAS_CAMPO = {
    causal: 'Causal / motivo normativo',
    documento: 'Documento de sustento',
    responsable_destino: 'Responsable que recibe',
    ubicacion_destino: 'Ubicación de destino',
    destino_externo: 'Destino / beneficiario externo',
    fecha_retorno: 'Fecha prevista de retorno',
    estado_destino: 'Nuevo estado de conservación',
    motivo: 'Motivo / sustento'
  };

  // ---------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------
  const limpiar = (v) => (v === null || v === undefined) ? '' : String(v).replace(/\s+/g, ' ').trim();

  function hoyISO(d) {
    const x = d || new Date();
    const z = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}`;
  }

  /** Código patrimonial SBN/SNA: 12 dígitos = 8 de catálogo + 4 correlativo */
  function validarCodigoPatrimonial(codigo) {
    const c = limpiar(codigo);
    if (!/^\d{12}$/.test(c)) return { ok: false, error: 'El código patrimonial debe tener 12 dígitos numéricos.' };
    return { ok: true, catalogo: c.slice(0, 8), correlativo: c.slice(8) };
  }

  /** Normaliza el estado de conservación a un valor del catálogo */
  function normalizarEstado(v) {
    const s = limpiar(v).toLowerCase();
    if (!s) return 'Regular';
    const map = { n: 'Nuevo', b: 'Bueno', r: 'Regular', m: 'Malo', x: 'RAEE' };
    if (map[s]) return map[s];
    const hit = ESTADOS_CONSERVACION.find((e) => e.toLowerCase() === s);
    return hit || 'Regular';
  }

  function aFechaISO(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return hoyISO(v);
    if (typeof v === 'number') { // número de serie de Excel
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

  /** Convierte una fila del Excel institucional (formato INVENTARIO_CLAS_QUERENCIA)
   *  a un registro de bien. Acepta encabezados con mayúsculas o minúsculas. */
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
      cuenta_contable: '',
      observaciones: ''
    };
  }

  /** Clasificación contable referencial: activo (≥ 1/4 UIT) o bien no
   *  depreciable registrado en cuentas de orden (< 1/4 UIT). */
  function clasificacionContable(valor, uit) {
    if (!uit) return '—';
    return aNumero(valor) >= uit / 4 ? 'Activo fijo (≥ 1/4 UIT)' : 'Cuentas de orden (< 1/4 UIT)';
  }

  /** Siguiente número correlativo: PREFIJO-AAAA-NNNN */
  function siguienteNumero(tipo, anio, existentes) {
    const pref = TIPOS_MOVIMIENTO[tipo].prefijo + '-' + anio + '-';
    let max = 0;
    (existentes || []).forEach((n) => {
      if (n && n.startsWith(pref)) max = Math.max(max, parseInt(n.slice(pref.length), 10) || 0);
    });
    return pref + String(max + 1).padStart(4, '0');
  }

  // ---------------------------------------------------------------
  // Validación y aplicación de movimientos
  // ---------------------------------------------------------------
  /** Valida un movimiento contra los bienes actuales.
   *  mov: {tipo, fecha, items:[codigo], ...campos}
   *  bienes: Map/obj codigo -> bien
   *  Devuelve lista de errores (vacía si es válido). */
  function validarMovimiento(mov, bienesPorCodigo) {
    const errores = [];
    const def = TIPOS_MOVIMIENTO[mov.tipo];
    if (!def) return ['Tipo de movimiento no reconocido.'];
    if (!mov.fecha) errores.push('La fecha del movimiento es obligatoria.');
    if (mov.fecha && mov.fecha > hoyISO()) errores.push('La fecha del movimiento no puede ser futura.');
    def.requiere.forEach((c) => {
      if (!limpiar(mov[c])) errores.push(`Falta: ${ETIQUETAS_CAMPO[c] || c}.`);
    });
    if (mov.tipo === 'SALIDA' && mov.fecha_retorno && mov.fecha && mov.fecha_retorno < mov.fecha) {
      errores.push('La fecha de retorno no puede ser anterior a la fecha de salida.');
    }
    if (mov.tipo === 'ALTA') {
      if (!mov.nuevos || !mov.nuevos.length) errores.push('Registre al menos un bien a incorporar.');
      (mov.nuevos || []).forEach((b) => {
        const v = validarCodigoPatrimonial(b.codigo);
        if (!v.ok) errores.push(`${b.codigo || '(sin código)'}: ${v.error}`);
        else if (bienesPorCodigo[b.codigo]) errores.push(`${b.codigo}: el código patrimonial ya existe.`);
        if (!limpiar(b.descripcion)) errores.push(`${b.codigo}: falta la denominación del bien.`);
        if (!(aNumero(b.valor) > 0)) errores.push(`${b.codigo}: el valor de adquisición debe ser mayor a 0.`);
      });
      return errores;
    }
    if (!mov.items || !mov.items.length) errores.push('Seleccione al menos un bien.');
    (mov.items || []).forEach((cod) => {
      const b = bienesPorCodigo[cod];
      if (!b) { errores.push(`${cod}: no existe en el registro.`); return; }
      if (def.desde && !def.desde.includes(b.situacion)) {
        errores.push(`${cod}: situación "${SITUACIONES[b.situacion]}" no permite ${def.nombre.toLowerCase()}.`);
      }
      if (mov.tipo === 'ASIGNACION' && b.responsable && b.responsable === mov.responsable_destino) {
        errores.push(`${cod}: ya está asignado a ese responsable.`);
      }
      if (mov.tipo === 'DEVOLUCION' && !b.responsable) {
        errores.push(`${cod}: no tiene responsable asignado.`);
      }
      if (mov.tipo === 'DESPLAZAMIENTO' && b.ubicacion === mov.ubicacion_destino &&
          (!mov.responsable_destino || mov.responsable_destino === b.responsable)) {
        errores.push(`${cod}: ya se encuentra en la ubicación de destino.`);
      }
      if (mov.tipo === 'CAMBIO_ESTADO' && b.estado === mov.estado_destino) {
        errores.push(`${cod}: ya tiene estado "${b.estado}".`);
      }
    });
    return errores;
  }

  const CAMPOS_TRAZABLES = ['situacion', 'estado', 'ubicacion', 'responsable'];
  const instantanea = (b) => CAMPOS_TRAZABLES.reduce((o, k) => (o[k] = b[k] || '', o), {});

  /** Aplica el movimiento a un bien y devuelve {bien, antes, despues}.
   *  No muta el bien original. */
  function aplicarMovimiento(mov, bien) {
    const b = Object.assign({}, bien);
    const antes = instantanea(b);
    switch (mov.tipo) {
      case 'ASIGNACION':
        b.responsable = mov.responsable_destino;
        if (mov.ubicacion_destino) b.ubicacion = mov.ubicacion_destino;
        break;
      case 'DEVOLUCION':
        b.responsable = '';
        if (mov.ubicacion_destino) b.ubicacion = mov.ubicacion_destino;
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
        if (mov.estado_destino) b.estado = mov.estado_destino;
        break;
      case 'CAMBIO_ESTADO':
        b.estado = mov.estado_destino;
        break;
      case 'BAJA':
        b.situacion = 'BAJA';
        b.responsable = '';
        break;
      case 'DISPOSICION':
        b.situacion = 'DISPUESTO';
        break;
      case 'INVENTARIO': {
        const r = (mov.regularizacion || {})[b.codigo] || {};
        if (r.situacion) b.situacion = r.situacion;
        if (r.estado) b.estado = r.estado;
        if (r.ubicacion) b.ubicacion = r.ubicacion;
        if (r.responsable !== undefined) b.responsable = r.responsable;
        break;
      }
      default:
        throw new Error('Tipo no aplicable: ' + mov.tipo);
    }
    return { bien: b, antes, despues: instantanea(b) };
  }

  // ---------------------------------------------------------------
  // Inventario (toma física)
  // ---------------------------------------------------------------
  /** Compara la toma física con el registro.
   *  verif: codigo -> {encontrado:bool, estado, ubicacion, responsable}
   *  Devuelve {conformes, faltantes, diferencias, sinVerificar} */
  function resultadosInventario(bienes, verif) {
    const res = { conformes: [], faltantes: [], diferencias: [], sinVerificar: [] };
    bienes.filter((b) => ['ACTIVO', 'EN_SALIDA', 'FALTANTE'].includes(b.situacion)).forEach((b) => {
      const v = verif[b.codigo];
      if (!v) { res.sinVerificar.push(b); return; }
      if (!v.encontrado) {
        // un bien en salida temporal sustentada no es faltante
        if (b.situacion === 'EN_SALIDA') res.conformes.push(b);
        else res.faltantes.push(b);
        return;
      }
      const cambios = {};
      if (v.estado && v.estado !== b.estado) cambios.estado = v.estado;
      if (v.ubicacion && v.ubicacion !== b.ubicacion) cambios.ubicacion = v.ubicacion;
      if (v.responsable !== undefined && v.responsable !== b.responsable) cambios.responsable = v.responsable;
      if (b.situacion === 'FALTANTE') cambios.situacion = 'ACTIVO';
      if (Object.keys(cambios).length) res.diferencias.push({ bien: b, cambios });
      else res.conformes.push(b);
    });
    return res;
  }

  /** Construye el mapa de regularización a aplicar al cerrar el inventario */
  function regularizacionInventario(resultados) {
    const reg = {};
    resultados.faltantes.forEach((b) => { reg[b.codigo] = { situacion: 'FALTANTE' }; });
    resultados.diferencias.forEach((d) => { reg[d.bien.codigo] = d.cambios; });
    return reg;
  }

  // ---------------------------------------------------------------
  // Indicadores
  // ---------------------------------------------------------------
  function indicadores(bienes, movimientos, uit, hoy) {
    const h = hoy || hoyISO();
    const vigentes = bienes.filter((b) => !['DISPUESTO'].includes(b.situacion));
    const enPatrimonio = vigentes.filter((b) => b.situacion !== 'BAJA');
    const sum = (arr) => arr.reduce((s, b) => s + aNumero(b.valor), 0);
    const contar = (arr, k) => arr.reduce((o, b) => (o[b[k] || '—'] = (o[b[k] || '—'] || 0) + 1, o), {});
    const enSalida = new Set(bienes.filter((b) => b.situacion === 'EN_SALIDA').map((b) => b.codigo));
    const salidasVencidas = (movimientos || []).filter((m) =>
      m.tipo === 'SALIDA' && !m.anulado && m.fecha_retorno && m.fecha_retorno < h &&
      m.items.some((c) => enSalida.has(c)));
    return {
      total: enPatrimonio.length,
      valor: sum(enPatrimonio),
      porEstado: contar(enPatrimonio, 'estado'),
      porSituacion: contar(bienes, 'situacion'),
      porUbicacion: contar(enPatrimonio, 'ubicacion'),
      sinResponsable: enPatrimonio.filter((b) => !b.responsable).length,
      sinUbicacion: enPatrimonio.filter((b) => !b.ubicacion || b.ubicacion === 'SIN UBICACION').length,
      sinCodigoInterno: enPatrimonio.filter((b) => !b.codigo_interno).length,
      sinSerie: enPatrimonio.filter((b) => !b.serie || /^(no aplica|sin serie|s\/s|\.+)$/i.test(b.serie)).length,
      origenNoDeterminado: enPatrimonio.filter((b) => b.origen === 'NO_DETERMINADO').length,
      candidatosBaja: enPatrimonio.filter((b) => ['Malo', 'RAEE', 'Chatarra'].includes(b.estado) && b.situacion === 'ACTIVO').length,
      pendientesDisposicion: bienes.filter((b) => b.situacion === 'BAJA').length,
      faltantes: bienes.filter((b) => b.situacion === 'FALTANTE').length,
      activoFijo: uit ? enPatrimonio.filter((b) => aNumero(b.valor) >= uit / 4).length : 0,
      cuentasOrden: uit ? enPatrimonio.filter((b) => aNumero(b.valor) < uit / 4).length : 0,
      salidasVencidas
    };
  }

  const API = {
    ESTADOS_CONSERVACION, SITUACIONES, ORIGENES, CAUSALES_ALTA, CAUSALES_BAJA,
    MODALIDADES_DISPOSICION, MOTIVOS_SALIDA, TIPOS_MOVIMIENTO, ETIQUETAS_CAMPO,
    limpiar, hoyISO, aFechaISO, aNumero, validarCodigoPatrimonial, normalizarEstado,
    filaExcelABien, clasificacionContable, siguienteNumero, validarMovimiento,
    aplicarMovimiento, resultadosInventario, regularizacionInventario, indicadores
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Core = API;
})(typeof window !== 'undefined' ? window : globalThis);
