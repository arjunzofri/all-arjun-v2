import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getComprasAnilDesde } from "@/db/vidadigital/queries";
import { guardarCompraImportada } from "@/lib/sync/compras-importadas";
import { flagActivo } from "@/lib/feature-flags";
import {
  conciliarComprasAnil,
  getDesdeConciliacion,
  type ResultadoConciliacion,
} from "@/lib/sync/conciliacion-compras";

// ponytail: pre-seed manual de bodegas. Si se agregan más, migrar a tabla.
const BODEGA_ID: Record<string, number> = {
  "Bodega 1 Vida Digital": 1,
  "Bodega 2 Vida Digital": 2,
  "Bodega Arjun": 3,
};

const SYNC_KEY = "compras-anil";
const ORIGEN_KEY = "compras-anil-desde";
const LEDGER_KEY = "compras-anil-ledger";
const LEASE_KEY = "compras-anil-lease";

/** TTL del lease del sync ON; debe superar la guarda de LIMITE_MS_LOTE_COMPRAS. */
export const LEASE_MS_COMPRAS = 120000;

/** Filas de VD leídas por corrida en modo ON (backfill por lotes). */
export const LIMITE_LOTE_COMPRAS = 100;
/** Tope de tiempo por corrida ON; al excederse se corta y queda pendiente. */
export const LIMITE_MS_LOTE_COMPRAS = 8000;

export interface SyncComprasAnilResultado {
  procesadas: number;
  watermark: string;
  conciliacion?: ResultadoConciliacion | { error: string };
  /** ON: true si quedan filas para la próxima corrida. */
  pendientes?: boolean;
  /** ON: inserciones reales en el ledger (los replay no cuentan). */
  insertadas?: number;
  /** ON: filas omitidas por código inválido (null/vacío/>30). */
  omitidas?: number;
}

// ── Upsert de producto (compartido: sync Anil + entrada manual) ──

export async function upsertProducto(
  sql: { (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown> },
  compra: {
    codigo: string;
    detalle: string | null;
    cantcaja: number | null;
    imagenUrl: string | null;
    ubicacion?: string | null;
  },
) {
  await sql`
    INSERT INTO productos (codigo, detalle, packing, imagen_url, ubicacion)
    VALUES (${compra.codigo}, ${compra.detalle}, ${compra.cantcaja}, ${compra.imagenUrl}, ${compra.ubicacion ?? null})
    ON CONFLICT (codigo) DO UPDATE
      SET imagen_url = COALESCE(productos.imagen_url, EXCLUDED.imagen_url),
          ubicacion  = COALESCE(EXCLUDED.ubicacion, productos.ubicacion)
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
    visaciones: { nroIngreso: string; cantidad: number }[];
    fechanvt: string | null;
    precioUnitario?: number | null;
  },
) {
  // CTE atómica: stock + movimiento. RETURNING id para las visaciones hijas.
  const result = await sql`
    WITH existing AS (
      SELECT id FROM movimientos
      WHERE folio = ${params.folio}
        AND producto_id = (SELECT id FROM productos WHERE codigo = ${params.codigo})
        AND bodega_origen_id = ${params.bodegaId}
    ),
    stock_ok AS (
      INSERT INTO stock (producto_id, bodega_id, cantidad)
      SELECT id, ${params.bodegaId}, ${params.cantidad}
      FROM productos WHERE codigo = ${params.codigo}
        AND NOT EXISTS (SELECT 1 FROM existing)
      ON CONFLICT (producto_id, bodega_id)
      DO UPDATE SET cantidad = stock.cantidad + ${params.cantidad}
    )
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id, fecha_compra, precio_unitario)
    SELECT ${params.folio}, id, 'entrada', ${params.cantidad}, ${params.bodegaId}, 1,
      ${params.fechanvt ?? null}::date, ${params.precioUnitario ?? null}
    FROM productos WHERE codigo = ${params.codigo}
      AND NOT EXISTS (SELECT 1 FROM existing)
    RETURNING id
  `;

  // Resolver el id del movimiento (recién insertado o ya existente)
  const rows = result as unknown as { id: number }[];
  let movimientoId: number | null = rows[0]?.id ?? null;

  if (movimientoId === null) {
    // El movimiento ya existía (el CTE no insertó por idempotencia).
    // Buscar el id existente para poder insertar las visaciones hijas.
    const existing = await sql`
      SELECT id FROM movimientos
      WHERE folio = ${params.folio}
        AND producto_id = (SELECT id FROM productos WHERE codigo = ${params.codigo})
        AND bodega_origen_id = ${params.bodegaId}
    `;
    const eRows = existing as unknown as { id: number }[];
    movimientoId = eRows[0]?.id ?? null;
  }

  // Insertar visaciones hijas (si hay id de movimiento y visaciones)
  if (movimientoId !== null && params.visaciones.length > 0) {
    for (const v of params.visaciones) {
      await sql`
        INSERT INTO movimiento_visaciones (movimiento_id, nro_ingreso, cantidad)
        VALUES (${movimientoId}, ${v.nroIngreso}, ${v.cantidad})
        ON CONFLICT (movimiento_id, nro_ingreso) DO NOTHING
      `;
    }
  }
}

// ── Sync en modo inventario ON: solo ledger (inv-22b) ───────────────

async function syncLedger(
  sql: { (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown> },
  corte: string,
  ahora: () => number,
): Promise<SyncComprasAnilResultado> {
  // Lote + 1: la fila extra dice si quedan filas para la próxima corrida.
  const filas = await getComprasAnilDesde(corte, {
    incluirSinMetadata: true,
    porLinea: true,
    limite: LIMITE_LOTE_COMPRAS + 1,
  });
  const extra = filas.length > LIMITE_LOTE_COMPRAS ? filas[LIMITE_LOTE_COMPRAS] : null;
  const lote = filas.slice(0, LIMITE_LOTE_COMPRAS);
  let maxFecha = corte;
  for (const c of lote) if (c.fechconf && c.fechconf > maxFecha) maxFecha = c.fechconf;
  // Día lleno: todo el lote es de la fecha de la extra → re-leer desde ahí vuelve al loop.
  if (extra && lote[0].fechconf === extra.fechconf) {
    throw new Error(
      `Lote lleno (${LIMITE_LOTE_COMPRAS}) con la fecha de confirmación ${maxFecha}: ` +
      `un solo día no cabe en LIMITE_LOTE_COMPRAS; aumentar la constante o particionar ese día`,
    );
  }

  const inicio = ahora();
  let procesadas = 0;
  let insertadas = 0;
  let omitidas = 0;
  let pendientes = extra !== null;
  // Re-lectura inclusiva: el watermark es la fecha de la primera fila no procesada.
  let watermark = extra?.fechconf ?? maxFecha;
  for (let i = 0; i < lote.length; i++) {
    const compra = lote[i];
    if (compra.fechconf) {
      // D-2: codunico nulo/vacío/>30 rompería productos.codigo NOT NULL/varchar(30).
      if (!compra.codigo || compra.codigo.length > 30) {
        omitidas++;
      } else {
        await upsertProducto(sql, compra); // nunca escribe ubicación ni pisa campos manuales
        const prod = (await sql`
          SELECT id FROM productos WHERE codigo = ${compra.codigo}
        `) as { id: number }[];
        if (prod[0]) {
          const insertada = await guardarCompraImportada(sql, {
            ...compra,
            productoId: prod[0].id,
            bodegaCodigo: compra.bodegaCodigo ?? null,
            item: compra.item ?? null,
            fechaNota: compra.fechanvt,
            fechaConfirmacion: compra.fechconf,
          });
          procesadas++;
          if (insertada) insertadas++;
        }
      }
    }
    // D-1: solo cortar si la próxima fila es de un día posterior al corte; si no,
    // la re-lectura inclusiva repetiría el mismo prefijo y nunca avanzaría.
    const proxima = lote[i + 1]?.fechconf;
    if (
      ahora() - inicio > LIMITE_MS_LOTE_COMPRAS &&
      i + 1 < lote.length &&
      proxima && proxima > corte
    ) {
      pendientes = true;
      watermark = proxima;
      break;
    }
  }

  await sql`
    INSERT INTO sync_watermark (key, value)
    VALUES (${LEDGER_KEY}, ${watermark})
    ON CONFLICT (key) DO UPDATE
      SET value = GREATEST(sync_watermark.value, EXCLUDED.value)
  `;
  return { procesadas, insertadas, omitidas, watermark, pendientes };
}

// ── Lease del sync ON (inv-22c) ───────────────────────────────────────

type SqlFn = { (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown> };
const iso = (ms: number) => new Date(ms).toISOString();

/** Reclama el lease con un solo statement atómico. null = otra corrida en curso. */
export async function adquirirLeaseCompras(
  sql: SqlFn,
  ahora: () => number = Date.now,
): Promise<{ token: string; liberar: () => Promise<void> } | null> {
  const token = randomUUID();
  const rows = (await sql`
    INSERT INTO sync_watermark (key, value)
    VALUES (${LEASE_KEY}, ${`${iso(ahora() + LEASE_MS_COMPRAS)}|${token}`})
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
      WHERE split_part(sync_watermark.value, '|', 1) < ${iso(ahora())}
    RETURNING value
  `) as { value: string }[];
  if (rows.length === 0) return null;
  return { token, liberar: () => liberarLeaseCompras(sql, token) };
}

/** Libera solo si el lease sigue siendo nuestro; deja expiración pasada. */
export async function liberarLeaseCompras(sql: SqlFn, token: string): Promise<void> {
  await sql`
    UPDATE sync_watermark
    SET value = ${`${iso(0)}|${token}`}, updated_at = now()
    WHERE key = ${LEASE_KEY} AND value LIKE ${`%|${token}`}
  `;
}

/** Sync de compras ON: adquiere el lease ANTES de leer el corte. null = ocupado. */
export async function syncComprasAnilInventario(
  opciones: { ahora?: () => number } = {},
): Promise<SyncComprasAnilResultado | null> {
  const ahora = opciones.ahora ?? Date.now;
  const sql = neon(process.env.DATABASE_URL!);
  const lease = await adquirirLeaseCompras(sql, ahora);
  if (!lease) return null;
  try {
    const rows = (await sql`
      SELECT value FROM sync_watermark WHERE key = ${LEDGER_KEY}
    `) as { value: string }[];
    return await syncLedger(sql, rows[0]?.value ?? "1900-01-01", ahora);
  } finally {
    await lease.liberar();
  }
}

// ── Sync principal ────────────────────────────────────────────────────

export async function syncComprasAnil(
  corte: string,
  opciones: { modo?: "on" | "off"; ahora?: () => number } = {},
): Promise<SyncComprasAnilResultado> {
  const sql = neon(process.env.DATABASE_URL!);

  if (opciones.modo === "on") return syncLedger(sql, corte, opciones.ahora ?? Date.now);

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

  // Fecha de origen de la conciliación: fija al corte del primer sync.
  // El script de corte de inventario debe borrar/reiniciar esta key.
  await sql`
    INSERT INTO sync_watermark (key, value)
    VALUES (${ORIGEN_KEY}, ${corte})
    ON CONFLICT (key) DO NOTHING
  `;

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
      visaciones: compra.visaciones,
      fechanvt: compra.fechanvt,
      precioUnitario: compra.precioUnitario ?? null,
    });

    procesadas++;
    // El watermark avanza por fecha de CONFIRMACION: una nota confirmada
    // tarde (fechconf posterior a su fechanvt) no se pierde.
    if (compra.fechconf && compra.fechconf > maxFecha) {
      maxFecha = compra.fechconf;
    }
  }

  // Actualizar watermark
  await sql`
    INSERT INTO sync_watermark (key, value)
    VALUES (${SYNC_KEY}, ${maxFecha})
    ON CONFLICT (key) DO UPDATE SET value = ${maxFecha}
  `;

  // Conciliación automática (flag). Una falla acá NO rompe el sync:
  // las compras ya quedaron insertadas.
  let conciliacion: SyncComprasAnilResultado["conciliacion"];
  if (flagActivo("conciliacion_compras")) {
    const desde = await getDesdeConciliacion(sql);
    try {
      conciliacion = await conciliarComprasAnil(desde);
    } catch (err) {
      conciliacion = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    procesadas,
    watermark: maxFecha,
    ...(conciliacion ? { conciliacion } : {}),
  };
}
