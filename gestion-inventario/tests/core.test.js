// Pruebas de reglas de negocio (Directiva N° 0006-2021-EF/54.01): node --test tests/core.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/core.js');
const N = require('../js/normativa.js');
const semilla = require('../data/inventario-2025.json');

const bien = (o) => Object.assign({ codigo: '602250000131', descripcion: 'INFANTOMETRO', estado: 'Bueno', situacion: 'ACTIVO', ubicacion: 'JEFATURA', responsable: '', valor: 500 }, o);
const mapa = (...bs) => Object.fromEntries(bs.map((b) => [b.codigo, b]));
const HOY = '2026-10-12';
const errores = (mov, ...bs) => C.validarMovimiento(Object.assign({ fecha: HOY }, mov), mapa(...bs), HOY);

test('código patrimonial de 12 dígitos (art. 20.2)', () => {
  assert.ok(C.validarCodigoPatrimonial('532292840004').ok);
  assert.strictEqual(C.validarCodigoPatrimonial('532292840004').catalogo, '53229284');
  assert.ok(!C.validarCodigoPatrimonial('53229284').ok);
});

test('la carga del inventario 2025 produce bienes válidos', () => {
  const bienes = semilla.map(C.filaExcelABien);
  assert.strictEqual(bienes.length, 537);
  assert.ok(bienes.every((b) => C.validarCodigoPatrimonial(b.codigo).ok));
  assert.strictEqual(new Set(bienes.map((b) => b.codigo)).size, 537, 'sin códigos duplicados (art. 20.3)');
  assert.ok(bienes.every((b) => C.ESTADOS_CONSERVACION.includes(b.estado)));
  assert.strictEqual(Math.round(bienes.reduce((s, b) => s + b.valor, 0) * 100) / 100, 671562.58);
});

test('días hábiles y meses', () => {
  assert.strictEqual(C.diasHabiles('2026-10-09', '2026-10-12'), 1, 'viernes → lunes = 1 día hábil');
  assert.strictEqual(C.diasHabiles('2026-10-12', '2026-10-26'), 10);
  assert.strictEqual(C.sumarMeses('2026-05-15', 5), '2026-10-15');
});

test('las causales de alta y baja son las de los arts. 16.1 y 48.1', () => {
  const alta = C.CAUSALES_ALTA.map((c) => c.nombre);
  ['Aceptación de donación', 'Reposición', 'Fabricación', 'Permuta', 'Transferencia', 'Disposición legal', 'Resolución judicial o laudo arbitral firme',
    'Saneamiento administrativo de bienes muebles sobrantes'].forEach((x) => assert.ok(alta.includes(x), x));
  const baja = C.CAUSALES_BAJA.map((c) => c.nombre);
  ['Daño', 'Ejecución de garantía', 'Estado de excedencia', 'Estado de chatarra', 'Falta de idoneidad del bien', 'Mantenimiento o reparación onerosa',
    'Obsolescencia técnica', 'RAEE', 'Saneamiento administrativo de bienes muebles patrimoniales faltantes', 'Sustracción', 'Transformación'].forEach((x) => assert.ok(baja.includes(x), x));
  assert.deepStrictEqual(C.MODALIDADES_DISPOSICION.slice(0, 4).map((c) => c.nombre), ['Transferencia', 'Donación', 'Subasta pública', 'Permuta'], 'art. 61');
});

test('alta: donación exige resolución, informe técnico y acta; compra no', () => {
  const nuevos = [{ codigo: '112263860999', descripcion: 'REFRIGERADORA', valor: 900 }];
  const e = errores({ tipo: 'ALTA', causal: 'Aceptación de donación', documento: 'Carta del donante', nuevos });
  assert.ok(e.some((x) => x.includes('resolución')));
  assert.ok(e.some((x) => x.includes('Informe Técnico')));
  assert.ok(e.some((x) => x.includes('entrega')));
  assert.deepStrictEqual(errores({ tipo: 'ALTA', causal: 'Adquisición por compra (registro con PECOSA / NEA)', documento: 'PECOSA 12', nuevos }), []);
  const b = bien();
  assert.ok(errores({ tipo: 'ALTA', causal: 'Fabricación', documento: 'Informe', nuevos: [{ codigo: b.codigo, descripcion: 'X', valor: 1 }] }, b).some((x) => x.includes('art. 20.3')));
});

test('asignación exige usuario y modalidad (arts. 27–28)', () => {
  const b = bien();
  assert.ok(errores({ tipo: 'ASIGNACION', items: [b.codigo] }, b).some((x) => x.includes('Usuario')));
  const mov = { tipo: 'ASIGNACION', fecha: HOY, items: [b.codigo], responsable_destino: 'P1', modalidad: C.MODALIDADES_ASIGNACION[0] };
  assert.deepStrictEqual(errores(mov, b), []);
  const r = C.aplicarMovimiento(mov, b);
  assert.strictEqual(r.bien.responsable, 'P1');
  assert.strictEqual(b.responsable, '', 'no muta el original');
});

test('salida (Anexo N° 04): motivo, autorización, responsable, destino y retorno; mantenimiento exige tipo', () => {
  const b = bien();
  const sal = { tipo: 'SALIDA', items: [b.codigo], causal: 'Mantenimiento', documento: 'Memo 1', responsable_traslado: 'Juan', destino_externo: 'Taller', fecha_retorno: '2026-10-20' };
  assert.ok(errores(sal, b).some((x) => x.includes('Tipo de mantenimiento')));
  sal.tipo_mantenimiento = 'Correctivo';
  assert.deepStrictEqual(errores(sal, b), []);
  assert.ok(errores(Object.assign({}, sal, { fecha_retorno: HOY }), b).some((x) => x.includes('posterior')));
  const fuera = C.aplicarMovimiento(sal, b).bien;
  assert.strictEqual(fuera.situacion, 'EN_SALIDA');
  const rei = C.aplicarMovimiento({ tipo: 'REINGRESO', estado_destino: 'Regular' }, fuera).bien;
  assert.strictEqual(rei.situacion, 'ACTIVO');
  assert.strictEqual(rei.estado, 'Regular');
});

test('baja (arts. 48–49): informe técnico y resolución; causal exige estado; sustracción exige denuncia', () => {
  const b = bien({ estado: 'Malo', responsable: 'P1' });
  const e = errores({ tipo: 'BAJA', items: [b.codigo] }, b);
  ['Causal', 'Informe Técnico', 'resolución', 'Sustento'].forEach((t) => assert.ok(e.some((x) => x.includes(t)), t));
  const base = { tipo: 'BAJA', items: [b.codigo], informe_tecnico: 'IT 01', resolucion: 'RD 05', motivo: 'Evaluación' };
  assert.ok(errores(Object.assign({ causal: 'RAEE' }, base), b).some((x) => x.includes('"RAEE"')), 'el bien debe estar calificado RAEE');
  assert.ok(errores(Object.assign({ causal: 'Sustracción' }, base), b).some((x) => x.includes('denuncia')));
  assert.ok(errores(Object.assign({ causal: 'Saneamiento administrativo de bienes muebles patrimoniales faltantes' }, base), b).some((x) => x.includes('solo procede')));
  const mov = Object.assign({ causal: 'Mantenimiento o reparación onerosa' }, base);
  assert.deepStrictEqual(errores(mov, b), []);
  const baja = C.aplicarMovimiento(Object.assign({ fecha: HOY }, mov), b).bien;
  assert.strictEqual(baja.situacion, 'BAJA');
  assert.strictEqual(baja.responsable, '', 'queda en custodia de la OCP (art. 50.2)');
  assert.strictEqual(baja.fecha_baja, HOY);
});

test('faltantes: solo baja por saneamiento o sustracción; sin acto de disposición (art. 60.3)', () => {
  const f = bien({ situacion: 'FALTANTE' });
  const base = { tipo: 'BAJA', items: [f.codigo], informe_tecnico: 'IT', resolucion: 'RD', motivo: 'x' };
  assert.ok(errores(Object.assign({ causal: 'Daño' }, base), f).some((x) => x.includes('faltante')));
  const mov = Object.assign({ causal: 'Saneamiento administrativo de bienes muebles patrimoniales faltantes', fecha: HOY }, base);
  assert.deepStrictEqual(errores(mov, f), []);
  assert.strictEqual(C.aplicarMovimiento(mov, f).bien.situacion, 'DISPUESTO');
});

test('disposición solo desde baja; RAEE no se elimina (8ª DCF); subasta exige tasación', () => {
  const activo = bien();
  const dis = { tipo: 'DISPOSICION', items: [activo.codigo], causal: 'Donación', informe_tecnico: 'IT', resolucion: 'RD', destino_externo: 'IE 20' };
  assert.ok(errores(dis, activo).some((x) => x.includes('no permite')));
  const raee = bien({ situacion: 'BAJA', estado: 'RAEE' });
  assert.ok(errores(Object.assign({}, dis, { causal: 'Eliminación o destrucción (chatarra)' }), raee).some((x) => x.includes('RAEE no pueden ser eliminados')));
  assert.ok(errores(Object.assign({}, dis, { causal: 'Subasta pública' }), raee).some((x) => x.includes('tasación')));
  assert.deepStrictEqual(errores(Object.assign({}, dis, { causal: 'Entrega de RAEE a operador autorizado' }), raee), []);
  assert.strictEqual(C.aplicarMovimiento(dis, raee).bien.situacion, 'DISPUESTO');
});

test('afectación en uso: máximo 1 año (art. 56.1) y extinción', () => {
  const b = bien();
  const af = { tipo: 'AFECTACION', items: [b.codigo], destino_externo: 'Red de Salud', informe_tecnico: 'IT', motivo: 'Campaña', fecha_retorno: '2027-12-31' };
  assert.ok(errores(af, b).some((x) => x.includes('art. 56.1')));
  af.fecha_retorno = '2027-06-30';
  assert.deepStrictEqual(errores(af, b), []);
  const afectado = C.aplicarMovimiento(af, b).bien;
  assert.strictEqual(afectado.situacion, 'AFECTADO');
  const ext = C.aplicarMovimiento({ tipo: 'EXTINCION_AFECTACION', causal: 'Vencimiento del plazo' }, afectado).bien;
  assert.strictEqual(ext.situacion, 'ACTIVO');
  assert.strictEqual(ext.afectataria, '');
});

test('correlativo por tipo y año', () => {
  assert.strictEqual(C.siguienteNumero('ASIGNACION', '2026', ['ASG-2026-0007', 'ASG-2025-0010']), 'ASG-2026-0008');
});

test('fecha futura rechazada', () => {
  const b = bien();
  assert.ok(errores({ tipo: 'CAMBIO_ESTADO', fecha: '2999-01-01', items: [b.codigo], estado_destino: 'Malo', motivo: 'x' }, b).some((x) => x.includes('futura')));
});

test('inventario: faltantes, diferencias, bajas solo verificadas (art. 31.2) y afectados', () => {
  const a = bien({ codigo: '000000000001' });
  const b = bien({ codigo: '000000000002' });
  const c = bien({ codigo: '000000000003' });
  const d = bien({ codigo: '000000000004', situacion: 'AFECTADO' });
  const e = bien({ codigo: '000000000005', situacion: 'BAJA' });
  const f = bien({ codigo: '000000000006' });
  const r = C.resultadosInventario([a, b, c, d, e, f], {
    [a.codigo]: { encontrado: true, estado: 'Bueno', ubicacion: 'JEFATURA', responsable: '' },
    [b.codigo]: { encontrado: true, estado: 'Malo', ubicacion: 'TOPICO', responsable: '' },
    [c.codigo]: { encontrado: false },
    [d.codigo]: { encontrado: false },
    [e.codigo]: { encontrado: false }
  });
  assert.strictEqual(r.conformes.length, 2);
  assert.strictEqual(r.diferencias.length, 1);
  assert.strictEqual(r.faltantes.length, 1);
  assert.strictEqual(r.bajasNoUbicadas.length, 1);
  assert.strictEqual(r.sinVerificar.length, 1);
  const reg = C.regularizacionInventario(r);
  assert.deepStrictEqual(reg[b.codigo], { estado: 'Malo', ubicacion: 'TOPICO' });
  assert.strictEqual(reg[e.codigo], undefined, 'la baja no se regulariza');
  assert.strictEqual(C.aplicarMovimiento({ tipo: 'INVENTARIO', regularizacion: reg }, c).bien.situacion, 'FALTANTE');
});

test('sobrantes: 1 año de posesión (art. 39) y excepción RAEE/chatarra (art. 43)', () => {
  assert.ok(C.evaluarSobrante({ estado: 'Bueno', fecha_posesion: '2025-01-01' }, HOY).procede);
  assert.ok(!C.evaluarSobrante({ estado: 'Bueno', fecha_posesion: '2026-06-01' }, HOY).procede);
  assert.ok(C.evaluarSobrante({ estado: 'RAEE', fecha_posesion: '2020-01-01' }, HOY).texto.includes('art. 43'));
});

test('alertas de plazos de la Directiva', () => {
  const bienes = [
    bien({ codigo: '1', situacion: 'BAJA', fecha_baja: '2026-03-01' }),            // > 5 meses (art. 50.1)
    bien({ codigo: '2', situacion: 'ACTIVO', fecha_alta: '2026-08-01' }),           // > 20 días hábiles sin asignar (art. 26.2)
    bien({ codigo: '3', situacion: 'AFECTADO', afectacion_vence: '2026-10-20' }),   // vence en ≤ 15 días hábiles (art. 56.2)
    bien({ codigo: '4', situacion: 'FALTANTE' })
  ];
  const al = C.alertasNormativas(bienes, [], [], HOY);
  const refs = al.map((a) => a.ref);
  ['Art. 50.1', 'Art. 26.2', 'Art. 56.2', 'Arts. 44–46', 'Arts. 31–33'].forEach((r) => assert.ok(refs.includes(r), r));
  const enero = C.alertasNormativas([], [], [], '2027-02-10');
  assert.ok(enero.some((a) => a.ref === 'Arts. 31.1 y 36.1'), 'inventario del año anterior pendiente');
});

test('indicadores sobre el inventario 2025', () => {
  const k = C.indicadores(semilla.map(C.filaExcelABien), [], 5350);
  assert.strictEqual(k.total, 537);
  assert.strictEqual(k.activoFijo + k.cuentasOrden, 537);
  assert.strictEqual(k.sinUbicacion, 49);
  assert.strictEqual(k.candidatosBaja, 76);
});

test('cada acto tiene base legal y grupo; la matriz normativa cubre los Títulos', () => {
  Object.entries(C.TIPOS_MOVIMIENTO).forEach(([k, d]) => {
    assert.ok(d.base, k);
    d.requiere.forEach((c) => assert.ok(d.campos.includes(c), `${k}.${c}`));
  });
  assert.ok(N.MATRIZ.length >= 15);
  assert.ok(N.informeSustento({ entidad: 'X', establecimiento: 'Y' }).recomendaciones.length >= 3);
});

test('cogestión CLAS: transferencia al Gobierno Regional (D.S. 017-2008-SA, arts. 63.d y 68.d)', () => {
  const propio = bien({ codigo: '111111111111', origen: 'CLAS' });
  const estado = bien({ codigo: '222222222222', origen: 'UE' });
  const mov = { tipo: 'TRANSFERENCIA_GR', items: [propio.codigo], documento: 'Acta 01-2026', destino_externo: 'DIRESA Lima' };
  assert.deepStrictEqual(errores(mov, propio), []);
  assert.ok(errores(Object.assign({}, mov, { items: [estado.codigo] }), estado).some((x) => x.includes('pendiente de transferencia')));
  const r = C.aplicarMovimiento(Object.assign({ fecha: HOY }, mov), propio);
  assert.strictEqual(r.bien.origen, 'UE');
  assert.strictEqual(r.bien.situacion, 'ACTIVO', 'el bien sigue en uso en el establecimiento');
  assert.strictEqual(r.antes.origen, 'CLAS', 'la anulación puede revertir la titularidad');
  const al = C.alertasNormativas([bien({ codigo: '3', origen: 'DONACION', fecha_alta: '2025-06-01' }), bien({ codigo: '4', origen: 'CLAS', fecha_alta: '2026-06-01' })], [], [], HOY);
  assert.ok(al.some((a) => a.nivel === 'warn' && a.ref.includes('63.d')), 'ejercicio anterior sin transferir');
  assert.ok(al.some((a) => a.nivel === 'info' && a.ref.includes('63.d') && a.texto.includes('2026')), 'ejercicio en curso');
});

test('el sustento legal incorpora el Reglamento de la Ley N° 29124', () => {
  const arts = N.REGLAMENTO_CLAS.map((r) => r[0]);
  ['Art. 7', 'Art. 43.f', 'Art. 49.e', 'Art. 63.d', 'Art. 68.d', 'Art. 81.d', 'Arts. 107–108'].forEach((a) => assert.ok(arts.includes(a), a));
  assert.ok(N.BASE_LEGAL.some((b) => b[0].includes('017-2008-SA')));
  assert.ok(N.informeSustento({ entidad: 'X', establecimiento: 'Y' }).analisis.some((p) => p.includes('art. 43.f')));
});

test('operaciones compartidas navegador/servidor: registro, anulación, corrección y cierre', () => {
  const b1 = bien({ codigo: '700000000001' });
  const b2 = bien({ codigo: '700000000002' });
  const ctx = { bienesPorCodigo: mapa(b1, b2), numeros: ['ASG-2026-0004'], usuario: 'ocp', ahora: '2026-10-12T10:00:00Z', hoy: HOY };
  // registro: valida, numera y devuelve los bienes actualizados sin mutar los originales
  const p = C.prepararRegistro({ tipo: 'ASIGNACION', fecha: HOY, items: [b1.codigo], responsable_destino: 'P1', modalidad: C.MODALIDADES_ASIGNACION[0] }, ctx);
  assert.strictEqual(p.mov.numero, 'ASG-2026-0005');
  assert.strictEqual(p.bienes[0].responsable, 'P1');
  assert.strictEqual(b1.responsable, '');
  assert.ok(C.prepararRegistro({ tipo: 'ASIGNACION', fecha: HOY, items: [b1.codigo] }, ctx).errores.length);
  const dup = C.prepararRegistro({ tipo: 'ALTA', fecha: HOY, causal: 'Fabricación', documento: 'Inf', nuevos: [{ codigo: '700000000009', descripcion: 'a', valor: 1 }, { codigo: '700000000009', descripcion: 'b', valor: 1 }] }, ctx);
  assert.ok(dup.errores[0].includes('repetido'));
  // anulación: revierte; bloqueada si hubo actos posteriores; el alta exige resolución
  const asignado = p.bienes[0];
  const an = C.prepararAnulacion(p.mov, mapa(asignado), { usuario: 'admin', motivo: 'error', hoy: HOY });
  assert.strictEqual(an.bienes[0].valor.responsable, '');
  assert.ok(an.mov.anulado);
  const movido = Object.assign({}, asignado, { ubicacion: 'OTRA' });
  assert.ok(C.prepararAnulacion(p.mov, mapa(movido), { usuario: 'admin', motivo: 'error' }).bloqueados.length);
  const alta = C.prepararRegistro({ tipo: 'ALTA', fecha: HOY, causal: 'Fabricación', documento: 'Inf', nuevos: [{ codigo: '700000000009', descripcion: 'mesa', valor: 10 }] }, ctx);
  assert.ok(C.prepararAnulacion(alta.mov, mapa(alta.bienes[0]), { motivo: 'error' }).errores[0].includes('24.2'));
  // corrección: el valor exige resolución (art. 25)
  assert.ok(C.prepararCorreccion(b1, { valor: 999 }, { motivo: 'x' }).errores[0].includes('art. 25'));
  assert.strictEqual(C.prepararCorreccion(b1, { valor: 999, marca: 'X' }, { motivo: 'x', resolucion: 'RD 1' }).bien.valor, 999);
  // cierre de inventario
  const inv = { id: 'INVENT-2026-01', estado: 'ABIERTO', resolucion: 'RD', fecha_corte: '2026-12-31', verif: { [b1.codigo]: { encontrado: false }, [b2.codigo]: { encontrado: true, estado: 'Bueno', ubicacion: 'JEFATURA', responsable: '' } } };
  const ci = C.prepararCierreInventario(inv, [b1, b2], { hoy: HOY });
  assert.deepStrictEqual(ci.resultados.faltantes, [b1.codigo]);
  assert.deepStrictEqual(ci.mov.items, [b1.codigo]);
  assert.ok(C.prepararCierreInventario(Object.assign({}, inv, { estado: 'CERRADO' }), [], {}).errores);
  // carga inicial: omite duplicados y crea ubicaciones nuevas
  const carga = C.prepararCargaInicial(semilla.slice(0, 3), [semilla[0].codigo_patrimonial], [], { fuente: 'x' });
  assert.strictEqual(carga.bienes.length, 2); assert.strictEqual(carga.omitidos, 1);
});
