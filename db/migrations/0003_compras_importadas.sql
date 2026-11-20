-- inv-22a: ledger de compras importadas en modo inventario (ON).
-- No escribe stock ni movimientos. Idempotente: segura de aplicar más de una vez.
-- Aplicar solo en TEST por ahora; producción tras UAT/Señal 3.

CREATE TABLE IF NOT EXISTS compras_importadas (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(50) NOT NULL,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    bodega_codigo TEXT,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC(10, 4),
    fecha_nota DATE,
    fecha_confirmacion DATE NOT NULL,
    visaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_compras_importadas_folio_producto_bodega
        UNIQUE NULLS NOT DISTINCT (folio, producto_id, bodega_codigo)
);

CREATE INDEX IF NOT EXISTS idx_compras_importadas_fecha
    ON compras_importadas (fecha_confirmacion);
