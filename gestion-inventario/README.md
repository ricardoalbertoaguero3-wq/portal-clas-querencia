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

## 3. Normativa aplicada y ambigüedades

| Norma | Uso en el aplicativo |
|---|---|
| D.Leg. N° 1439, Sistema Nacional de Abastecimiento, y su Reglamento, D.S. N° 217-2019-EF | Marco general de la gestión de bienes muebles. |
| Directiva N° 0006-2021-EF/54.01, "Directiva para la Gestión de Bienes Muebles Patrimoniales en el marco del SNA" (R.D. N° 0015-2021-EF/54.01) | Tipos de acto, causales de baja, actos de disposición, asignación en uso, inventario. |
| D.S. N° 009-2019-MINAM, régimen de RAEE | Estado "RAEE" y disposición mediante operador autorizado. |
| Ley N° 29124 (CLAS) y su reglamento, D.S. N° 017-2008-SA | Co-gestión; contexto del origen de los bienes. |
| Ley N° 27444, TUO D.S. N° 004-2019-JUS | Sustento documental de cada acto. |

**Puntos que debe validar con la Unidad de Control Patrimonial de la Unidad Ejecutora
(Red de Salud Huaral–Chancay / DIRESA Lima) antes de usar el aplicativo como registro oficial:**

1. **SBN vs. DGA-MEF.** Con el D.Leg. 1439, la rectoría sobre los **bienes muebles**
   pasó de la SBN a la Dirección General de Abastecimiento del MEF; hoy la SBN se
   ocupa principalmente de los inmuebles. El aplicativo sigue la Directiva
   0006-2021-EF/54.01. **Verifique si existen modificatorias posteriores**: no pude
   confirmar desde este entorno si hubo cambios después de 2021.
2. **Propiedad de los bienes del CLAS.** El CLAS es una asociación civil privada sin fines
   de lucro que administra recursos públicos. No queda claro, y debe definirse, cuáles bienes son
   del Estado (afectados en uso por la UE y registrados en su SIGA) y cuáles son
   propiedad del CLAS (adquiridos con recursos propios o transferencias). Por eso el
   campo **Origen** está en "No determinado" para los 537 bienes y genera una alerta.
3. **Plazos del inventario anual** (fecha de corte y fecha de remisión del informe): no
   están fijados en el sistema. Regístrelos según la directiva y el cronograma de la UE.
4. **Umbral contable de 1/4 UIT** (activo fijo vs. cuentas de orden): es un criterio
   contable referencial. La UIT se configura (por defecto **S/ 5,350, UIT 2025**).
   **Actualícela con el valor vigente de 2026.**
5. **Numeración y nombre de los anexos oficiales.** Los formatos imprimibles siguen el
   contenido que exige la directiva, pero **no reproducen la numeración de sus anexos**.
   Si la UE exige su propio modelo, ajuste `js/formatos.js`.

## 4. Arquitectura

```
Navegador (Chrome / Edge / Firefox)
 ├─ index.html + css/app.css          Interfaz (responsive, modo oscuro)
 ├─ js/core.js     Reglas de negocio puras (validaciones, transiciones, inventario, KPIs) ← probado con node --test
 ├─ js/db.js       IndexedDB: datos, usuarios (SHA-256 iterado con sal), bitácora, respaldo
 ├─ js/formatos.js Formatos A4 imprimibles / PDF
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

## 5. Módulos y funcionalidades

| Módulo | Funcionalidad |
|---|---|
| Panel | KPIs (bienes, valor, activo fijo / cuentas de orden), alertas, gráficos por estado y ubicación, últimos movimientos. |
| Bienes | Búsqueda y filtros; ficha con kardex; edición **solo de datos descriptivos**, con motivo obligatorio en la bitácora; exportación a Excel. |
| Movimientos | 9 actos manuales y 1 automático (inventario). Validaciones por situación del bien, correlativo `PREF-AAAA-NNNN`, formato imprimible, anulación con reversión. |
| Toma de inventario | Campaña con comisión y fecha de corte; verificación por ubicación; sobrantes; cierre con regularización automática e informe. |
| Reportes | Inventario completo, resumen por ubicación, candidatos a baja, calidad de datos y relación de bienes por servidor (para cese o rotación). |
| Personal y ubicaciones | Maestros. No permite desactivar a un servidor que aún tiene bienes asignados. |
| Bitácora | Ingresos, intentos fallidos, ediciones, movimientos, anulaciones, cargas y restauraciones. |
| Configuración | Datos institucionales, UIT, carga del inventario, respaldo y restauración, usuarios y roles. |

### Reglas de los actos (máquina de estados del bien)

```
           ALTA
            │
            ▼
  ┌──── ACTIVO ◄──── REINGRESO ──── EN_SALIDA
  │  (asignación, devolución,          ▲
  │   desplazamiento, cambio de estado)│
  │         │ SALIDA ──────────────────┘
  │         │
  │ inventario (no hallado)
  ▼         ▼
FALTANTE ─► BAJA ──► DISPOSICIÓN ──► DISPUESTO
```

| Acto | Desde | Obligatorio |
|---|---|---|
| Alta | — | causal, documento; código de 12 dígitos no repetido; valor > 0 |
| Asignación en uso | Activo | servidor que recibe |
| Devolución | Activo con responsable | motivo |
| Desplazamiento | Activo | ubicación de destino |
| Salida temporal | Activo | motivo, destino, fecha de retorno ≥ fecha de salida |
| Reingreso | En salida | — |
| Cambio de estado | Activo / En salida | nuevo estado, motivo |
| Baja | Activo / Faltante | causal, resolución, motivo (además libera la custodia) |
| Disposición | Baja | modalidad, resolución, beneficiario |

**Anulación:** solo el Administrador puede anular, y solo si ningún bien tuvo movimientos
posteriores. El sistema revierte los bienes a su estado anterior y conserva el movimiento
marcado como anulado.

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
3. **Configuración:** complete jefe(a), responsable de Control Patrimonial y UIT vigente. Luego
   pulse **"Cargar inventario 2025 incluido"** (o importe su Excel con las mismas columnas).
4. **Personal y ubicaciones:** registre a los servidores (DNI, cargo, condición) y unifique las ubicaciones.
5. **Asignación en uso:** Movimientos → *Asignación en uso* → elija al servidor, filtre por
   ubicación, marque los bienes → Registrar → **Imprimir formato** → recoja las firmas → archive.
6. **Salidas:** registre una *Salida temporal* antes de que el bien deje la sede; al volver,
   registre el *Reingreso*. Las salidas vencidas aparecen en el Panel.
7. **Baja:** cuando ya tenga la resolución, registre *Baja* con la causal. Luego registre la
   *Disposición* (donación, RAEE, etc.).
8. **Inventario:** Toma de inventario → *Iniciar* → recorra cada ubicación marcando
   Sí/No y corrigiendo estado, ubicación o responsable → registre los sobrantes → *Cerrar* →
   *Imprimir informe*. Los faltantes pasan a situación "Faltante". Los sobrantes se
   incorporan después con un *Alta* por "Sobrante de inventario".
9. **Respaldo:** Configuración → *Descargar respaldo* **cada semana** y después de cada inventario.

Roles: **Administrador** (todo), **Control Patrimonial** (registra bienes, movimientos e
inventario), **Consulta** (ve, exporta e imprime).

## 8. Plan de pruebas

- **Unitarias** (reglas de negocio y carga del Excel 2025): `node --test gestion-inventario/tests/core.test.js` → 11 pruebas.
- **Funcionales (verificadas en Chromium):** primer ingreso y cambio de clave; carga de 537
  bienes (S/ 671,562.58); alta de personal; asignación de 20 bienes y formato impreso; validación
  de una salida incompleta; baja y su anulación con reversión; inventario con un faltante y
  una diferencia, cierre e informe; vista móvil de 390 px sin desplazamiento horizontal; bitácora.
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
