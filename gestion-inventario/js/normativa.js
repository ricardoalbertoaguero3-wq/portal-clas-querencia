/* =====================================================================
 * normativa.js — Sustento legal del aplicativo y matriz de trazabilidad
 * módulo ↔ artículo ↔ anexo de la Directiva N° 0006-2021-EF/54.01
 * (R.D. N° 0015-2021-EF/54.01, publicada en El Peruano el 26/12/2021).
 * Archivo de datos: lo usan la vista "Marco normativo" y el informe imprimible.
 * ===================================================================== */
(function (root) {
  'use strict';

  const DIRECTIVA = 'Directiva N° 0006-2021-EF/54.01, "Directiva para la gestión de bienes muebles patrimoniales en el marco del Sistema Nacional de Abastecimiento", aprobada por R.D. N° 0015-2021-EF/54.01';

  const BASE_LEGAL = [
    ['Decreto Legislativo N° 1439, Decreto Legislativo del Sistema Nacional de Abastecimiento', 'Crea el SNA; la DGA-MEF es el ente rector. La administración de bienes (muebles e inmuebles) es componente del SNA (art. 11).'],
    ['Decreto Supremo N° 217-2019-EF, Reglamento del D.Leg. N° 1439', 'Define bien mueble (art. 4, num. 2) y regula el componente de administración de bienes.'],
    [DIRECTIVA, 'Norma operativa que el aplicativo implementa: actos, procedimientos, plazos y formatos (Anexos N° 01 al 10).'],
    ['Directiva N° 001-2020-EF/54.01, "Procedimientos para la gestión de bienes muebles calificados como RAEE"', 'Remitida por los arts. 43 y 49.2 de la Directiva para la baja y la disposición de RAEE.'],
    ['Decreto Supremo N° 009-2019-MINAM, Régimen especial de gestión y manejo de RAEE', 'Base legal h) de la Directiva. Los RAEE no pueden eliminarse (8ª Disp. Complementaria Final).'],
    ['Decreto Legislativo N° 1278, Ley de Gestión Integral de Residuos Sólidos', 'Eliminación de bienes dados de baja en estado de chatarra (8ª Disp. Complementaria Final).'],
    ['Decreto Legislativo N° 1438, Sistema Nacional de Contabilidad', 'Clasificación activo fijo / bien no depreciable (art. 5.c) y conciliación patrimonio-contable (art. 35.6.b).'],
    ['Ley N° 27995 y su Reglamento', 'Donación de bienes dados de baja por excedencia a centros educativos de regiones de extrema pobreza (art. 60.2).'],
    ['Ley N° 30036, Ley que regula el Teletrabajo, y D.S. N° 017-2015-TR', 'Asignación en uso para teletrabajo (art. 29).'],
    ['R.M. N° 172-2016-VIVIENDA, Reglamento Nacional de Tasaciones', 'Valorización comercial (art. 92), vigencia de 5 meses.'],
    ['Ley N° 29124, Ley que establece la cogestión y participación ciudadana para el primer nivel de atención en los establecimientos de salud del MINSA y de las regiones, y su Reglamento (D.S. N° 017-2008-SA)', 'Marco de la cogestión CLAS: administración del establecimiento bajo convenio con el Gobierno Regional.'],
    ['Ley N° 28716, Ley de Control Interno de las Entidades del Estado', 'El control interno comprende cuidar y resguardar los bienes del Estado frente a pérdida, deterioro o uso indebido.'],
    ['Decreto Legislativo N° 1412, Ley de Gobierno Digital', 'Habilita el uso de herramientas digitales para la gestión interna.'],
    ['Ley N° 29733, Ley de Protección de Datos Personales', 'El aplicativo almacena DNI y correo de servidores: uso limitado a la finalidad de control patrimonial.'],
    ['TUO de la Ley N° 27444, Ley del Procedimiento Administrativo General (D.S. N° 004-2019-JUS)', 'Los actos se sustentan en documentos (informe técnico, resolución) que el aplicativo exige registrar.']
  ];

  /* Matriz módulo ↔ Directiva. Cada fila: [módulo del aplicativo, artículos, anexo, qué controla el aplicativo] */
  const MATRIZ = [
    ['Registro de bienes', 'Arts. 5, 19–22', 'Apéndice A', 'Código patrimonial único de 12 dígitos (Catálogo — 2ª DCT), sin duplicados (20.3); registro con denominación, detalle técnico, estado, documentos, valores, cuenta contable y ubicación (22.1).'],
    ['Alta', 'Arts. 15–18, 21.3', 'Anexos N° 01, 02 y Apéndice A', 'Causales del art. 16.1 con el documento exigido por el art. 17.1; compras con PECOSA/NEA (21.3); otras causales con opinión de OAJ y resolución de OGA (16.2).'],
    ['Identificación (etiquetas)', 'Arts. 19–20, 35.3.d', '—', 'Etiqueta con código y nombre de la entidad (20.1, 20.4); etiqueta de inventario con año y entidad (35.3.d).'],
    ['Eliminación de registro erróneo / modificación de valor', 'Arts. 24–25', 'Anexo N° 01', 'La anulación y el cambio de valor exigen resolución de OGA y quedan en bitácora.'],
    ['Asignación en uso y devolución', 'Arts. 26–30', 'Anexo N° 03', 'Ficha de asignación en uso y devolución; modalidad sede o teletrabajo (27); bienes de uso común al jefe de la unidad (28.2); alerta si un bien incorporado no se asigna en 20 días hábiles (26.2).'],
    ['Salida, reingreso y desplazamiento interno', 'Arts. 28.3–28.4, 30.c, 87', 'Anexo N° 04', 'Orden con tipo, motivo (mantenimiento, comisión de servicios, capacitación o evento), documento que autoriza, responsable del traslado y destino; alerta de retornos vencidos.'],
    ['Inventario anual', 'Arts. 31–37', 'Anexos N° 05, 06, 07 y 09', 'Cierre al 31/12 (31.1); comisión designada por resolución (32); fases de planificación, campo y gabinete (35); ficha de levantamiento (35.3); verificación física o digital (35.4); conciliación (35.6.b); informe final; presentación hasta el 15/03 o el 31/03 (36).'],
    ['Saneamiento de sobrantes', 'Arts. 38–43', 'Anexos N° 01 y 02', 'Posesión mínima de 1 año (39); publicación y oposición por 10 días hábiles (41–42); los RAEE y la chatarra pasan a disposición (43).'],
    ['Saneamiento de faltantes', 'Arts. 44–46', 'Anexo N° 01', 'Baja por la causal del art. 48.1.i, solo para bienes en situación "faltante"; comunicación al OCI (46).'],
    ['Baja', 'Arts. 47–51', 'Anexo N° 01 y Apéndice A', 'Las 11 causales aplicables del art. 48.1 (la de semovientes no aplica), con informe técnico y resolución (49.1); denuncia para sustracción (48.1.j); plazo de 5 meses para disponer (50.1).'],
    ['Afectación en uso (acto de administración)', 'Arts. 53–59', 'Anexo N° 02', 'Plazo máximo de 1 año (56.1); alerta 15 días hábiles antes del vencimiento (56.2); causales de extinción (58).'],
    ['Disposición final', 'Arts. 52, 60–82; 8ª DCF', 'Anexos N° 01, 02 y 10', 'Solo para bienes dados de baja (60.1); transferencia, donación, subasta pública y permuta (61); eliminación de chatarra, prohibida para RAEE (8ª DCF); tasación (92–93).'],
    ['Mantenimiento', 'Arts. 83–88', 'Anexo N° 04', 'Registro por tipo (preventivo, predictivo, correctivo, en uso — art. 84); salidas para mantenimiento con orden (87); registro de información (88).'],
    ['Aseguramiento', 'Arts. 89–91; 7ª DCF', '—', 'Póliza y vigencia por bien; alerta de pólizas vencidas.'],
    ['Supervisión', 'Arts. 6, 94–95', 'Anexo N° 07', 'Verificación periódica de existencia, ubicación, estado, condiciones y asignación al usuario.'],
    ['Bitácora y respaldo', 'Arts. 6.c, 22.2; Ley N° 28716', '—', 'Trazabilidad inalterable de cada acto, con usuario, fecha y documento.']
  ];

  /* Puntos de interpretación que el aplicativo NO resuelve y que debe definir la UE / OAJ */
  const AMBIGUEDADES = [
    ['Ámbito de aplicación (art. 3)', 'La Directiva rige para las Entidades del art. 3 del D.Leg. N° 1439. El CLAS es una asociación civil privada sin fines de lucro que cogestiona un establecimiento público (Ley N° 29124); no es, por sí misma, una Entidad del SNA. Los bienes del Estado ubicados en el establecimiento siguen bajo el patrimonio de la Unidad Ejecutora y les aplica la Directiva. Debe definirse por escrito (convenio de cogestión u opinión de la OAJ de la UE) qué bienes son de la UE y cuáles del CLAS.'],
    ['Registro oficial (arts. 21.1 y 23)', 'El registro oficial es el Módulo de Patrimonio del SIGA MEF (o el SINABIP, según la 3ª DCT) y lo lleva la OCP de la UE, con un plazo de 10 días hábiles. Este aplicativo es un registro operativo y de control interno del establecimiento que alimenta ese registro; no lo sustituye.'],
    ['Quién es la "OGA" y la "OCP" (art. 4.1)', 'Para los bienes del Estado, la OGA y la OCP son las de la Unidad Ejecutora (Red de Salud). En el establecimiento, el responsable de Control Patrimonial del CLAS actúa como enlace operativo. Para los bienes propios del CLAS, la Directiva no los regula expresamente: puede aplicarse supletoriamente por decisión de la Gerencia o el Consejo Directivo del CLAS.'],
    ['Plazo de presentación del inventario (art. 36.1)', 'Si el establecimiento se trata como "Organización de la Entidad", remite el sustento a la OGA hasta el 15 de marzo; la Entidad lo remite a la DGA hasta el 31 de marzo. Confirme con la UE qué plazo interno le aplica.'],
    ['Vigencia', 'La Directiva fue publicada el 26/12/2021. Verifique si la DGA aprobó modificatorias posteriores antes de usar el aplicativo como sustento ante la OCP o el OCI.']
  ];

  /* Texto del informe de sustento legal (formato del Anexo N° 01) */
  function informeSustento(cfg) {
    return {
      asunto: 'Sustento legal para el uso del aplicativo "Gestión de Inventario" como herramienta de control patrimonial del establecimiento',
      antecedentes: [
        `El inventario de bienes muebles patrimoniales del ${cfg.establecimiento} se gestiona en una hoja de cálculo que registra la situación de los bienes a una fecha, pero no los actos (asignaciones, salidas, bajas, etc.) que la modifican ni sus documentos de sustento.`,
        'La Directiva N° 0006-2021-EF/54.01 exige que cada acto sobre bienes muebles patrimoniales se sustente documentalmente, se registre en un plazo determinado y se formalice en los formatos de sus anexos.',
        'Para cumplir dichas exigencias se ha desarrollado el aplicativo "Gestión de Inventario", que funciona localmente en el navegador, sin costo de licencias.'
      ],
      analisis: [
        '1. Naturaleza del aplicativo. Es una herramienta de registro operativo y de control interno. No sustituye al Módulo de Patrimonio del SIGA MEF, que según los arts. 21.1 y 23 de la Directiva es el registro oficial, a cargo de la OCP de la Unidad Ejecutora. El aplicativo produce la información y los formatos que la OCP necesita para registrar en el SIGA MEF dentro de los 10 días hábiles del art. 23.',
        '2. Habilitación normativa. Su uso se sustenta en: (a) el art. 19 de la Directiva, que establece como finalidad de la identificación "facilitar su asignación, control, trazabilidad y custodia"; (b) el art. 22.2, que obliga a la OCP a mantener actualizada la información del registro; (c) el art. 6, literales a) y c), que encargan a la OGA supervisar la asignación en uso y verificar el cumplimiento de la Directiva; (d) los arts. 35.4 y 94, que admiten la verificación y la supervisión "física o digital" mediante herramientas tecnológicas; (e) la Ley N° 28716, que obliga a resguardar los bienes del Estado; y (f) el D.Leg. N° 1412, que promueve el uso de herramientas digitales en la gestión pública.',
        '3. Correspondencia con la Directiva. El aplicativo está organizado por los Títulos de la Directiva. Para cada acto exige los requisitos y documentos que la norma prevé (causal, informe técnico, resolución, denuncia, plazo) y genera los formatos de los Anexos N° 01, 02, 03, 04, 05, 06, 07 y 09. La matriz adjunta detalla cada correspondencia.',
        '4. Validez de los documentos. Los formatos que emite el aplicativo surten efecto solo cuando son suscritos por los responsables indicados en cada anexo. Los actos que requieren resolución (alta por las causales del art. 16, baja, disposición, afectación en uso, eliminación de registro, modificación de valor) solo se registran en el aplicativo después de emitida la resolución, cuyo número es obligatorio.',
        '5. Seguridad y trazabilidad. El aplicativo controla el acceso con usuarios y roles (Control Patrimonial, Comisión de Inventario, Consulta), registra en una bitácora cada operación y permite respaldos. Los datos personales de los servidores (DNI, correo) se usan exclusivamente para la finalidad de control patrimonial, conforme a la Ley N° 29733.',
        '6. Puntos por definir. Deben precisarse con la Unidad Ejecutora: (i) qué bienes pertenecen a la UE y cuáles al CLAS; (ii) el plazo interno de presentación del inventario; (iii) el canal de remisión de la información a la OCP para su registro en el SIGA MEF.'
      ],
      conclusiones: [
        'El uso del aplicativo es compatible con la Directiva N° 0006-2021-EF/54.01 y con la normativa de control interno, siempre que se utilice como registro operativo complementario al Módulo de Patrimonio del SIGA MEF y no como su reemplazo.',
        'El aplicativo implementa los actos, plazos y formatos de la Directiva, lo que fortalece la trazabilidad y la custodia de los bienes del establecimiento.'
      ],
      recomendaciones: [
        `Aprobar mediante acto resolutivo o documento de la Gerencia del ${cfg.entidad} el uso del aplicativo como herramienta de control patrimonial del establecimiento, y designar al responsable de Control Patrimonial y a sus usuarios.`,
        'Remitir el presente informe a la Oficina de Control Patrimonial de la Unidad Ejecutora para su conocimiento y para coordinar la remisión periódica de información al SIGA MEF.',
        'Solicitar a la Unidad Ejecutora la definición de la titularidad de los bienes (UE o CLAS) y del plazo interno de presentación del inventario.',
        'Disponer el respaldo semanal de la información y su custodia en un medio institucional.'
      ]
    };
  }

  const API = { DIRECTIVA, BASE_LEGAL, MATRIZ, AMBIGUEDADES, informeSustento };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Normativa = API;
})(typeof window !== 'undefined' ? window : globalThis);
