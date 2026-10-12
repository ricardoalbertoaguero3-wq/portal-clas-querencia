// Pruebas de reglas de negocio: node --test gestion-inventario/tests
const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/core.js');
const semilla = require('../data/inventario-2025.json');

const bien = (o) => Object.assign({ codigo: '602250000131', descripcion: 'INFANTOMETRO', estado: 'Bueno', situacion: 'ACTIVO', ubicacion: 'JEFATURA', responsable: '', valor: 500 }, o);
const mapa = (...bs) => Object.fromEntries(bs.map((b) => [b.codigo, b]));
const HOY = C.hoyISO();

test('código patrimonial de 12 dígitos', () => {
  assert.ok(C.validarCodigoPatrimonial('532292840004').ok);
  assert.strictEqual(C.validarCodigoPatrimonial('532292840004').catalogo, '53229284');
  assert.ok(!C.validarCodigoPatrimonial('53229284').ok);
  assert.ok(!C.validarCodigoPatrimonial('5322928400AB').ok);
});

test('la carga inicial del inventario 2025 produce bienes válidos', () => {
  const bienes = semilla.map(C.filaExcelABien);
  assert.strictEqual(bienes.length, 537);
  assert.ok(bienes.every((b) => C.validarCodigoPatrimonial(b.codigo).ok));
  assert.strictEqual(new Set(bienes.map((b) => b.codigo)).size, 537, 'sin códigos duplicados');
  assert.ok(bienes.every((b) => C.ESTADOS_CONSERVACION.includes(b.estado)));
  assert.ok(bienes.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.fecha_adquisicion)));
  const total = bienes.reduce((s, b) => s + b.valor, 0);
  assert.strictEqual(Math.round(total * 100) / 100, 671562.58);
  assert.strictEqual(bienes.find((b) => b.codigo === '532292840004').nro_orden, '', '9998 = sin orden');
});

test('fechas desde Excel', () => {
  assert.strictEqual(C.aFechaISO('11/03/2026'), '2026-03-11');
  assert.strictEqual(C.aFechaISO(45000), '2023-03-15');
  assert.strictEqual(C.aFechaISO(''), null);
});

test('correlativo por tipo y año', () => {
  assert.strictEqual(C.siguienteNumero('ASIGNACION', '2026', []), 'ASG-2026-0001');
  assert.strictEqual(C.siguienteNumero('ASIGNACION', '2026', ['ASG-2026-0007', 'ASG-2025-0010', 'BAJ-2026-0020']), 'ASG-2026-0008');
});

test('asignación exige responsable y cambia custodia', () => {
  const b = bien();
  assert.ok(C.validarMovimiento({ tipo: 'ASIGNACION', fecha: HOY, items: [b.codigo] }, mapa(b)).some((e) => e.includes('Responsable')));
  const mov = { tipo: 'ASIGNACION', fecha: HOY, items: [b.codigo], responsable_destino: 'P1' };
  assert.deepStrictEqual(C.validarMovimiento(mov, mapa(b)), []);
  const r = C.aplicarMovimiento(mov, b);
  assert.strictEqual(r.bien.responsable, 'P1');
  assert.strictEqual(r.antes.responsable, '');
  assert.strictEqual(b.responsable, '', 'no muta el original');
});

test('salida y reingreso', () => {
  const b = bien();
  const sal = { tipo: 'SALIDA', fecha: HOY, items: [b.codigo], causal: 'Mantenimiento / reparación', destino_externo: 'Taller', fecha_retorno: '2000-01-01' };
  assert.ok(C.validarMovimiento(sal, mapa(b)).some((e) => e.includes('retorno')));
  sal.fecha_retorno = HOY;
  assert.deepStrictEqual(C.validarMovimiento(sal, mapa(b)), []);
  const fuera = C.aplicarMovimiento(sal, b).bien;
  assert.strictEqual(fuera.situacion, 'EN_SALIDA');
  // un bien fuera no puede asignarse ni salir de nuevo
  assert.ok(C.validarMovimiento(Object.assign({}, sal), mapa(fuera)).length > 0);
  const rei = C.aplicarMovimiento({ tipo: 'REINGRESO', estado_destino: 'Regular' }, fuera).bien;
  assert.strictEqual(rei.situacion, 'ACTIVO');
  assert.strictEqual(rei.estado, 'Regular');
});

test('baja requiere causal, resolución y motivo; disposición solo desde baja', () => {
  const b = bien({ estado: 'Malo', responsable: 'P1' });
  assert.strictEqual(C.validarMovimiento({ tipo: 'BAJA', fecha: HOY, items: [b.codigo] }, mapa(b)).length, 3);
  const dis = { tipo: 'DISPOSICION', fecha: HOY, items: [b.codigo], causal: 'Donación', documento: 'RD 1', destino_externo: 'IE 20' };
  assert.ok(C.validarMovimiento(dis, mapa(b)).some((e) => e.includes('no permite')));
  const baja = C.aplicarMovimiento({ tipo: 'BAJA' }, b).bien;
  assert.strictEqual(baja.situacion, 'BAJA');
  assert.strictEqual(baja.responsable, '', 'la baja libera la custodia');
  assert.deepStrictEqual(C.validarMovimiento(dis, mapa(baja)), []);
  assert.strictEqual(C.aplicarMovimiento(dis, baja).bien.situacion, 'DISPUESTO');
});

test('alta valida código, duplicados y valor', () => {
  const b = bien();
  const e = C.validarMovimiento({ tipo: 'ALTA', fecha: HOY, causal: 'Adquisición (compra)', documento: 'OC 1',
    nuevos: [{ codigo: b.codigo, descripcion: 'X', valor: 10 }, { codigo: '123', descripcion: 'Y', valor: 0 }] }, mapa(b));
  assert.ok(e.some((x) => x.includes('ya existe')));
  assert.ok(e.some((x) => x.includes('12 dígitos')));
  assert.ok(e.some((x) => x.includes('mayor a 0')));
});

test('fecha futura rechazada', () => {
  const b = bien();
  assert.ok(C.validarMovimiento({ tipo: 'CAMBIO_ESTADO', fecha: '2999-01-01', items: [b.codigo], estado_destino: 'Malo', motivo: 'x' }, mapa(b))
    .some((x) => x.includes('futura')));
});

test('inventario: conformes, diferencias, faltantes y regularización', () => {
  const a = bien({ codigo: '000000000001' });
  const b = bien({ codigo: '000000000002' });
  const c = bien({ codigo: '000000000003' });
  const d = bien({ codigo: '000000000004', situacion: 'EN_SALIDA' });
  const e = bien({ codigo: '000000000005' });
  const r = C.resultadosInventario([a, b, c, d, e], {
    [a.codigo]: { encontrado: true, estado: 'Bueno', ubicacion: 'JEFATURA', responsable: '' },
    [b.codigo]: { encontrado: true, estado: 'Malo', ubicacion: 'TOPICO', responsable: '' },
    [c.codigo]: { encontrado: false },
    [d.codigo]: { encontrado: false }
  });
  assert.strictEqual(r.conformes.length, 2, 'el bien en salida no es faltante');
  assert.strictEqual(r.diferencias.length, 1);
  assert.strictEqual(r.faltantes.length, 1);
  assert.strictEqual(r.sinVerificar.length, 1);
  const reg = C.regularizacionInventario(r);
  assert.deepStrictEqual(reg[b.codigo], { estado: 'Malo', ubicacion: 'TOPICO' });
  assert.strictEqual(C.aplicarMovimiento({ tipo: 'INVENTARIO', regularizacion: reg }, c).bien.situacion, 'FALTANTE');
});

test('indicadores y clasificación contable', () => {
  const bienes = semilla.map(C.filaExcelABien);
  const k = C.indicadores(bienes, [], 5350);
  assert.strictEqual(k.total, 537);
  assert.strictEqual(k.activoFijo + k.cuentasOrden, 537);
  assert.strictEqual(k.sinResponsable, 537);
  assert.strictEqual(k.sinUbicacion, 49);
  assert.strictEqual(k.candidatosBaja, 76);
  assert.strictEqual(C.clasificacionContable(1337.5, 5350), 'Activo fijo (≥ 1/4 UIT)');
  assert.strictEqual(C.clasificacionContable(1337.49, 5350), 'Cuentas de orden (< 1/4 UIT)');
});
