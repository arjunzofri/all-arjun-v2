/**
 * Bug P-20261110-2158-5: la ficha del producto guarda packing 0 o negativo.
 * `updateProducto` (server action) no validaba nada; el schema Zod solo vivia
 * en la ruta PATCH, que la UI no usa.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";

import { updateProducto } from "@/lib/actions/productos";
import { PATCH as patchProducto } from "@/app/api/productos/[id]/route";

const mockAuth = auth as ReturnType<typeof vi.fn>;

const TEST_CODIGO = "TEST-UPD-001";
let sql: ReturnType<typeof import("@neondatabase/serverless").neon>;
let productoId: number;

beforeAll(async () => {
  const { neon } = await import("@neondatabase/serverless");
  sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM stock WHERE producto_id IN (SELECT id FROM productos WHERE codigo = ${TEST_CODIGO})`;
  await sql`DELETE FROM productos WHERE codigo = ${TEST_CODIGO}`;
  await sql`INSERT INTO productos (codigo, detalle, packing) VALUES (${TEST_CODIGO}, 'Test update', 5)`;
  const rows = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
  productoId = (rows as unknown as { id: number }[])[0].id;
});

beforeEach(() => {
  mockAuth.mockResolvedValue({ user: { id: 1, email: "test@arjun.local", role: "admin" } });
});

async function packingActual(): Promise<number | null> {
  const rows = await sql`SELECT packing FROM productos WHERE id = ${productoId}`;
  return (rows as unknown as { packing: number | null }[])[0].packing;
}

describe("updateProducto() — packing invalido", () => {
  it("rechaza packing -5 como valor y no guarda", async () => {
    const result = await updateProducto(productoId, { packing: -5 });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/packing/i) });
    expect(await packingActual()).toBe(5);
  });

  it("rechaza packing 0 como valor y no guarda", async () => {
    const result = await updateProducto(productoId, { packing: 0 });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/packing/i) });
    expect(await packingActual()).toBe(5);
  });

  it("packing 12 valido se guarda", async () => {
    const result = await updateProducto(productoId, { packing: 12 });

    expect(result.ok).toBe(true);
    expect(await packingActual()).toBe(12);
  });
});

describe("PATCH /api/productos/[id] — packing invalido", () => {
  it("packing -5 responde 400 y no guarda", async () => {
    const req = new NextRequest(
      `https://app-arjun.local/api/productos/${productoId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packing: -5 }),
      }
    );

    const res = await patchProducto(req, {
      params: Promise.resolve({ id: String(productoId) }),
    });

    expect(res.status).toBe(400);
    expect(await packingActual()).toBe(12);
  });
});
