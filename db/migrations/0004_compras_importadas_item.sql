-- inv-22-item: conservar cada línea de compra con su item (kdocitem).
-- Idempotente: segura de aplicar más de una vez.
-- Aplicar solo en TEST por ahora; en producción aplicar 0003+0004.

ALTER TABLE compras_importadas ADD COLUMN IF NOT EXISTS item INTEGER;

ALTER TABLE compras_importadas
    DROP CONSTRAINT IF EXISTS uq_compras_importadas_folio_producto_bodega;

ALTER TABLE compras_importadas
    ADD CONSTRAINT uq_compras_importadas_folio_producto_bodega
    UNIQUE NULLS NOT DISTINCT (folio, producto_id, bodega_codigo, item);
