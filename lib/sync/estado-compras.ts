import { neon } from "@neondatabase/serverless";

export const ACCION_CORRIDA = "sync_compras_inventario";
export const MSG_ERROR_CORRIDA = "Error al actualizar las compras";

export interface CorridaCompras {
  ok: boolean;
  procesadas?: number;
  insertadas?: number;
  omitidas?: number;
  pendientes?: boolean;
  watermark?: string;
  error?: string;
  createdAt: string;
}

export interface EstadoCompras {
  ultima: CorridaCompras | null;
  watermark: string | null;
}

/** Última corrida ON y watermark del ledger. Solo lectura. */
export async function getEstadoCompras(): Promise<EstadoCompras> {
  const sql = neon(process.env.DATABASE_URL!);
  const runs = (await sql`
    SELECT detalles, created_at FROM activity_log
    WHERE accion = ${ACCION_CORRIDA}
    ORDER BY id DESC LIMIT 1
  `) as { detalles: unknown; created_at: Date | string }[];
  const wm = (await sql`
    SELECT value FROM sync_watermark WHERE key = 'compras-anil-ledger'
  `) as { value: string }[];

  const fila = runs[0];
  const d = (typeof fila?.detalles === "string"
    ? JSON.parse(fila.detalles)
    : fila?.detalles) as Partial<CorridaCompras> | undefined;

  return {
    ultima: fila && d
      ? { ...d, ok: d.ok === true, createdAt: new Date(fila.created_at).toISOString() }
      : null,
    watermark: wm[0]?.value ?? null,
  };
}
