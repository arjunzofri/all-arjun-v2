import { neon } from "@neondatabase/serverless";
import { getComprasAnilDesde } from "@/db/vidadigital/queries";

// ponytail: pre-seed manual de bodegas. Si se agregan más, migrar a tabla.
const BODEGA_ID: Record<string, number> = {
  "Bodega 1 Vida Digital": 1,
  "Bodega 2 Vida Digital": 2,
  "Bodega Arjun": 3,
};

const SYNC_KEY = "compras-anil";

export async function syncComprasAnil(corte: string): Promise<{
  procesadas: number;
  watermark: string;
}> {
  const sql = neon(process.env.DATABASE_URL!);
  const compras = await getComprasAnilDesde(corte);

  let procesadas = 0;
  let maxFecha = corte;

  for (const compra of compras) {
    const bodegaId = BODEGA_ID[compra.bodega];
    if (!bodegaId) continue; // R5: bodega desconocida → skip

    // CTE atómica en un solo statement — sin leer-calcular-escribir.
    // Si el folio ya fue procesado, WHERE NOT EXISTS bloquea todo.
    await sql`
      WITH existing AS (
        SELECT id FROM movimientos
        WHERE folio = ${compra.folio}
          AND producto_id = (SELECT id FROM productos WHERE codigo = ${compra.codigo})
      ),
      producto_ok AS (
        INSERT INTO productos (codigo, detalle, packing)
        VALUES (${compra.codigo}, ${compra.detalle}, ${compra.cantcaja})
        ON CONFLICT (codigo) DO NOTHING
      ),
      stock_ok AS (
        INSERT INTO stock (producto_id, bodega_id, cantidad)
        SELECT id, ${bodegaId}, ${compra.cantidad}
        FROM productos WHERE codigo = ${compra.codigo}
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        ON CONFLICT (producto_id, bodega_id)
        DO UPDATE SET cantidad = stock.cantidad + ${compra.cantidad}
      )
      INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
      SELECT ${compra.folio}, id, 'entrada', ${compra.cantidad}, ${bodegaId}, 1
      FROM productos WHERE codigo = ${compra.codigo}
      WHERE NOT EXISTS (SELECT 1 FROM existing)
    `;

    procesadas++;
    if (compra.fechanvt && compra.fechanvt > maxFecha) {
      maxFecha = compra.fechanvt;
    }
  }

  // Actualizar watermark
  await sql`
    INSERT INTO sync_watermark (key, value)
    VALUES (${SYNC_KEY}, ${maxFecha})
    ON CONFLICT (key) DO UPDATE SET value = ${maxFecha}
  `;

  return { procesadas, watermark: maxFecha };
}
