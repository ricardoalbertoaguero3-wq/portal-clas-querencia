# Manual técnico — Gestión de Inventario v2 (multiusuario)

**CLAS Agregado La Querencia** · Plataforma: **Cloudflare Workers + D1 + R2**

---

## 1. Plataforma elegida y por qué

| Componente | Tecnología | Función |
|---|---|---|
| Servidor (API) | **Cloudflare Workers** + framework **Hono** (JavaScript) | Valida y registra los actos; maneja autenticación, roles y bitácora. |
| Base de datos | **Cloudflare D1** (SQL, motor SQLite) | Registro patrimonial, actos, kardex, inventarios, usuarios y bitácora. |
| Archivos | **Cloudflare R2** | Documentos firmados escaneados (PDF/JPG/PNG) y respaldos semanales. |
| Interfaz | HTML + CSS + JavaScript sin compilación, servida por el mismo Worker | La misma interfaz validada en el demo (47 casos). |
| Reglas de negocio | `js/core.js`, compartido por navegador y servidor | Directiva N° 0006-2021-EF/54.01 y D.S. N° 017-2008-SA en un solo lugar. |

### Por qué esta plataforma

1. **Ya es la plataforma institucional.** El portal del CLAS ya usa Cloudflare (Worker + R2 + KV). No se abre otro
   proveedor ni otra cuenta.
2. **Costo bajo y predecible.** El plan Workers Paid cuesta USD 5 al mes e incluye D1 y R2 dentro de los límites de uso
   del establecimiento (ver §8). No requiere un servidor propio, una licencia ni personal de TI dedicado.
3. **Sin mantenimiento de servidor.** No hay sistema operativo que parchar. HTTPS, certificados y protección DDoS son
   automáticos.
4. **Una sola fuente de reglas (DRY).** El mismo `core.js` valida en el navegador (para responder rápido) y en el
   servidor (para garantizar las reglas), así que no hay reglas duplicadas que puedan divergir.
5. **SQL estándar y portable.** El esquema (`migrations/`) es SQL convencional. Si la DIRESA exigiera alojar los datos
   en sus servidores, se migra a PostgreSQL y a otro servidor de API sin rehacer el modelo.

### Alternativas evaluadas

| Opción | Ventaja | Por qué no se eligió |
|---|---|---|
| FastAPI o NestJS + PostgreSQL en un VPS | Stack clásico; datos en un servidor propio | Unos S/ 60–150 al mes, requiere administrar el servidor, los parches, los respaldos y los certificados, y el CLAS no tiene personal de TI. |
| Laravel en un hosting compartido | Barato | Seguridad y respaldos dependen del proveedor; PHP desactualizado es frecuente en esos hostings. |
| Supabase | PostgreSQL gestionado | En el plan gratuito el proyecto se pausa por inactividad; agrega otro proveedor. |
| React / Next.js para la interfaz | Componentes y ecosistema | La interfaz actual ya está construida y probada. Reescribirla no aporta funciones a esta escala y obligaría a mantener un proceso de compilación. Queda en el roadmap si el equipo crece. |

## 2. Arquitectura

```
 Navegador (PC del establecimiento, celular)
   │  HTTPS (TLS automático)
   ▼
 Cloudflare Worker "gestion-inventario-clas"
   ├─ /           → archivos estáticos (index.html, css, js) con CSP estricta (_headers)
   └─ /api/*      → api/index.js (Hono)
                     ├─ Sesión: JWT HS256 en cookie HttpOnly + Secure + SameSite=Strict (8 h)
                     ├─ Roles: ADMIN · PATRIMONIO (OCP) · COMISION · CONSULTA
                     ├─ core.js: validación y aplicación de actos (mismas reglas que el navegador)
                     ├─ D1 (binding DB): una transacción por acto + bitácora en la misma transacción
                     └─ R2 (binding ARCHIVOS): adjuntos y respaldos
 Cron semanal (lunes 03:00 Lima) → respaldo JSON en R2 (conserva 12 semanas)
```

**Modos de funcionamiento.** La interfaz detecta si existe `/api/salud`:
- **Servidor:** multiusuario; los datos están en D1. Es el modo de producción.
- **Local:** sin servidor; los datos quedan en el IndexedDB del navegador. Se usa para demostración, capacitación o una
  contingencia sin internet.

La capa `js/repo.js` ofrece la misma interfaz para ambos modos.

## 3. Modelo de datos (D1)

Definido en `migrations/0001_esquema.sql`:

| Tabla | Contenido | Notas |
|---|---|---|
| `usuarios` | usuario, rol, hash PBKDF2-SHA256 (100 000 iteraciones), sal, intentos, bloqueo, `version_sesion` | `version_sesion` invalida los tokens al cambiar la clave o al desactivar al usuario. |
| `config` | datos institucionales (clave → JSON) | |
| `bienes` | código (12 dígitos), situación, estado, ubicación, usuario, titularidad, valor, `datos` (JSON), `version` | `version`: control de concurrencia optimista. |
| `movimientos` | número correlativo, tipo, fecha, registrado, usuario, anulado, `datos` (JSON con el detalle antes/después) | |
| `movimiento_bienes` | (número, código) | Kardex indexado por bien. |
| `personal`, `ubicaciones` | usuarios de bienes (DNI único) y ambientes | |
| `inventarios` | proceso, comisión, verificación, sobrantes, gabinete y resultados (JSON) | La verificación se fusiona bien por bien con `json_set`. |
| `adjuntos` | metadatos del documento firmado + SHA-256 + clave en R2 | |
| `bitacora` | fecha, usuario, acción, detalle, IP | **Triggers impiden UPDATE y DELETE.** |
| `control_concurrencia` | guardia `CHECK (ok = 1)` | Aborta la transacción si otro usuario cambió un bien. |

## 4. API (resumen)

| Método y ruta | Rol | Función |
|---|---|---|
| `GET /api/salud` | público | Detección del modo |
| `POST /api/sesion` · `GET` · `DELETE` · `POST /api/sesion/clave` | — | Ingreso, sesión, salida y cambio de clave |
| `GET /api/estado` | todos | Datos de trabajo |
| `POST /api/movimientos` | OCP | Registrar un acto (validado con `core.js`) |
| `POST /api/movimientos/:n/anular` | ADMIN | Anulación (art. 24) |
| `POST /api/movimientos/:n/adjuntos` · `GET /api/adjuntos/:id` | OCP / todos | Documento firmado (PDF, JPG o PNG; máx. 10 MB; se valida la firma binaria) |
| `PUT /api/bienes/:codigo` · `POST /api/bienes/carga` | OCP / ADMIN | Corrección (art. 25) · carga inicial |
| `PUT /api/personal` · `PUT /api/ubicaciones` | OCP | Maestros |
| `POST /api/inventarios` · `PATCH .../verificacion` · `POST .../sobrantes` · `PATCH /:id` · `POST .../cerrar` | COMISION / OCP | Inventario y supervisión |
| `PUT /api/config` · `GET/POST/PATCH /api/usuarios` · `GET /api/bitacora` · `GET /api/respaldo` | ADMIN | Administración |

## 5. Seguridad implementada

- **Autenticación:**
  - JWT HS256 firmado con el secreto `JWT_SECRETO`, en cookie `HttpOnly`, `Secure` y `SameSite=Strict`; la sesión
    dura 8 horas.
  - El primer ingreso exige cambiar la clave.
  - Política de clave: 8 caracteres o más, letras y números, y sin incluir el nombre de usuario.
  - Bloqueo de 15 minutos tras 5 intentos fallidos.
- **Autorización:** cada ruta verifica el rol en el servidor. La interfaz solo oculta botones; la seguridad real está
  en la API.
- **Integridad:**
  - El servidor revalida cada acto con `core.js`, aunque alguien se salte la interfaz.
  - Cada acto se guarda en una transacción junto con su bitácora.
  - Concurrencia optimista: el acto se rechaza con 409 si otro usuario modificó el bien.
  - Correlativos sin saltos.
- **Auditoría:** la bitácora registra usuario, acción, detalle e IP, y no se puede modificar ni borrar (triggers).
- **Navegador:**
  - CSP estricta, sin scripts en línea.
  - Cabeceras `X-Frame-Options: DENY`, `HSTS`, `nosniff` y `Referrer-Policy`.
  - Las peticiones de otro origen se rechazan (CSRF).
- **Archivos:** se acepta solo PDF, JPG o PNG verificados por su firma binaria. Se registra el SHA-256 del archivo y se
  sirven con CSP `sandbox`.
- **Cifrado:** TLS en tránsito; D1 y R2 cifran los datos en reposo (gestionado por Cloudflare).
- **Respaldos:**
  - Recuperación a un punto en el tiempo con D1 Time Travel.
  - Copia JSON semanal en R2, sin hashes de claves.
  - Descarga manual por el administrador.

## 6. Despliegue (paso a paso)

Requisitos: cuenta de Cloudflare del CLAS con el plan Workers Paid, y Node.js 20 o superior en una PC.

```bash
cd gestion-inventario
npm install
npx wrangler login                                        # abre el navegador para autorizar la cuenta del CLAS
npx wrangler d1 create gestion-inventario --location=enam # anote el database_id
#   → pegue el database_id en wrangler.toml
npx wrangler r2 bucket create gestion-inventario-archivos
npx wrangler secret put JWT_SECRETO     # pegue una cadena aleatoria de 64+ caracteres
npx wrangler secret put ADMIN_INICIAL   # clave temporal del primer usuario "admin"
npm run db:migrar                       # crea las tablas en D1
npm run desplegar                       # publica en https://gestion-inventario-clas.<cuenta>.workers.dev
```

Después del despliegue:
1. Ingrese con `admin` y la clave de `ADMIN_INICIAL`; el sistema le exigirá cambiarla.
2. En Configuración, registre los datos institucionales y cargue el inventario 2025.
3. Cree los usuarios: Control Patrimonial, Comisión de Inventario y Consulta (Gerencia o Consejo Directivo).
4. Opcional: asigne un dominio propio (por ejemplo, `inventario.clasquerencia.org.pe`) desde el panel de Cloudflare.

`location=enam` (Este de Norteamérica) es la región de D1 con menor latencia hacia Perú: D1 no tiene región en
Sudamérica. Ver el punto de protección de datos en `docs/SUSTENTO_LEGAL.md`.

## 7. Operación

| Tarea | Cómo |
|---|---|
| Desarrollo local | `cp .dev.vars.example .dev.vars && npm run db:migrar:local && npm run dev` → `http://127.0.0.1:8787` |
| Pruebas | `npm test` (reglas de negocio) |
| Actualizar a una nueva versión | `git pull && npm run db:migrar && npm run desplegar` |
| Recuperar la base a una fecha | `npx wrangler d1 time-travel restore gestion-inventario --timestamp=2026-10-20T15:00:00-05:00` |
| Ver respaldos semanales | `npx wrangler r2 object get gestion-inventario-archivos/respaldos/AAAA-MM-DD.json --file respaldo.json` |
| Monitoreo | Panel de Cloudflare → Workers → `gestion-inventario-clas` → Logs |
| Rotar el secreto de sesión | `npx wrangler secret put JWT_SECRETO` (cierra todas las sesiones) |
| Desbloquear o desactivar usuarios | Configuración → Usuarios del sistema |

## 8. Capacidad y costos

| Recurso | Uso estimado del establecimiento | Incluido en el plan |
|---|---|---|
| Peticiones | Unas 2 000 por día (5 usuarios) | 10 millones al mes (Workers Paid) |
| Tiempo de CPU por petición | Ingreso con PBKDF2: decenas de ms | Plan gratuito: 10 ms (**insuficiente para el ingreso**); Paid: 30 s |
| D1 | Menos de 50 MB (miles de bienes y actos) | 5 GB |
| R2 | 1–2 GB por año de PDF escaneados | 10 GB gratis al mes |
| **Costo** | | **USD 5 al mes** (plan Workers Paid) |

Precios y límites referenciales a la fecha de elaboración: verifíquelos en cloudflare.com antes de contratar.

## 9. Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| Reglas de negocio (`npm test`) | 21 de 21 |
| Demo funcional de 47 casos en **modo servidor** (Workers + D1 local con `wrangler dev`) | 47 de 47 |
| Demo funcional de 47 casos en **modo local** (regresión) | 47 de 47 |
| Pruebas específicas de la API: validación sin interfaz, roles, dos operadores sobre el mismo bien, 10 registros simultáneos, bloqueo por intentos, invalidación de sesiones, cookie segura, adjuntos, rechazo de archivos falsos, respaldo sin hashes, cierre de sesión | 12 de 12 |

**No probado:** el despliegue real en la cuenta de Cloudflare del CLAS, porque requiere sus credenciales. Los límites
de CPU de producción tampoco se aplican en el entorno local.
