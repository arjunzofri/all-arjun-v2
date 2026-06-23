/**
 * Fase B — Slice B: Desglose de compras en detalle de producto
 *
 * Smoke test: getProducto(id) debe retornar compras[] con visaciones
 * para productos que tienen datos en movimiento_visaciones.
 *
 * Fase B: getProducto todavía no retorna compras — este test DEBE fallar.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { getProducto } from "@/lib/actions/productos";

const sql = neon(process.env.DATABASE_URL!);

let productoId: number;

beforeAll(async () => {
  const rows = await sql`
    SELECT id FROM productos WHERE codigo = 'HJ-80092-8'
  `;
  const r = rows as unknown as { id: number }[];
  if (r.length === 0) throw new Error("Producto HJ-80092-8 no encontrado en la DB");
  productoId = r[0].id;
});

describe("getProducto — compras + visaciones", () => {
  it("T1 smoke: retorna compras[] con visaciones para HJ-80092-8", async () => {
    const producto = await getProducto(productoId);

    expect(producto).not.toBeNull();
    // Fase B: compras no existe todavía — este expect DEBE fallar
    const p = producto! as Record<string, unknown>;

    expect(p.compras).toBeDefined();
    const compras = p.compras as unknown[];
    expect(compras.length).toBeGreaterThan(0);

    let conVisaciones = false;
    for (const c of compras) {
      const comp = c as Record<string, unknown>;
      const vis = comp.visaciones as unknown[] | undefined;
      if (vis && vis.length > 0) {
        conVisaciones = true;
        for (const v of vis) {
          const vi = v as Record<string, unknown>;
          expect(typeof vi.nroIngreso).toBe("string");
          expect((vi.nroIngreso as string).length).toBeGreaterThan(0);
          expect(typeof vi.cantidad).toBe("number");
          expect(vi.cantidad as number).toBeGreaterThan(0);
        }
      }
    }
    expect(conVisaciones).toBe(true);
  });
});
