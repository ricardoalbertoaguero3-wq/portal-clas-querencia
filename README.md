# Portal de Documentos de Gestión — CLAS Agregado La Querencia

Portal institucional de solo lectura para consultar los documentos de gestión
mensuales del CLAS Agregado La Querencia. Es un sitio estático, sin base de
datos. Se publica en **Cloudflare Pages**; el ingreso tiene tres pasos:

1. **Correo:** la persona escribe su correo. Si está en la lista autorizada,
   recibe un código de 6 dígitos enviado desde claslaquerencia@gmail.com.
2. **Código:** lo ingresa en el portal (vence en 10 minutos, 5 intentos).
3. **Clave institucional:** se valida en el servidor. La clave no figura en
   el código de la página.

Los PDF solo se entregan a quien completó los tres pasos. Fuera de Cloudflare
Pages (por ejemplo, GitHub Pages o abriendo el archivo en local) el portal
no permite ingresar.

## Estructura del repositorio

```
/
├── index.html          ← el portal completo (HTML + CSS + JS, un solo archivo)
├── functions/           ← funciones del servidor (Cloudflare Pages Functions)
│   ├── _middleware.js   ← exige sesión para todo salvo la portada, el logo y la API de ingreso
│   └── api/             ← ingreso (session, request-code, verify-code, login, logout),
│                          catálogo, archivos subidos (file/) y administración (admin/)
├── lib/auth.js          ← lista autorizada, códigos, límites de intentos y sesiones firmadas
├── lib/catalog.js       ← catálogo de documentos (inicial y edición desde el panel)
├── apps-script/Code.gs  ← script de Google que envía los códigos por correo
├── _headers             ← cabeceras HTTP para Cloudflare Pages (GitHub Pages lo ignora)
└── docs/                ← los PDF que se muestran en el portal
    ├── logo.png
    ├── plan-mantenimiento-2026.pdf
    ├── inventario-2025.pdf
    ├── informe-situacion-institucional-2025.pdf
    ├── asis-2026.pdf
    ├── morbilidad-clas-agregado-i-sem-2026.pdf
    ├── morbilidad-cs-querencia-i-sem-2026.pdf
    ├── morbilidad-cs-querencia-julio-2026.pdf
    └── rol-personal-agosto-2026.pdf
```

## Cómo funciona

- **Acceso:**
  - `/api/request-code`: si el correo está en `ALLOWED_EMAILS`, genera un
    código de 6 dígitos, guarda solo su huella (hash) en Cloudflare KV y lo
    envía mediante Google Apps Script. Ante un correo no autorizado responde
    igual, sin enviar nada, para no revelar quién está en la lista.
  - Límites: un envío por minuto y 5 por hora por correo, 20 por hora por
    conexión. El código vence en 10 minutos y admite 5 intentos.
  - `/api/verify-code`: valida el código y habilita el paso de la clave por
    15 minutos.
  - `/api/login`: compara la clave con `PORTAL_PASSWORD` (10 intentos por
    hora por correo) y entrega una sesión firmada (cookie HttpOnly) de
    **8 horas**, ligada al correo. Registra el ingreso en KV.
  - Cada solicitud de un PDF u otro archivo pasa por
    `functions/_middleware.js`, que exige sesión vigente de un correo que
    siga en la lista. Sin ella responde 401.
  - "Cerrar sesión" borra la sesión; para volver a entrar se repiten los
    tres pasos.
- **Visor:** cada documento se abre en un visor propio (PDF.js), página por
  página, también en celulares, con zoom (− / +), flechas del teclado y
  deslizamiento lateral en pantallas táctiles. No hay botón de descarga ni
  impresión porque el visor es código propio del portal.
- **Marca de agua:** cada página lleva el correo de quien la visualiza y la
  fecha, de modo que una captura de pantalla identifica a su autor.
- **Protecciones del navegador:** clic derecho deshabilitado, atajos
  Ctrl+P / Ctrl+S bloqueados, impresión del navegador anulada por CSS.
  Estas son medidas disuasorias, no infalibles ante alguien decidido a
  hacer una captura de pantalla — por eso se complementan con la marca de
  agua y el aviso legal.

## Administración de documentos (desde el portal)

Los correos incluidos en la variable `ADMIN_EMAILS` ven el botón
**Administrar** en la cabecera del portal. Al pulsarlo aparece la barra de
administración y, junto a cada sección y documento, los botones ✎ ↑ ↓ 🗑.
Los cambios se publican al instante para todo el personal; no hace falta
tocar GitHub ni el código.

| Tarea | Cómo |
|---|---|
| Subir documentos | **⬆ Subir documentos** (o **+ Subir aquí** en una sección) → arrastrar uno o varios PDF → revisar título, período y sección de cada uno → **Publicar** |
| Editar título, descripción o período | ✎ en el documento |
| Mover a otra sección | ✎ en el documento → elegir otra **Sección** |
| Ordenar | ↑ ↓ en el documento o en la sección |
| Quitar un documento | 🗑 en el documento (pide confirmación) |
| Crear, renombrar o eliminar secciones | **+ Nueva sección**; ✎ y 🗑 junto al nombre (solo se elimina una sección vacía) |
| Lista de jefes de servicio | **Editar jefes de servicio** (una línea por servicio: `Servicio \| Nombre`) |
| Ver quién ingresó | **Registro de ingresos** (últimos 200, se conservan 90 días) |

Detalles:
- **Archivos:** solo PDF, de hasta 25 MB cada uno. Si un PDF pesa más,
  comprimirlo antes (por ejemplo con "Guardar como PDF reducido").
- **Datos que se completan solos:** el título sale del nombre del archivo y
  el período también, si el nombre trae mes y año (`rol_setiembre-2026.pdf`
  → "Setiembre 2026"). Si no, se usa el mes actual. Ambos se pueden
  corregir antes de publicar.
- **Etiqueta "Nuevo":** los documentos subidos la llevan durante 15 días.
- **Al quitar un documento:** un PDF subido desde el portal se borra de forma
  permanente. Uno del repositorio (carpeta `docs/`) solo deja de listarse y
  el archivo se conserva.
- **Varios administradores a la vez:** si dos personas editan al mismo
  tiempo, el portal avisa y recarga la lista para no pisar cambios.
- **Dónde se guarda:** el catálogo y los PDF subidos quedan en Cloudflare KV
  (`portal-clas-auth`), dentro del plan gratuito (1 GB de almacenamiento).

### Alternativa manual (repositorio)
Los documentos iniciales están en `docs/` y en el catálogo inicial de
`lib/catalog.js`. Ese catálogo solo se usa mientras nadie haya hecho cambios
desde el panel; después manda el catálogo guardado en KV. Por eso, para
cualquier documento nuevo conviene usar el panel.

## Configuración (una sola vez)

Todo es gratuito y no requiere tarjeta. Se trabaja con la cuenta
**claslaquerencia@gmail.com**, tanto en Google como en Cloudflare (es la
cuenta donde está el proyecto `portal-clas-querencia` de Cloudflare Pages).
Cloudflare Zero Trust / Access **no** se usa.

Antes de empezar, generar el **secreto del envío de correos**: en Chrome
pulsar F12 → pestaña *Console*, escribir `crypto.randomUUID()` y Enter
(si Chrome no deja pegar, escribir antes `allow pasting`). Copiar el
resultado sin comillas. Repetir para obtener un segundo valor, que será el
**secreto de sesión**.

### 1. Envío de códigos (Google Apps Script)
1. Con claslaquerencia@gmail.com abrir https://script.google.com →
   **Nuevo proyecto**. Nombrarlo "Portal CLAS - códigos".
2. Borrar el contenido del editor y pegar el de `apps-script/Code.gs` de
   este repositorio.
3. En la línea `const SECRET = '…'` reemplazar el texto entre comillas por el
   secreto del envío de correos. Guardar (ícono de disco).
4. En la barra superior elegir la función **probarEnvio** → **Ejecutar**.
   Google pedirá permisos: *Revisar permisos* → elegir la cuenta → si
   aparece "Google no verificó esta app", *Configuración avanzada* → *Ir a
   Portal CLAS - códigos* → **Permitir**. Debe llegar un correo de prueba a
   claslaquerencia@gmail.com.
5. **Implementar → Nueva implementación** → tipo **Aplicación web**:
   *Ejecutar como:* **Yo**; *Quién tiene acceso:* **Cualquier usuario** →
   **Implementar**. Copiar la **URL de la aplicación web** (termina en
   `/exec`).

Si más adelante se modifica el script: *Implementar → Gestionar
implementaciones* → lápiz → *Versión: Nueva versión* → Implementar (la URL
no cambia).

### 2. Almacenamiento de códigos (Cloudflare KV)
1. En https://dash.cloudflare.com (cuenta claslaquerencia@gmail.com):
   **Storage & databases → Workers KV → Create instance** (o *Create
   namespace*), nombre `portal-clas-auth`.
2. **Compute → Workers & Pages → portal-clas-querencia → Settings →
   Bindings → Add → KV namespace**: *Variable name* `AUTH_KV`, *KV
   namespace* `portal-clas-auth`. Hacerlo en **Production** y en
   **Preview**.

### 3. Variables del portal
En **portal-clas-querencia → Settings → Variables and Secrets**, en
**Production** y en **Preview**:

| Variable | Tipo | Valor |
|---|---|---|
| `ALLOWED_EMAILS` | Texto | correos autorizados separados por comas, p. ej. `persona1@gmail.com, persona2@gmail.com` |
| `ADMIN_EMAILS` | Texto | correos que pueden administrar documentos (deben estar también en `ALLOWED_EMAILS`) |
| `PORTAL_PASSWORD` | **Secreto** | la clave institucional (nueva; la anterior estuvo publicada en el código) |
| `SESSION_SECRET` | **Secreto** | el secreto de sesión |
| `MAIL_WEBHOOK_URL` | Texto | la URL `/exec` del paso 1.5 |
| `MAIL_WEBHOOK_SECRET` | **Secreto** | el secreto del envío de correos (el mismo del paso 1.3) |

### 4. Aplicar y probar
1. **Deployments** → en el último despliegue, menú **⋯ → Retry
   deployment** (las variables y el KV solo se aplican en un despliegue
   nuevo).
2. En una ventana privada abrir el portal: pedir el código con un correo de
   la lista, ingresarlo y luego la clave. Debe abrirse el portal con el
   correo en la cabecera y en la marca de agua.
3. Si aparece "El portal aún no está configurado", falta una variable o el
   enlace `AUTH_KV`. Si aparece "No se pudo enviar el código", revisar la URL
   y que el secreto sea idéntico en Apps Script y en `MAIL_WEBHOOK_SECRET`.

### 5. Cerrar el acceso anterior
En GitHub, **Settings → General → Danger Zone → Change visibility →
Private**. En una cuenta gratuita esto desactiva GitHub Pages (si no, hacerlo
en **Settings → Pages**). Cloudflare Pages sigue publicando desde el
repositorio privado.

### Mantenimiento
- **Alta o baja de personal:** editar `ALLOWED_EMAILS` y hacer *Retry
  deployment*. Quien salga de la lista pierde el acceso en su siguiente
  acción, aunque tenga la sesión abierta.
- **Cambio de clave:** cambiar `PORTAL_PASSWORD` y hacer *Retry
  deployment*. Todas las sesiones se cierran.
- **Registro de ingresos:** en el portal, **Administrar → Registro de
  ingresos** (fecha, hora y correo de cada ingreso; se conservan 90 días).
- **Límite de envío:** Gmail permite unos 100 correos al día desde Apps
  Script. Cada ingreso usa uno (la sesión dura 8 horas).

## Aviso legal

Documentos protegidos por derecho de autor (D. Leg. N° 822, Perú).
Uso estrictamente institucional. Portal elaborado por Lic. Adm. Ricardo A.
Agüero Angulo, Área de Administración del CLAS Agregado La Querencia.
