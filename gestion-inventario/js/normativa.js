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
    ['Ley N° 29124, Ley que establece la cogestión y participación ciudadana para el primer nivel de atención en los establecimientos de salud del Ministerio de Salud y de las Regiones', 'Marco de la cogestión CLAS: el establecimiento público es administrado por el CLAS bajo un convenio de cogestión con el Gobierno Regional y el Gobierno Local.'],
    ['Decreto Supremo N° 017-2008-SA, Reglamento de la Ley N° 29124', 'Define la naturaleza del CLAS (art. 7), las responsabilidades sobre los bienes del Consejo Directivo (art. 43.f), el Gerente (art. 49.e) y la Asamblea General (art. 36.n), y la transferencia de los bienes adquiridos o donados al Gobierno Regional (arts. 63.d y 68.d). Detalle en la sección del Reglamento.'],
    ['Ley N° 27785, Ley Orgánica del Sistema Nacional de Control y de la Contraloría General de la República', 'Aplicable a los CLAS respecto de los bienes y recursos del Estado que perciben o administran (art. 108 del D.S. N° 017-2008-SA).'],
    ['Ley N° 28716, Ley de Control Interno de las Entidades del Estado', 'El control interno comprende cuidar y resguardar los bienes del Estado frente a pérdida, deterioro o uso indebido.'],
    ['Decreto Legislativo N° 1412, Ley de Gobierno Digital', 'Habilita el uso de herramientas digitales para la gestión interna.'],
    ['Ley N° 29733, Ley de Protección de Datos Personales', 'El aplicativo almacena DNI y correo de servidores: uso limitado a la finalidad de control patrimonial.'],
    ['TUO de la Ley N° 27444, Ley del Procedimiento Administrativo General (D.S. N° 004-2019-JUS)', 'Los actos se sustentan en documentos (informe técnico, resolución) que el aplicativo exige registrar.']
  ];

  /* Reglamento de la Ley N° 29124 (D.S. N° 017-2008-SA): artículos sobre bienes y su aplicación en el aplicativo.
   * Cada fila: [artículo, contenido, cómo lo aplica el aplicativo] */
  const REGLAMENTO_CLAS = [
    ['Art. 7', 'Las CLAS son órganos de cogestión constituidos como asociaciones civiles sin fines de lucro con personería jurídica (Código Civil).', 'Explica por qué la Directiva rige sobre los bienes del Estado que el CLAS administra, y no sobre el CLAS como entidad (ver puntos por definir).'],
    ['Art. 36.n y 36.o', 'La Asamblea General vigila la integridad y el mantenimiento del patrimonio estatal entregado a la CLAS, y garantiza la inclusión de los bienes adquiridos en cada ejercicio presupuestal.', 'Informe de situación patrimonial semestral para la Asamblea General; alertas de bienes pendientes de transferir.'],
    ['Art. 39.b y 39.d', 'Es causal de remoción de los miembros de la Asamblea causar perjuicio al patrimonio de la CLAS o de los establecimientos.', 'La bitácora y el kardex identifican quién registró cada acto.'],
    ['Art. 43.f', 'El Consejo Directivo vela por el buen uso, la conservación y la custodia de los bienes patrimoniales otorgados en administración.', 'Informe de situación patrimonial mensual para el Consejo Directivo; rol de consulta.'],
    ['Art. 49.c', 'El Gerente informa mensualmente al Consejo Directivo y semestralmente a la Asamblea General sobre los aspectos administrativos y el funcionamiento de los establecimientos.', 'Informe de situación patrimonial por período (Reportes).'],
    ['Art. 49.e', 'El Gerente mantiene la infraestructura, la existencia y la conservación de los equipos, bienes, insumos y enseres entregados para su administración, para su uso exclusivo en la prestación de servicios de salud.', 'Fundamento de la asignación en uso, las salidas controladas, el mantenimiento y el inventario del establecimiento.'],
    ['Art. 49.h', 'El Gerente presenta al Consejo Directivo, en un plazo no mayor de 60 días calendario desde que asume el cargo, un diagnóstico de la situación del CLAS (incluidos los aspectos legales y administrativos).', 'Informe de situación patrimonial — diagnóstico de inicio de gestión.'],
    ['Art. 63.d', 'Los bienes adquiridos durante un ejercicio fiscal se transfieren a título gratuito a la Autoridad Sanitaria Regional y se incorporan al patrimonio de bienes del Estado y a sus cuentas contables.', 'Acto "Transferencia al Gobierno Regional"; titularidad "Adquirido por el CLAS — pendiente de transferir"; alerta de bienes de ejercicios anteriores no transferidos.'],
    ['Art. 68.d', 'Los bienes recibidos en donación durante el ejercicio se transfieren a título gratuito al Gobierno Regional o Local y se incorporan como patrimonio del Estado.', 'Igual que el art. 63.d, para la titularidad "Donado al CLAS".'],
    ['Art. 69', 'El CLAS lleva su contabilidad como persona jurídica (Plan Contable General); los documentos fuente son visados por la Gerencia.', 'Los bienes del Estado se concilian con la contabilidad de la UE (Anexo N° 05 de la Directiva); los del CLAS, hasta su transferencia, con la contabilidad del CLAS.'],
    ['Art. 72.l', 'El convenio de cogestión regula la disposición de los bienes y recursos.', 'Revise el convenio vigente: puede precisar el procedimiento y el plazo de la transferencia anual.'],
    ['Art. 79.a y 79.f', 'El Gobierno Regional proporciona el mobiliario y los equipos, y realiza el inventario y el diagnóstico de necesidades de mobiliario, enseres y equipamiento de los establecimientos.', 'El inventario del aplicativo es el insumo que el CLAS entrega a la DIRESA o a la UE para el inventario regional.'],
    ['Art. 81.a', 'El CLAS gestiona y administra en forma adecuada los recursos humanos, financieros, bienes materiales y equipos asignados para la ejecución del PSL.', 'Fundamento general del registro y del control patrimonial del establecimiento.'],
    ['Art. 81.d', 'El CLAS desarrolla y ejecuta el plan anual de mantenimiento de la infraestructura, los vehículos y los equipos del establecimiento.', 'Módulo de mantenimiento: registro por tipo y costo anual; plan registrado en Configuración.'],
    ['Art. 84', 'Si se resuelve el convenio, el Gobierno Regional administra transitoriamente los recursos y los bienes de las CLAS.', 'El registro y el respaldo permiten entregar la información de los bienes en caso de resolución del convenio.'],
    ['Art. 103.d', 'Las visitas de supervisión integral a las CLAS se realizan con una periodicidad mínima semestral.', 'Proceso de "Supervisión" en Inventario y supervisión.'],
    ['Art. 104', 'Rendición de cuentas a la DIRESA (mensual) y a la comunidad (semestral).', 'Informe de situación patrimonial para la rendición de cuentas.'],
    ['Art. 105', 'La vigilancia ciudadana puede denunciar el uso inadecuado de equipos, insumos, medios de transporte e infraestructura.', 'La ficha de asignación (Anexo N° 03) y el kardex identifican al usuario responsable de cada bien.'],
    ['Arts. 107–108', 'La DIRESA y el Gobierno Local realizan acciones de control; se aplica la Ley N° 27785 a los bienes del Estado que el CLAS administra; el OCI de la DIRESA puede auditar.', 'Bitácora, documentos de sustento obligatorios y formatos firmados como evidencia para el control.']
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
    ['Supervisión', 'Arts. 6, 94–95; D.S. 017-2008-SA art. 103.d', 'Anexo N° 07', 'Verificación periódica de existencia, ubicación, estado, condiciones y asignación al usuario.'],
    ['Transferencia al Gobierno Regional', 'D.S. 017-2008-SA arts. 63.d y 68.d; Directiva art. 16.1.e', 'Anexo N° 02', 'Bienes adquiridos o donados al CLAS: acta de transferencia gratuita; la titularidad pasa a patrimonio del Estado; alerta de pendientes de ejercicios anteriores.'],
    ['Informe de situación patrimonial', 'D.S. 017-2008-SA arts. 36.n, 43.f, 49.c, 49.h y 104', '—', 'Informe mensual (Consejo Directivo), semestral (Asamblea General), de rendición de cuentas o de diagnóstico de inicio de gestión del Gerente.'],
    ['Bitácora y respaldo', 'Arts. 6.c, 22.2; Ley N° 28716; Ley N° 27785', '—', 'Trazabilidad inalterable de cada acto, con usuario, fecha y documento.']
  ];

  /* Puntos de interpretación que el aplicativo NO resuelve y que debe definir la UE / OAJ */
  const AMBIGUEDADES = [
    ['Ámbito y titularidad (Directiva art. 3; Reglamento arts. 7, 63.d y 68.d)', 'El CLAS es una asociación civil (Reglamento, art. 7), no una Entidad del SNA. Sin embargo, el Reglamento dispone que los bienes adquiridos o donados durante el ejercicio se transfieran al Gobierno Regional y se incorporen al patrimonio del Estado (arts. 63.d y 68.d), y que el CLAS administre los bienes que se le otorgan (arts. 43.f, 49.e y 81.a). Por eso la Directiva se aplica a todos los bienes del establecimiento, con el CLAS como administrador. Queda por precisar: el art. 36.o habla de incluir los bienes adquiridos "al patrimonio de la CLAS en cada ejercicio presupuestal". El aplicativo lo interpreta como una incorporación transitoria hasta la transferencia; confirme este criterio con la OAJ de la DIRESA.'],
    ['Oportunidad y procedimiento de la transferencia (Reglamento arts. 63.d, 68.d y 72.l)', 'El Reglamento no fija un plazo ni un procedimiento para la transferencia. El aplicativo la propone al cierre del ejercicio, junto con el inventario anual. Revise si el convenio de cogestión (art. 72.l) o una directiva regional lo precisan. Para el Gobierno Regional, el ingreso es un alta por "Transferencia" (Directiva, art. 16.1.e), sustentada en el documento que emite el CLAS.'],
    ['Quién es la "OGA" y la "OCP" (Directiva art. 4.1)', 'Los actos que la Directiva reserva a la OGA (resoluciones de alta, baja, disposición y afectación) corresponden a la Unidad Ejecutora o al Gobierno Regional, titular de los bienes. En el CLAS, la custodia recae en el Consejo Directivo (art. 43.f) y en el Gerente (art. 49.e); el responsable de Control Patrimonial del CLAS actúa como enlace operativo de la OCP.'],
    ['Inventario (Directiva arts. 31–36; Reglamento art. 79.f)', 'El Reglamento encarga el inventario al Gobierno Regional, y la Directiva a la OGA de la entidad titular. El CLAS ejecuta su inventario o participa en el de la UE, y remite los resultados. Confirme si el CLAS debe conformar su propia Comisión o integrarse a la de la UE, y si el plazo aplicable es el 15/03 o el 31/03.'],
    ['Plan de mantenimiento (Directiva art. 86; Reglamento art. 81.d)', 'El Reglamento exige un plan anual de mantenimiento; la Directiva, un plan multianual de 3 años como mínimo, aprobado por resolución de la OGA. Pueden compatibilizarse: el plan anual del CLAS como tramo anual del plan multianual de la UE.'],
    ['Vigencia', 'La Directiva fue publicada el 26/12/2021 y el Reglamento el 01/08/2008. Verifique si existen modificatorias posteriores de ambas normas antes de usar el aplicativo como sustento ante la OCP o el OCI.']
  ];

  /* Texto del informe de sustento legal (formato del Anexo N° 01) */
  function informeSustento(cfg) {
    return {
      asunto: 'Sustento legal para el uso del aplicativo "Gestión de Inventario" como herramienta de control patrimonial del establecimiento',
      antecedentes: [
        `El ${cfg.entidad} administra el ${cfg.establecimiento} bajo un convenio de cogestión (Ley N° 29124 y su Reglamento, D.S. N° 017-2008-SA). El inventario de sus bienes muebles patrimoniales se gestiona en una hoja de cálculo que registra la situación de los bienes a una fecha, pero no los actos (asignaciones, salidas, bajas, etc.) que la modifican ni sus documentos de sustento.`,
        'La Directiva N° 0006-2021-EF/54.01 exige que cada acto sobre bienes muebles patrimoniales se sustente documentalmente, se registre en un plazo determinado y se formalice en los formatos de sus anexos.',
        'Para cumplir dichas exigencias se ha desarrollado el aplicativo "Gestión de Inventario", que funciona localmente en el navegador, sin costo de licencias.'
      ],
      analisis: [
        '1. Naturaleza del aplicativo. Es una herramienta de registro operativo y de control interno. No sustituye al Módulo de Patrimonio del SIGA MEF, que según los arts. 21.1 y 23 de la Directiva es el registro oficial, a cargo de la OCP de la Unidad Ejecutora. El aplicativo produce la información y los formatos que la OCP necesita para registrar en el SIGA MEF dentro de los 10 días hábiles del art. 23.',
        '2. Habilitación normativa. Su uso se sustenta en: (a) el art. 19 de la Directiva, que establece como finalidad de la identificación "facilitar su asignación, control, trazabilidad y custodia"; (b) el art. 22.2, que obliga a la OCP a mantener actualizada la información del registro; (c) el art. 6, literales a) y c), que encargan a la OGA supervisar la asignación en uso y verificar el cumplimiento de la Directiva; (d) los arts. 35.4 y 94, que admiten la verificación y la supervisión "física o digital" mediante herramientas tecnológicas; (e) la Ley N° 28716, que obliga a resguardar los bienes del Estado; y (f) el D.Leg. N° 1412, que promueve el uso de herramientas digitales en la gestión pública.',
        '3. Correspondencia con la Directiva. El aplicativo está organizado por los Títulos de la Directiva. Para cada acto exige los requisitos y documentos que la norma prevé (causal, informe técnico, resolución, denuncia, plazo) y genera los formatos de los Anexos N° 01, 02, 03, 04, 05, 06, 07 y 09. La matriz adjunta detalla cada correspondencia.',
        '4. Validez de los documentos. Los formatos que emite el aplicativo surten efecto solo cuando son suscritos por los responsables indicados en cada anexo. Los actos que requieren resolución (alta por las causales del art. 16, baja, disposición, afectación en uso, eliminación de registro, modificación de valor) solo se registran en el aplicativo después de emitida la resolución, cuyo número es obligatorio.',
        '5. Seguridad y trazabilidad. El aplicativo controla el acceso con usuarios y roles (Control Patrimonial, Comisión de Inventario, Consulta), registra en una bitácora cada operación y permite respaldos. Los datos personales de los servidores (DNI, correo) se usan exclusivamente para la finalidad de control patrimonial, conforme a la Ley N° 29733.',
        '6. Marco de la cogestión CLAS. El Reglamento de la Ley N° 29124 (D.S. N° 017-2008-SA) dispone que el Consejo Directivo vele por el buen uso, la conservación y la custodia de los bienes patrimoniales otorgados en administración (art. 43.f); que el Gerente mantenga la existencia y la conservación de los equipos y bienes entregados para su administración (art. 49.e) e informe mensualmente al Consejo Directivo y semestralmente a la Asamblea General (art. 49.c); y que los bienes adquiridos o donados durante el ejercicio se transfieran al Gobierno Regional para su incorporación al patrimonio del Estado (arts. 63.d y 68.d). Sobre esos bienes rige la Ley N° 27785 (art. 108). El aplicativo implementa estas obligaciones: la transferencia anual como acto con su acta, y el informe de situación patrimonial para el Consejo Directivo, la Asamblea General y la rendición de cuentas.',
        '7. Puntos por definir. Deben precisarse con la DIRESA o la Unidad Ejecutora: (i) la oportunidad y el procedimiento de la transferencia anual de bienes (arts. 63.d, 68.d y 72.l del Reglamento); (ii) si el CLAS ejecuta su propio inventario o se integra al de la UE, y el plazo aplicable; (iii) el canal de remisión de la información a la OCP para su registro en el SIGA MEF.'
      ],
      conclusiones: [
        'El uso del aplicativo es compatible con la Directiva N° 0006-2021-EF/54.01 y con la normativa de control interno, siempre que se utilice como registro operativo complementario al Módulo de Patrimonio del SIGA MEF y no como su reemplazo.',
        'El aplicativo implementa los actos, plazos y formatos de la Directiva, lo que fortalece la trazabilidad y la custodia de los bienes del establecimiento.',
        'El aplicativo permite al Consejo Directivo, al Gerente y a la Asamblea General cumplir sus obligaciones sobre los bienes conforme al Reglamento de la Ley N° 29124 (arts. 36.n, 43.f, 49.c, 49.e, 63.d y 68.d).'
      ],
      recomendaciones: [
        `Aprobar mediante acto resolutivo o documento de la Gerencia del ${cfg.entidad} el uso del aplicativo como herramienta de control patrimonial del establecimiento, y designar al responsable de Control Patrimonial y a sus usuarios.`,
        'Remitir el presente informe a la Oficina de Control Patrimonial de la Unidad Ejecutora para su conocimiento y para coordinar la remisión periódica de información al SIGA MEF.',
        'Coordinar con la DIRESA o la Unidad Ejecutora el procedimiento y la oportunidad de la transferencia anual de los bienes adquiridos o donados al CLAS (arts. 63.d y 68.d del Reglamento), y la forma de participación del CLAS en el inventario anual.',
        'Disponer que el Gerente presente al Consejo Directivo el informe mensual de situación patrimonial y a la Asamblea General el informe semestral (art. 49.c del Reglamento).',
        'Disponer el respaldo semanal de la información y su custodia en un medio institucional.'
      ]
    };
  }

  const API = { DIRECTIVA, BASE_LEGAL, REGLAMENTO_CLAS, MATRIZ, AMBIGUEDADES, informeSustento };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Normativa = API;
})(typeof window !== 'undefined' ? window : globalThis);
