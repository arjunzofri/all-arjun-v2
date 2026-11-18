-- inv-02: persistencia append-only de conteos de inventario físico.
-- Idempotente: segura de aplicar más de una vez (solo TEST por ahora).

CREATE TABLE IF NOT EXISTS conteos_inventario (
    id BIGSERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    bodega SMALLINT NOT NULL,
    planta TEXT NOT NULL DEFAULT '',
    pasillo TEXT NOT NULL,
    posicion TEXT NOT NULL,
    cantidad INTEGER NOT NULL CONSTRAINT ck_conteos_cantidad CHECK (cantidad >= 0),
    usuario_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    idempotency_key TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_conteos_idempotencia UNIQUE (idempotency_key),
    CONSTRAINT ck_conteos_ubicacion CHECK (
        pasillo IS NOT NULL AND posicion IS NOT NULL AND posicion IN ('F', 'M', 'P') AND (
            (bodega = 1 AND planta = '' AND pasillo IN ('A1', 'A2', 'A3', 'A4'))
            OR (bodega = 2 AND planta IN ('ARRIBA', 'ABAJO') AND pasillo IN ('IZQUIERDA', 'DERECHA'))
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_conteos_inventario_pos
    ON conteos_inventario (producto_id, bodega, planta, pasillo, posicion, id);

CREATE OR REPLACE VIEW conteos_vigentes AS
SELECT DISTINCT ON (producto_id, bodega, planta, pasillo, posicion) *
FROM conteos_inventario
ORDER BY producto_id, bodega, planta, pasillo, posicion, id DESC;
