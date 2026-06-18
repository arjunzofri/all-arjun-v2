/**
 * Fase B — Slice 03: Tests que intentan romper el sync de compras Anil.
 *
 * Riesgos: R1 doble sync duplica, R2 watermark no avanza,
 * R3 sin CRON_SECRET, R4 atomicidad CTE, R5 bodega null.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";

// Imports reales — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import { syncComprasAnil } from "@/lib/sync/compras-anil";
import { GET } from "@/app/api/sync/compras-anil/route";

// Cliente raw para verificar resultados en DB propia
const sql = neon(process.env.DATABASE_URL!);

// ── Helpers ──────────────────────────────────────────────────────────────
async function contarMovimientos(folio: string, productoId: number) {
  const r = await sql`
    SELECT COUNT(*)::int AS n FROM movimientos
    WHERE folio = ${folio} AND producto_id = ${productoId}
  `;
  return (r as unknown as { n: number }[])[0].n;
}

async function getStock(productoId: number, bodegaId: number) {
  const r = await sql`
    SELECT cantidad FROM stock
    WHERE producto_id = ${productoId} AND bodega_id = ${bodegaId}
  `;
  const rows = r as unknown as { cantidad: number }[];
  return rows[0]?.cantidad ?? 0;
}

// ── R1: Idempotencia — doble sync no duplica ────────────────────────────
describe("syncComprasAnil() — idempotencia", () => {
  // R1a: doble ejecución con mismos datos no duplica movimientos
  it("no duplica movimientos si se ejecuta dos veces con mismo watermark", async () => {
    await syncComprasAnil("2026-06-18");

    const movsAntes = await sql`SELECT COUNT(*)::int AS n FROM movimientos`;
    const stockAntes = await sql`SELECT SUM(cantidad)::int AS n FROM stock`;

    // Segunda ejecución con mismo watermark
    await syncComprasAnil("2026-06-18");

    const movsDespues = await sql`SELECT COUNT(*)::int AS n FROM movimientos`;
    const stockDespues = await sql`SELECT SUM(cantidad)::int AS n FROM stock`;

    const count = (r: unknown) => (r as unknown as { n: number }[])[0].n;
    expect(count(movsDespues)).toBe(count(movsAntes));
    expect(count(stockDespues)).toBe(count(stockAntes));
  });

  // R1b: insert duplicado manual es rechazado por unique constraint
  it("rechaza insert duplicado con mismo folio+producto_id", async () => {
    // Creamos producto de prueba
    await sql`
      INSERT INTO productos (codigo) VALUES ('TEST-SYNC-DUP')
      ON CONFLICT (codigo) DO NOTHING
    `;
    const p = await sql`SELECT id FROM productos WHERE codigo = 'TEST-SYNC-DUP'`;
    const pid = (p as unknown as { id: number }[])[0].id;

    // Intentamos insertar dos veces con el mismo folio
    await sql`
      INSERT INTO movimientos (folio, producto_id, tipo, cantidad, usuario_id)
      VALUES ('TEST-DUP-001', ${pid}, 'entrada', 1, 1)
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO movimientos (folio, producto_id, tipo, cantidad, usuario_id)
      VALUES ('TEST-DUP-001', ${pid}, 'entrada', 1, 1)
      ON CONFLICT DO NOTHING
    `;

    expect(await contarMovimientos("TEST-DUP-001", pid)).toBe(1);

    // Limpieza
    await sql`DELETE FROM movimientos WHERE folio = 'TEST-DUP-001'`;
    await sql`DELETE FROM productos WHERE codigo = 'TEST-SYNC-DUP'`;
  });
});

// ── R2: Watermark ──────────────────────────────────────────────────────
describe("syncComprasAnil() — watermark", () => {
  it("avanza el watermark después de procesar compras", async () => {
    const antes = await sql`
      SELECT value FROM sync_watermark WHERE key = 'compras-anil'
    `;
    const rows = antes as unknown as { value: string }[];

    await syncComprasAnil("2026-06-18");

    const despues = await sql`
      SELECT value FROM sync_watermark WHERE key = 'compras-anil'
    `;
    const rows2 = despues as unknown as { value: string }[];

    const fechaAntes = rows[0]?.value ?? "2026-06-01";
    const fechaDespues = rows2[0]?.value ?? "2026-06-01";
    // El watermark debe ser >= la fecha de entrada
    expect(fechaDespues >= fechaAntes).toBe(true);
  });

  it("no procesa compras con fecha menor al watermark", async () => {
    // Si el watermark ya está en 2026-06-15, sync con fecha 2026-06-01
    // no debería traer nuevas compras
    await sql`
      INSERT INTO sync_watermark (key, value)
      VALUES ('compras-anil', '2026-06-15')
      ON CONFLICT (key) DO UPDATE SET value = '2026-06-15'
    `;

    const movsAntes = await sql`SELECT COUNT(*)::int AS n FROM movimientos`;

    await syncComprasAnil("2026-06-01");

    const movsDespues = await sql`SELECT COUNT(*)::int AS n FROM movimientos`;
    const count = (r: unknown) => (r as unknown as { n: number }[])[0].n;
    expect(count(movsDespues)).toBe(count(movsAntes));
  });
});

// ── R3: CRON_SECRET ────────────────────────────────────────────────────
describe("GET /api/sync/compras-anil — seguridad", () => {
  it("devuelve 401 sin header Authorization", async () => {
    const req = new Request("https://app-arjun.local/api/sync/compras-anil");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("devuelve 401 con token inválido", async () => {
    const req = new Request(
      "https://app-arjun.local/api/sync/compras-anil",
      { headers: { Authorization: "Bearer token-falso" } }
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("devuelve 200 con token válido", async () => {
    process.env.CRON_SECRET = "test-secret";
    const req = new Request(
      "https://app-arjun.local/api/sync/compras-anil",
      { headers: { Authorization: "Bearer test-secret" } }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    delete process.env.CRON_SECRET;
  });
});

// ── R5: Bodega desconocida ──────────────────────────────────────────────
describe("syncComprasAnil() — bodega null", () => {
  it("no crashea con código de bodega no reconocido", async () => {
    // El sync debe manejar productos con knumezet sin código GLP/GL1/GL2.
    // getBodegaPorCodigoIngreso() retorna null → debe usar fallback.
    await expect(
      syncComprasAnil("2026-06-18")
    ).resolves.not.toThrow();
  });
});
