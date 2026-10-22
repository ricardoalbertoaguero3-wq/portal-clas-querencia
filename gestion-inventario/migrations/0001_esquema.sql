-- =====================================================================
-- Gestión de Inventario — CLAS Agregado La Querencia
-- Esquema de base de datos (Cloudflare D1 / SQLite)
-- Directiva N° 0006-2021-EF/54.01 y D.S. N° 017-2008-SA
-- =====================================================================

-- Usuarios del sistema (roles: ADMIN, PATRIMONIO, COMISION, CONSULTA)
CREATE TABLE usuarios (
  usuario            TEXT PRIMARY KEY,
  nombre             TEXT NOT NULL,
  rol                TEXT NOT NULL CHECK (rol IN ('ADMIN','PATRIMONIO','COMISION','CONSULTA')),
  hash               TEXT NOT NULL,            -- PBKDF2-SHA256
  sal                TEXT NOT NULL,
  iteraciones        INTEGER NOT NULL,
  debe_cambiar       INTEGER NOT NULL DEFAULT 1,
  activo             INTEGER NOT NULL DEFAULT 1,
  intentos_fallidos  INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta    TEXT,
  version_sesion     INTEGER NOT NULL DEFAULT 1, -- invalida los tokens al cambiar clave o desactivar
  creado             TEXT NOT NULL
);

CREATE TABLE config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL                           -- JSON
);

-- Registro patrimonial (art. 22). Columnas de consulta + registro completo en JSON.
CREATE TABLE bienes (
  codigo       TEXT PRIMARY KEY CHECK (length(codigo) = 12),
  descripcion  TEXT NOT NULL,
  situacion    TEXT NOT NULL,
  estado       TEXT NOT NULL,
  ubicacion    TEXT,
  responsable  TEXT,
  origen       TEXT,
  valor        REAL NOT NULL DEFAULT 0,
  datos        TEXT NOT NULL,                   -- JSON del bien
  version      INTEGER NOT NULL DEFAULT 1,      -- control de concurrencia optimista
  actualizado  TEXT NOT NULL
);
CREATE INDEX ix_bienes_situacion ON bienes (situacion);
CREATE INDEX ix_bienes_ubicacion ON bienes (ubicacion);
CREATE INDEX ix_bienes_responsable ON bienes (responsable);

-- Actos (movimientos) numerados PREF-AAAA-NNNN
CREATE TABLE movimientos (
  numero      TEXT PRIMARY KEY,
  tipo        TEXT NOT NULL,
  fecha       TEXT NOT NULL,
  registrado  TEXT NOT NULL,
  usuario     TEXT NOT NULL,
  anulado     INTEGER NOT NULL DEFAULT 0,
  datos       TEXT NOT NULL                     -- JSON del acto (incluye detalle antes/después)
);
CREATE INDEX ix_mov_tipo_fecha ON movimientos (tipo, fecha);

-- Kardex: relación acto ↔ bien
CREATE TABLE movimiento_bienes (
  numero  TEXT NOT NULL REFERENCES movimientos (numero),
  codigo  TEXT NOT NULL,
  PRIMARY KEY (numero, codigo)
);
CREATE INDEX ix_movbien_codigo ON movimiento_bienes (codigo);

CREATE TABLE personal (
  id       TEXT PRIMARY KEY,
  dni      TEXT NOT NULL UNIQUE,
  nombres  TEXT NOT NULL,
  activo   INTEGER NOT NULL DEFAULT 1,
  datos    TEXT NOT NULL
);

CREATE TABLE ubicaciones (
  nombre  TEXT PRIMARY KEY,
  piso    TEXT,
  activo  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE inventarios (
  id      TEXT PRIMARY KEY,
  tipo    TEXT NOT NULL,
  anio    INTEGER NOT NULL,
  estado  TEXT NOT NULL,
  datos   TEXT NOT NULL                          -- JSON: comisión, verificación, sobrantes, gabinete
);

-- Documentos firmados escaneados (en R2)
CREATE TABLE adjuntos (
  id           TEXT PRIMARY KEY,
  numero       TEXT NOT NULL REFERENCES movimientos (numero),
  nombre       TEXT NOT NULL,
  descripcion  TEXT,
  tipo         TEXT NOT NULL,
  tamano       INTEGER NOT NULL,
  r2_key       TEXT NOT NULL,
  sha256       TEXT NOT NULL,
  subido_por   TEXT NOT NULL,
  fecha        TEXT NOT NULL
);
CREATE INDEX ix_adjuntos_numero ON adjuntos (numero);

-- Bitácora de auditoría: solo inserción (los triggers impiden modificarla o borrarla)
CREATE TABLE bitacora (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha    TEXT NOT NULL,
  usuario  TEXT NOT NULL,
  accion   TEXT NOT NULL,
  detalle  TEXT,
  ip       TEXT
);
CREATE TRIGGER bitacora_sin_update BEFORE UPDATE ON bitacora BEGIN SELECT RAISE(ABORT, 'La bitácora no se modifica'); END;
CREATE TRIGGER bitacora_sin_delete BEFORE DELETE ON bitacora BEGIN SELECT RAISE(ABORT, 'La bitácora no se elimina'); END;

-- Control de concurrencia: una fila con ok = 0 aborta la transacción completa
CREATE TABLE control_concurrencia (ok INTEGER NOT NULL CHECK (ok = 1));
