# Gestión de Inventario — Bienes muebles patrimoniales
**CLAS Agregado La Querencia · Centro de Salud CLAS Querencia · Huaral, Lima Provincias**

Aplicativo web para registrar los bienes muebles patrimoniales del establecimiento y
documentar cada movimiento (alta, asignación, devolución, desplazamiento, salida,
reingreso, cambio de estado, baja, disposición e inventario), con formatos imprimibles,
kardex por bien, bitácora de auditoría e indicadores.

> Carpeta autocontenida: puede trasladarse tal cual a un repositorio propio
> (`gestion-de-inventario`). No depende de ningún otro archivo del portal.

---

## 1. Análisis del problema

Situación encontrada en `INVENTARIO_CLAS_QUERENCIA_2025.xlsx` (537 bienes, S/ 671,562.58):

| Hallazgo | Cantidad | Implicancia |
|---|---|---|
| Bienes sin servidor responsable asignado | 537 (100 %) | No existe formato de asignación en uso; no hay a quién atribuir custodia ni pérdida. |
| Ubicación "SIN UBICACION" | 49 | Bienes no localizables físicamente. |
| Estado Malo / RAEE | 76 | Candidatos a baja pendientes, que inflan el patrimonio. |
| Bienes en "ALMACEN DE PATRIMONIO (HOSPITAL HUARAL) – BIENES PARA BAJA" | 4 | Baja iniciada sin cerrar. |
| Sin orden de compra (código 9998) | 140 | Sustento de adquisición incompleto. |
| Sin código interno | 20 | |
| Ubicaciones con nombres distintos para el mismo ambiente | ej.: "SALA DE ESPERA 1ER PISO" / "SALA DE ESPERA 1° PISO" | Hay que unificar. |
| Origen del bien (propio CLAS o afectado por la UE) | no registrado | Ver ambigüedad normativa §3. |

El Excel es una foto estática: no guarda **quién movió qué, cuándo y con qué documento**.
Esa trazabilidad es lo que exigen la normativa y el control posterior (OCI / Contraloría).

## 2. Objetivos y alcance

- Registro único de bienes con código patrimonial de 12 dígitos (8 de catálogo + 4 correlativo).
- Cada cambio de situación, estado, ubicación o responsable se hace **solo mediante un
  movimiento numerado** que tiene documento de sustento y formato imprimible.
- Kardex por bien, bitácora inalterable y anulación controlada.
- Toma de inventario por ubicación, con faltantes, sobrantes, regularización e informe final.
- Indicadores para la gestión y alertas (salidas vencidas, candidatos a baja, calidad de datos).

**Fuera de alcance (v1):** depreciación contable, integración con SIGA-MEF / SINABIP,
bienes inmuebles, firma digital.

## 3. Normativa aplicada y sustento legal

El aplicativo implementa la **Directiva N° 0006-2021-EF/54.01** (R.D. N° 0015-2021-EF/54.01, DGA-MEF), en el marco del
D.Leg. N° 1439 y del D.S. N° 217-2019-EF. Desde el D.Leg. N° 1439, la rectoría sobre bienes **muebles** corresponde a
la DGA-MEF, no a la SBN.

- Sustento legal completo, matriz módulo ↔ artículo ↔ anexo y puntos por definir: [`docs/SUSTENTO_LEGAL.md`](docs/SUSTENTO_LEGAL.md).
- Dentro del aplicativo: **Marco normativo → Imprimir informe de sustento legal**.

Se complementa con el **Reglamento de la Ley N° 29124 (D.S. N° 017-2008-SA)**:
- Los bienes adquiridos o donados al CLAS se transfieren al Gobierno Regional (arts. 63.d y 68.d). El aplicativo lo
  implementa con el acto **Transferencia al Gobierno Regional**.
- El Consejo Directivo y el Gerente custodian los bienes y deben informar sobre ellos (arts. 43.f, 49.c, 49.e y 49.h).
  El aplicativo lo implementa con el **Informe de situación patrimonial**: mensual, semestral, de rendición de cuentas o
  de diagnóstico.
- Otras disposiciones: plan anual de mantenimiento (81.d), supervisión semestral (103.d) y control de la Ley N° 27785 (108).

**Puntos por definir (detalle en el documento):**
- Alcance del art. 36.o ("patrimonio de la CLAS").
- Oportunidad de la transferencia.
- Quién actúa como OGA y como OCP.
- Participación del CLAS en el inventario regional (art. 79.f) y plazo.
- Plan de mantenimiento anual frente al multianual.
- Modificatorias posteriores.
- UIT 2026.

## 4. Arquitectura

```
Navegador (Chrome / Edge / Firefox)
 ├─ index.html + css/app.css          Interfaz (responsive, modo oscuro)
 ├─ js/core.js     Reglas de la Directiva: catálogos, validaciones, transiciones, inventario, plazos ← probado con node --test
 ├─ js/normativa.js Sustento legal, base legal, matriz módulo↔artículo, ambigüedades
 ├─ js/db.js       IndexedDB: datos, usuarios (SHA-256 iterado con sal), bitácora, respaldo
 ├─ js/formatos.js Anexos N° 01, 02, 03, 04, 05, 06, 07, 09, Apéndice A, etiquetas, informe de sustento
 ├─ js/app.js      Vistas, rutas (#/...), permisos por rol
 └─ lib/xlsx.full.min.js  SheetJS 0.18.5 (importar/exportar Excel, sin internet)
```

**Por qué esta arquitectura:** el portal ya se publica en GitHub Pages, sin servidor ni
base de datos. Una aplicación 100 % cliente:
- no cuesta nada ni requiere un proveedor de hosting;
- funciona sin internet, lo que importa en el primer nivel de atención;
- se implementa hoy mismo.

**Su límite:** los datos viven en **un solo navegador de una sola PC**. Sirve para una sola
persona responsable de Control Patrimonial. Para uso multiusuario ver el roadmap (§10).

## 5. Módulos (organizados por Títulos de la Directiva)

| Menú | Título / artículos | Qué hace |
|---|---|---|
| Panel | — | KPIs y **alertas de plazos**: disposición a 5 meses (50.1), asignación a 20 días hábiles (26.2), registro a 10 días hábiles (23), vencimiento de afectaciones (56), salidas vencidas, inventario anual (31, 36), faltantes (44–46). |
| Bienes / Etiquetas | Tít. III, arts. 19–25 | Registro, kardex y corrección de datos. Cambiar el valor exige resolución (art. 25). Etiquetas con código y entidad, o con año de inventario (35.3.d). |
| Registrar acto | Tít. III–IX | 12 actos con sus causales, requisitos condicionados por causal y su formato (ver tabla). Borrador del Informe Técnico (Anexo N° 01) antes de la resolución. |
| Historial de actos | — | Número correlativo, sustento y anulación de registro erróneo (art. 24). |
| Inventario y supervisión | Tít. V y X | Comisión por resolución (32). Fases: planificación (plan, contraste de usuarios), campo (Anexo N° 07; uso/desuso; física/digital; sobrantes), gabinete (conciliación, Anexo N° 05; informe, Anexo N° 06), cierre con regularización y presentación (Anexo N° 09). |
| Saneamiento | Tít. VI | Faltantes → baja por saneamiento o sustracción. Sobrantes → evaluación del año de posesión (39), excepción para RAEE y chatarra (43), alta. |
| Mantenimiento y seguros | Tít. IX | Registro de mantenimientos por tipo (84), salidas para mantenimiento (87), planes (86, 90) y pólizas (89). |
| Marco normativo | — | Sustento legal: Directiva, Reglamento CLAS, matriz y ambigüedades. |
| Reportes | Reglamento 36.n, 43.f, 49.c, 49.h, 104 | Informe de situación patrimonial; fichas por usuario; exportaciones. |

### Actos y reglas

| Acto | Desde | Requisitos | Formato |
|---|---|---|---|
| Alta | — | Causal del art. 16.1 (o compra con PECOSA, 21.3) y documento (17.1). Donación, reposición, permuta, saneamiento u otra causal: además informe técnico y resolución. Código de 12 dígitos no repetido (20.3). | Anexo N° 02 o ficha de alta + Apéndice A |
| Asignación en uso | Activo | Usuario y modalidad sede o teletrabajo (27) | Anexo N° 03 |
| Devolución | Activo con usuario | Motivo; estado verificado (29.3.c) | Anexo N° 03 (una ficha por usuario) |
| Desplazamiento interno | Activo | Ubicación de destino | Anexo N° 04 |
| Salida / Reingreso | Activo / En salida | Motivo (mantenimiento, comisión de servicios, capacitación), documento que autoriza, responsable del traslado, destino y retorno; tipo de mantenimiento (84) | Anexo N° 04 |
| Mantenimiento | Activo / En salida | Tipo (84) y trabajos realizados | Constancia |
| Estado de conservación | Activo / En salida / Afectado | Nuevo estado y sustento | Acta de constatación |
| Baja | Activo / Faltante | Causal del art. 48.1, informe técnico y resolución (49.1). RAEE y chatarra: el bien debe tener ese estado. Sustracción: denuncia. Faltantes: solo saneamiento o sustracción. | Anexo N° 01 + relación |
| Afectación en uso | Activo | Afectataria, informe técnico, finalidad, plazo máximo de 1 año (56.1) | Anexo N° 02 |
| Extinción de afectación | Afectado | Causal (58) y resolución | Anexo N° 02 |
| Disposición | Baja | Modalidad (61), informe técnico, resolución y beneficiario. Subasta y permuta: tasación. RAEE: no se elimina (8ª DCF). | Anexo N° 02 |
| Transferencia al Gobierno Regional | Bienes "Adquirido por el CLAS" o "Donado al CLAS" | Documento de transferencia y receptor (Reglamento 63.d y 68.d). El bien sigue en uso; la titularidad pasa a patrimonio del Estado. | Anexo N° 02 + relación valorizada |

Situaciones del bien: Activo → En salida / Afectado / Faltante → Baja → Excluido del patrimonio. La baja por saneamiento de
faltantes excluye el bien sin acto de disposición (art. 60.3).

## 6. Modelo de datos (IndexedDB)

| Almacén | Clave | Campos principales |
|---|---|---|
| `bienes` | `codigo` | codigo_interno, descripcion, marca, modelo, serie, medidas, color, **estado**, **situacion**, **ubicacion**, **responsable**, origen, nro_orden, fecha_adquisicion, valor, cuenta_contable, observaciones |
| `movimientos` | `numero` | tipo, fecha, causal, documento, responsable_destino, ubicacion_destino, destino_externo, fecha_retorno, estado_destino, motivo, items[], **detalle[] {codigo, antes, despues}**, usuario, registrado, anulado |
| `personal` | `id` | dni, nombres, cargo, condicion, activo |
| `ubicaciones` | `nombre` | piso, activo |
| `inventarios` | `id` | anio, fecha_corte, comision, documento, estado, verif{codigo→verificación}, sobrantes[], resultados, movimiento |
| `usuarios` | `usuario` | nombre, rol, sal, hash, debeCambiar, activo |
| `bitacora` | autoincremental | fecha, usuario, accion, detalle |
| `config` | `clave` | valor |

El `detalle` de cada movimiento guarda la situación de cada bien **antes y después**. Con eso se
reconstruye el kardex y se hace la anulación sin ambigüedad.

## 7. Manual de usuario (resumen)

1. **Abrir:** desde GitHub Pages (`…/gestion-inventario/`) o en la PC con un servidor local
   (`python -m http.server` dentro de esta carpeta → `http://localhost:8000`).
   Si abre el archivo con doble clic, la carga del inventario incluido no funciona; use "Importar Excel".
2. **Primer ingreso:** usuario `admin`, clave `admin`. El sistema obliga a cambiarla.
3. **Configuración:** complete los datos y responsables (jefe(a), OGA, OCP, Contabilidad, dirección), los planes de
   mantenimiento y aseguramiento y la UIT vigente. Luego pulse **"Cargar inventario 2025 incluido"**.
4. **Marco normativo:** imprima el **informe de sustento legal** y tramite su aprobación ante la Gerencia del CLAS, con copia a la OCP de la UE.
5. **Usuarios y ubicaciones:** registre a los usuarios (DNI, correo, unidad, condición) y unifique las ubicaciones.
6. **Asignación en uso (Anexo N° 03):** Registrar acto → *Asignación en uso* → elija al usuario y la modalidad, filtre por
   ubicación, marque los bienes → Registrar → **Imprimir formato** → recoja las firmas → archive.
7. **Salidas (Anexo N° 04):** registre la *Salida* antes de que el bien deje la sede (motivo, autorización, responsable,
   destino, retorno). Al volver, registre el *Reingreso*.
8. **Baja (arts. 47–49):** en el formulario de *Baja*, imprima el **borrador del Informe Técnico**, tramite la resolución y,
   cuando la tenga, registre la baja con su número. Dentro de los 5 meses siguientes, registre la *Disposición*.
9. **Inventario (Título V):** Inventario y supervisión → *Iniciar* (resolución y comisión) → planificación → trabajo de campo
   por ubicación (Anexo N° 07) → gabinete (Anexos N° 05 y 06) → *Cerrar y regularizar* → presentación (Anexo N° 09).
10. **Saneamiento (Título VI):** los faltantes se dan de baja por saneamiento o sustracción. Los sobrantes con 1 año de
    posesión se incorporan con *Alta* desde esta pantalla.
11. **Respaldo:** Configuración → *Descargar respaldo* **cada semana** y después de cada inventario.

Roles:
- **Administrador:** todo.
- **Control Patrimonial (OCP):** registra bienes y actos.
- **Comisión de Inventario:** ejecuta inventarios y supervisiones.
- **Consulta (OGA / Jefatura):** ve, exporta e imprime.

## 8. Plan de pruebas

- **Unitarias** (reglas de la Directiva, plazos, inventario y carga del Excel 2025): `node --test gestion-inventario/tests/core.test.js` → 20 pruebas.
- **Funcionales (verificadas en Chromium):** carga de 537 bienes; asignación de 20 bienes (Anexo N° 03); salida
  incompleta rechazada; baja de 4 bienes con borrador e Informe Técnico (Anexo N° 01); disposición por donación (Anexo N° 02)
  y su anulación; inventario anual sin resolución rechazado; inventario con faltante, diferencia, uso/desuso y sobrante;
  Anexos N° 07, 05, 06 y 09; alta del sobrante desde Saneamiento; etiquetas; informe de sustento legal; vista móvil sin
  desplazamiento horizontal; sin errores de consola.
- **Pendiente de prueba con usuarios reales:** impresión física en A4 y lectura del formato por la UE.

## 9. Seguridad: lo que hace y lo que **no** hace

- Claves con SHA-256 iterado y sal, cambio obligatorio en el primer ingreso, roles y bitácora.
- **Limitación importante:** todo corre en el navegador. Quien tenga acceso a la PC y
  conocimientos técnicos puede leer o alterar la base local con las herramientas del navegador.
  La autenticación ordena el uso, **pero no protege los datos frente a manipulación
  intencional**. El respaldo semanal impreso o firmado es el control compensatorio. Para
  seguridad real (JWT, HTTPS, cifrado en servidor y bitácora en servidor) ver la fase 2.
- SheetJS 0.18.5 (la última versión publicada en npm) tiene vulnerabilidades conocidas al
  **leer** archivos manipulados (CVE-2023-30533 y CVE-2024-22363). Solo importe Excel de
  origen institucional. Para corregirlo, reemplace `lib/xlsx.full.min.js` por la versión
  0.20.3 o posterior desde `https://cdn.sheetjs.com/`.

## 10. Roadmap

| Fase | Contenido |
|---|---|
| 1 (esta versión) | Aplicativo local: registro, movimientos, formatos, inventario, reportes. |
| 1.1 | Etiquetas con código QR por bien y verificación del inventario escaneando con el celular; adjuntar el PDF firmado a cada movimiento (Cloudflare R2, ya usado por el portal). |
| 2 | Backend multiusuario (FastAPI o NestJS + PostgreSQL, JWT, HTTPS, bitácora en servidor, backups automáticos), reutilizando `core.js` como especificación de las reglas. |
| 3 | Depreciación por cuenta contable; conciliación contable-patrimonial; exportación en el formato que exija la UE o el SIGA-MEF; integración del mantenimiento con el Plan de Mantenimiento 2026. |

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| Pérdida de datos (cambio de PC o borrado del navegador) | Respaldo semanal obligatorio; fase 2 con servidor. |
| Uso en varias PC genera registros divergentes | Un solo operador o una sola PC hasta la fase 2. |
| Los formatos no coinciden con el modelo de la UE | Validar con Control Patrimonial de la UE; ajustar `formatos.js`. |
| Origen de los bienes no definido (CLAS / UE) | Saneamiento con la UE antes del inventario 2026. |
| Normativa modificada | Los catálogos están concentrados en `core.js` (fáciles de actualizar). |

## 12. Recomendaciones inmediatas

1. Confirmar con la UE cuál es el registro oficial (SIGA-Patrimonio de la UE) y usar este
   aplicativo como **registro operativo del establecimiento**, conciliado con aquel.
2. Hacer en noviembre una campaña de **asignación en uso** por servicio (537 bienes sin responsable),
   antes del inventario con corte al 31/12/2026.
3. Resolver los 49 bienes "SIN UBICACION" y los 76 en estado Malo/RAEE (expediente de baja).
4. Unificar los nombres de las ubicaciones antes de iniciar el inventario.
