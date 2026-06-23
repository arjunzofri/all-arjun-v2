import { neon } from "@neondatabase/serverless";
import { getComprasAnilDesde } from "@/db/vidadigital/queries";

// ponytail: pre-seed manual de bodegas. Si se agregan más, migrar a tabla.
const BODEGA_ID: Record<string, number> = {
  "Bodega 1 Vida Digital": 1,
  "Bodega 2 Vida Digital": 2,
  "Bodega Arjun": 3,
};

const SYNC_KEY = "compras-anil";

// ── Upsert de producto (compartido: sync Anil + entrada manual) ──

export async function upsertProducto(
  sql: { (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown> },
  compra: {
    codigo: string;
    detalle: string | null;
    cantcaja: number | null;
    imagenUrl: string | null;
  },
) {
  await sql`
    INSERT INTO productos (codigo, detalle, packing, imagen_url)
    VALUES (${compra.codigo}, ${compra.detalle}, ${compra.cantcaja}, ${compra.imagenUrl})
    ON CONFLICT (codigo) DO UPDATE
      SET imagen_url = COALESCE(productos.imagen_url, EXCLUDED.imagen_url)
  `;
}

// ── CTE de inserción de stock + movimiento (exportada para test) ─────

export async function insertarMovimientoSync(
  sql: { (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown> },
  params: {
    folio: string;
    codigo: string;
    cantidad: number;
    bodegaId: number;
    nroIngreso: string | null;
    fechanvt: string | null;
  },
) {
  await sql`
    WITH existing AS (
      SELECT id FROM movimientos
      WHERE folio = ${params.folio}
        AND producto_id = (SELECT id FROM productos WHERE codigo = ${params.codigo})
    ),
    stock_ok AS (
      INSERT INTO stock (producto_id, bodega_id, cantidad)
      SELECT id, ${params.bodegaId}, ${params.cantidad}
      FROM productos WHERE codigo = ${params.codigo}
        AND NOT EXISTS (SELECT 1 FROM existing)
      ON CONFLICT (producto_id, bodega_id)
      DO UPDATE SET cantidad = stock.cantidad + ${params.cantidad}
    )
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id, nro_ingreso, fecha_compra)
    SELECT ${params.folio}, id, 'entrada', ${params.cantidad}, ${params.bodegaId}, 1,
      ${params.nroIngreso ?? null},
      ${params.fechanvt ?? null}::date
    FROM productos WHERE codigo = ${params.codigo}
      AND NOT EXISTS (SELECT 1 FROM existing)
  `;
}

// ── Sync principal ────────────────────────────────────────────────────

export async function syncComprasAnil(corte: string): Promise<{
  procesadas: number;
  watermark: string;
}> {
  const sql = neon(process.env.DATABASE_URL!);

  // Defensa: validar que BODEGA_ID coincida con las filas reales en bodegas/modulos.
  // Si alguien recrea las tablas y los serials quedan desalineados, el sync
  // para con error visible en vez de insertar stock en la ubicación equivocada.
  const bodegasDb = await sql`SELECT id, nombre FROM bodegas ORDER BY id` as unknown as { id: number; nombre: string }[];
  for (const [nombre, id] of Object.entries(BODEGA_ID)) {
    const row = bodegasDb.find((r) => r.id === id);
    if (!row) {
      throw new Error(
        `Sync abortado: BODEGA_ID dice que "${nombre}" tiene id=${id}, ` +
        `pero la tabla bodegas no tiene ninguna fila con ese id. ` +
        `IDs en bodegas: [${bodegasDb.map((r) => `${r.id}=${r.nombre}`).join(", ")}]`,
      );
    }
    if (row.nombre !== nombre) {
      throw new Error(
        `Sync abortado: BODEGA_ID dice que id=${id} es "${nombre}", ` +
        `pero la tabla bodegas tiene id=${id} → "${row.nombre}". ` +
        `Las tablas pueden haberse recreado con IDs desalineados de constants.ts`,
      );
    }
  }

  const compras = await getComprasAnilDesde(corte);

  let procesadas = 0;
  let maxFecha = corte;

  for (const compra of compras) {
    const bodegaId = BODEGA_ID[compra.bodega];
    if (!bodegaId) continue; // R5: bodega desconocida → skip

    // Upsert de producto — idempotente, sin dependencia de existing
    await upsertProducto(sql, compra);

    // CTE atómica: stock + movimientos en un solo statement.
    // Si el folio ya fue procesado, WHERE NOT EXISTS bloquea ambos.
    await insertarMovimientoSync(sql, {
      folio: compra.folio,
      codigo: compra.codigo,
      cantidad: compra.cantidad,
      bodegaId,
      nroIngreso: compra.nroIngreso,
      fechanvt: compra.fechanvt,
    });

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
