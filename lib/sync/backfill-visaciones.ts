import { neon } from "@neondatabase/serverless";
import { getComprasAnilDesde } from "@/db/vidadigital/queries";

export async function backfillVisaciones(): Promise<{
  procesados: number;
  sinMatch: number;
  filasInsertadas: number;
}> {
  const sql = neon(process.env.DATABASE_URL!);

  // 1. Obtener todos los datos de Vida Digital (una sola llamada)
  const compras = await getComprasAnilDesde("2026-05-01");

  // 2. Indexar por (folio, codigo) para búsqueda O(1)
  const index = new Map<string, (typeof compras)[number]>();
  for (const c of compras) {
    index.set(`${c.folio}|${c.codigo}`, c);
  }

  // 3. Movimientos tipo='entrada' sin hijos en movimiento_visaciones
  const huerfanos = await sql`
    SELECT m.id, m.folio, p.codigo
    FROM movimientos m
    JOIN productos p ON p.id = m.producto_id
    WHERE m.tipo = 'entrada'
      AND NOT EXISTS (
        SELECT 1 FROM movimiento_visaciones v WHERE v.movimiento_id = m.id
      )
  ` as unknown as { id: number; folio: string; codigo: string }[];

  let procesados = 0;
  let sinMatch = 0;
  let filasInsertadas = 0;

  for (const mov of huerfanos) {
    const key = `${mov.folio}|${mov.codigo}`;
    const compra = index.get(key);

    if (!compra || compra.visaciones.length === 0) {
      sinMatch++;
      continue;
    }

    for (const v of compra.visaciones) {
      const res = await sql`
        INSERT INTO movimiento_visaciones (movimiento_id, nro_ingreso, cantidad)
        VALUES (${mov.id}, ${v.nroIngreso}, ${v.cantidad})
        ON CONFLICT (movimiento_id, nro_ingreso) DO NOTHING
        RETURNING id
      ` as unknown as { id: number }[];
      filasInsertadas += res.length;
    }

    procesados++;
  }

  return { procesados, sinMatch, filasInsertadas };
}
