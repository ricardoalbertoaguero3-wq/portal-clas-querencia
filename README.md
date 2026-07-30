# Portal de Documentos de Gestión — CLAS Agregado La Querencia

Portal institucional de solo lectura para consultar los documentos de gestión
mensuales del CLAS Agregado La Querencia. Publicado como sitio estático
(GitHub Pages) — sin base de datos ni servidor propio.

## Estructura del repositorio

```
/
├── index.html          ← el portal completo (HTML + CSS + JS, un solo archivo)
└── docs/                ← los PDF que se muestran en el portal
    ├── asis-2026.pdf
    ├── inventario-2025.pdf
    ├── plan-mantenimiento-2026.pdf
    ├── rol-personal-agosto-2026.pdf
    └── morbilidad-clas-agregado-i-sem-2026.pdf
```

## Cómo funciona

- **Acceso:** pantalla con clave institucional (actualmente `Querencia2026`,
  editable en el archivo `index.html`, variable `PASSWORD`).
- **Visor:** cada documento se abre en un visor propio (PDF.js), página por
  página, con marca de agua institucional superpuesta. No hay botón de
  descarga ni impresión porque el visor es código propio del portal.
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
4. Sube los cambios al repositorio (commit). GitHub Pages actualiza el
   sitio automáticamente en uno o dos minutos.

## Documentos pendientes de cargar

- Informe de Situación Institucional
- Informe de Morbilidad y Producción — C.S. La Querencia (I Semestre 2026)

## Cómo editar la lista de jefes y jefas de servicio

Mismo archivo `index.html`, bloque `DATA.jefes`, un poco más abajo de
`DATA.categorias`.

## Pendiente: verificación por correo (Cloudflare Access)

Se decidió reforzar el acceso con verificación por correo institucional
individual en vez de (o además de) la clave compartida, usando
**Cloudflare Pages + Cloudflare Access** (gratuito hasta 50 usuarios).

Pasos, una vez reunida la lista de correos del personal autorizado:

1. Crear cuenta en Cloudflare y conectar este mismo repositorio de GitHub
   como un proyecto de **Cloudflare Pages** (deploy automático, igual que
   GitHub Pages).
2. En **Cloudflare Zero Trust → Access → Applications**, crear una
   aplicación apuntando al dominio de Cloudflare Pages.
3. Crear una política de acceso con la lista de correos institucionales
   autorizados (regla "Emails" con la lista exacta).
4. Cada persona autorizada recibirá un código de un solo uso por correo
   para entrar — sin necesidad de recordar ninguna clave.
5. Opcional: una vez validado, se puede retirar la pantalla de clave del
   portal (`index.html`), dejando solo la verificación de Cloudflare.

## Aviso legal

Documentos protegidos por derecho de autor (D. Leg. N° 822, Perú).
Uso estrictamente institucional. Portal elaborado por Lic. Adm. Ricardo A.
Agüero Angulo, Área de Administración del CLAS Agregado La Querencia.
