/**
 * inv-22a — escritor del ledger de compras importadas en modo inventario (ON).
 * Solo INSERT idempotente: nunca toca stock ni movimientos.
 */

export interface CompraImportadaInput {
  folio: string;
  productoId: number;
  bodegaCodigo: string | null;
  item?: number | null;
  cantidad: number;
  precioUnitario?: number | string | null;
  fechaNota?: string | null;
  fechaConfirmacion: string;
  visaciones?: { nroIngreso: string; cantidad: number }[];
}

/** true si insertó; false si la compra ya estaba (ON CONFLICT DO NOTHING). */
export async function guardarCompraImportada(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>,
  compra: CompraImportadaInput,
): Promise<boolean> {
  const rows = (await sql`
    INSERT INTO compras_importadas
      (folio, producto_id, bodega_codigo, item, cantidad, precio_unitario,
       fecha_nota, fecha_confirmacion, visaciones)
    VALUES (${compra.folio}, ${compra.productoId}, ${compra.bodegaCodigo ?? null},
      ${compra.item ?? null}, ${compra.cantidad}, ${compra.precioUnitario ?? null},
      ${compra.fechaNota ?? null}::date, ${compra.fechaConfirmacion}::date,
      ${JSON.stringify(compra.visaciones ?? [])}::jsonb)
    ON CONFLICT (folio, producto_id, bodega_codigo, item) DO NOTHING
    RETURNING id
  `) as unknown as { id: number }[];
  return rows.length > 0;
}
