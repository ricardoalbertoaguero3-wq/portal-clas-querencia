# Portal de Documentos de Gestión — CLAS Agregado La Querencia

Portal institucional de solo lectura para consultar los documentos de gestión
mensuales del CLAS Agregado La Querencia. Es un sitio estático, sin base de
datos ni servidor propio. Destino previsto: **Cloudflare Pages + Cloudflare
Access** (acceso por correo individual). Mientras no se migre, sigue
funcionando en GitHub Pages con la clave compartida.

## Estructura del repositorio

```
/
├── index.html          ← el portal completo (HTML + CSS + JS, un solo archivo)
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

- **Acceso — dos modos, detectados automáticamente al cargar:**
  - **Con Cloudflare Access** (recomendado): Cloudflare pide el correo y
    envía un código de un solo uso antes de entregar cualquier archivo,
    incluidos los PDF. El portal lee el correo verificado, entra directo
    (sin clave), lo muestra en la cabecera y "Cerrar sesión" cierra la
    sesión de Access.
  - **Sin Access** (GitHub Pages u otro hosting): pantalla con clave
    compartida (variable `PASSWORD` en `index.html`; no se anota en este
    README). La clave queda visible en el código fuente y los PDF se pueden
    abrir por su dirección directa: es una barrera disuasoria, no un
    control de acceso real.
- **Visor:** cada documento se abre en un visor propio (PDF.js), página por
  página, también en celulares, con zoom (− / +), flechas del teclado y
  deslizamiento lateral en pantallas táctiles. No hay botón de descarga ni
  impresión porque el visor es código propio del portal.
- **Marca de agua:** con Access, cada página lleva el correo de quien la
  visualiza y la fecha, de modo que una captura de pantalla identifica a su
  autor. Sin Access, lleva un texto institucional genérico.
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
- Antes de desplegar el Worker, definir `UPLOAD_SECRET` distinto de la clave
  del portal y ajustar `index.html` en consecuencia: hoy el portal envía la
  misma clave de acceso como permiso de subida y borrado.

## Cómo editar la lista de jefes y jefas de servicio

Mismo archivo `index.html`, bloque `DATA.jefes`, un poco más abajo de
`DATA.categorias`.

## Migración a Cloudflare Pages + Cloudflare Access

Gratuito hasta 50 usuarios. El código del portal ya está preparado: al
activarse Access, deja de pedir la clave y usa el correo verificado.

### 1. Reunir la lista de correos autorizados
Un correo por persona (institucional o personal). Esta lista es el control
de acceso: quien no figure no podrá entrar.

### 2. Publicar el portal en Cloudflare Pages
1. Crear una cuenta en https://dash.cloudflare.com.
2. **Workers & Pages → Create → Pages → Connect to Git** y elegir este
   repositorio (`portal-clas-querencia`), rama de producción `main`.
3. Configuración de compilación: *Framework preset* **None**, *Build
   command* vacío, *Build output directory* `/`.
4. Al terminar, el portal queda en `https://<proyecto>.pages.dev`. Probar
   que abre (todavía con la pantalla de clave).

### 3. Proteger el portal con Cloudflare Access
1. Entrar a **Zero Trust** (menú lateral del panel de Cloudflare), elegir un
   nombre de equipo y el plan **Free**. Es posible que solicite registrar un
   medio de pago aunque el plan Free no cobre.
2. **Settings → Authentication → Login methods:** verificar que esté
   activo **One-time PIN** (código por correo).
3. **Access → Applications → Add an application → Self-hosted:**
   - *Application domain:* `<proyecto>.pages.dev`.
   - Agregar un segundo dominio `*.<proyecto>.pages.dev`, para que también
     queden protegidas las versiones de prueba que Cloudflare crea por cada
     rama.
   - *Session duration:* por ejemplo 7 días.
4. Crear la política: *Action* **Allow**, regla **Emails** con la lista
   exacta del paso 1.
5. Probar en una ventana privada: debe pedir el correo, enviar el código y,
   al ingresar, mostrar el portal con el correo en la cabecera y en la
   marca de agua del visor.

### 4. Cerrar el acceso anterior
1. En GitHub, **Settings → General → Danger Zone → Change visibility →
   Private**. En una cuenta gratuita esto desactiva GitHub Pages; si sigue
   activo, desactivarlo en **Settings → Pages**. Cloudflare Pages sigue
   publicando desde el repositorio privado.
2. Verificar que la dirección antigua de GitHub Pages ya no responde.
3. Comunicar al personal la nueva dirección. La clave compartida queda solo
   como respaldo si algún día el portal se publica sin Access.

### Mantenimiento
- **Alta o baja de personal:** editar la lista de correos de la política en
  Zero Trust. La baja es inmediata.
- **Registro de ingresos:** Zero Trust → Logs → Access muestra quién entró
  y cuándo.

## Aviso legal

Documentos protegidos por derecho de autor (D. Leg. N° 822, Perú).
Uso estrictamente institucional. Portal elaborado por Lic. Adm. Ricardo A.
Agüero Angulo, Área de Administración del CLAS Agregado La Querencia.
