# Portal de Documentos de Gestión — CLAS Agregado La Querencia

Portal institucional de solo lectura para consultar los documentos de gestión
mensuales del CLAS Agregado La Querencia. Es un sitio estático, sin base de
datos. Se publica en **Cloudflare Pages**; el ingreso tiene dos pasos:

1. **Correo + código:** Cloudflare Access pide el correo y envía un código de
   un solo uso. Solo entran los correos de la lista autorizada.
2. **Clave institucional:** se valida en el servidor (Pages Functions). La
   clave no figura en el código de la página.

Los PDF solo se entregan a quien completó ambos pasos. Fuera de Cloudflare
Pages (por ejemplo, GitHub Pages o abriendo el archivo en local) el portal
no permite ingresar.

## Estructura del repositorio

```
/
├── index.html          ← el portal completo (HTML + CSS + JS, un solo archivo)
├── functions/           ← funciones del servidor (Cloudflare Pages Functions)
│   ├── _middleware.js   ← exige correo + clave para todo salvo la portada y el logo
│   └── api/             ← session.js, login.js, logout.js
├── lib/auth.js          ← verificación del JWT de Access y sesión firmada
├── worker/index.js      ← API opcional en Cloudflare Worker + R2 (aún no desplegada)
├── wrangler.toml        ← configuración del Worker
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
  - Cloudflare Access verifica el correo (código de un solo uso). El servidor
    comprueba la firma de ese ingreso (JWT) con las variables
    `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD`.
  - Luego el portal pide la clave institucional y la envía a `/api/login`,
    que la compara con `PORTAL_PASSWORD`. Si es correcta, entrega una sesión
    firmada (cookie HttpOnly) válida por **8 horas** y ligada a ese correo.
  - Cada solicitud de un PDF u otro archivo pasa por `functions/_middleware.js`,
    que exige correo verificado + sesión del mismo correo. Sin ambos responde
    401. Solo la portada (`/`) y el logo son públicos.
  - "Cerrar sesión" borra la sesión del portal y la de Access.
  - Una clave incorrecta demora la respuesta casi un segundo, para frenar
    intentos repetidos.
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

## Cómo agregar o reemplazar un documento

1. Sube el PDF nuevo a la carpeta `docs/` (nombre de archivo sin espacios,
   por ejemplo `informe-situacion-institucional-2026.pdf`).
2. Abre `index.html`, busca el bloque `DATA.categorias` (dentro de la
   etiqueta `<script>`, cerca del final del archivo).
3. Agrega o edita la entrada correspondiente:
   ```js
   { titulo:"Nombre del documento", descripcion:"Breve descripción.",
     periodo:"2026", file:"docs/nombre-del-archivo.pdf" }
   ```
   Si el documento aún no está disponible, usa `pending:true` en lugar de
   `file:"..."` — aparecerá como "Pendiente de carga" y no será clickeable.
4. Sube los cambios al repositorio (commit en la rama `main`). El sitio se
   actualiza automáticamente en uno o dos minutos.

## Importación de documentos (solo administración)

El botón **"+ Importar"** de cada sección está oculto para el personal. Se
muestra solo al abrir el portal con `?admin` al final de la dirección (por
ejemplo `https://…/?admin`). Con `?admin` también aparece la nota para
administración al pie de la página.

- Mientras el Worker no esté desplegado (`WORKER_URL` vacío en `index.html`),
  el archivo importado se guarda **solo en el navegador de quien lo importa**
  (aparece con la etiqueta "local"); nadie más lo ve. Para publicarlo para
  todos, seguir "Cómo agregar o reemplazar un documento".
- Si se despliega el Worker, definir su secreto `UPLOAD_SECRET` (distinto de
  `PORTAL_PASSWORD`). El portal lo pide la primera vez que se sube o borra un
  documento en la nube y no lo guarda.

## Cómo editar la lista de jefes y jefas de servicio

Mismo archivo `index.html`, bloque `DATA.jefes`, un poco más abajo de
`DATA.categorias`.

## Configuración en Cloudflare

Gratuito hasta 50 usuarios. El proyecto de Cloudflare Pages ya está conectado
a este repositorio (rama de producción `main`; *Framework preset* None, sin
comando de compilación, directorio de salida `/`).

### 1. Aplicación de Access (correo + código)
1. **Zero Trust → Settings → Authentication → Login methods:** activo
   **One-time PIN**.
2. **Zero Trust → Access → Applications → Self-hosted** (crear o editar):
   - Dominio 1: subdominio `portal-clas-querencia`, dominio `pages.dev`,
     **ruta vacía**. Si se pone una ruta (p. ej. `docs`), la portada queda
     fuera de Access y nadie podrá ingresar.
   - Dominio 2: subdominio `*.portal-clas-querencia`, dominio `pages.dev`,
     ruta vacía (versiones de prueba de cada rama).
   - *Session duration:* por ejemplo 24 horas.
3. Política: *Action* **Allow**, regla **Emails** con la lista exacta de
   correos autorizados.
4. En la ficha de la aplicación, copiar el **Application Audience (AUD)
   Tag**. Anotar también el **nombre de equipo** de Zero Trust (Settings →
   Custom Pages o Settings → General): el dominio es
   `<equipo>.cloudflareaccess.com`.
5. Opcional, para que la pantalla de Cloudflare lleve la identidad del CLAS:
   en **Settings → Custom Pages → Login page** (el nombre del menú puede
   variar) poner el nombre "CLAS Agregado La Querencia", el logo
   (`https://portal-clas-querencia.pages.dev/docs/logo.png`) y el color
   `#201f1d`.

### 2. Variables del servidor (clave y verificación)
En **Workers & Pages → portal-clas-querencia → Settings → Variables and
Secrets**, entorno **Production** (y también **Preview** si se usan las
versiones de prueba):

| Variable | Tipo | Valor |
|---|---|---|
| `ACCESS_TEAM_DOMAIN` | Texto | `<equipo>.cloudflareaccess.com` |
| `ACCESS_AUD` | Texto | el AUD Tag del paso 1.4 |
| `PORTAL_PASSWORD` | **Secreto** | la clave institucional (nueva; la anterior estuvo publicada en el código) |
| `SESSION_SECRET` | **Secreto** | cadena aleatoria de 40 caracteres o más (no hace falta recordarla) |

Las variables se aplican en el **siguiente despliegue**: después de
guardarlas, ir a **Deployments** y usar **Retry deployment** en el último, o
hacer cualquier commit. Si falta alguna, el portal muestra "El portal aún no
está configurado" y no entrega ningún PDF.

### 3. Comprobación (en una ventana privada)
1. Abrir `https://portal-clas-querencia.pages.dev`: Cloudflare pide el correo
   y envía el código.
2. Tras el código, el portal muestra "Correo verificado: …" y pide la clave.
3. Con la clave correcta se abre el portal, con el correo en la cabecera y en
   la marca de agua.
4. Con un correo que no está en la lista, Cloudflare niega el acceso.

### 4. Cerrar el acceso anterior
En GitHub, **Settings → General → Danger Zone → Change visibility →
Private**. En una cuenta gratuita esto desactiva GitHub Pages (si no, hacerlo
en **Settings → Pages**). Cloudflare Pages sigue publicando desde el
repositorio privado.

### Mantenimiento
- **Alta o baja de personal:** editar la lista de correos de la política en
  Zero Trust. La baja es inmediata.
- **Cambio de clave:** cambiar `PORTAL_PASSWORD` y volver a desplegar. Todas
  las sesiones abiertas se cierran y se pide la clave nueva.
- **Registro de ingresos:** Zero Trust → Logs → Access muestra quién entró
  y cuándo.

## Aviso legal

Documentos protegidos por derecho de autor (D. Leg. N° 822, Perú).
Uso estrictamente institucional. Portal elaborado por Lic. Adm. Ricardo A.
Agüero Angulo, Área de Administración del CLAS Agregado La Querencia.
