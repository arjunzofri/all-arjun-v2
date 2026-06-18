/**
 * Fase B — Slice 04: Tests que intentan romper la API de productos.
 *
 * Riesgos: R1 cursor inestable, R2 buscador sin límite, R3 auditoría codigo_personal,
 * R4 campos no permitidos en PATCH, R5 auth.
 */

import { describe, it, expect, beforeAll, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth para tests que requieren sesión
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
import { auth } from "@/lib/auth";

// Imports reales — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import { GET as getProductos } from "@/app/api/productos/route";
import { GET as getProducto, PATCH as patchProducto } from "@/app/api/productos/[id]/route";
import { GET as getBuscarHistorico } from "@/app/api/productos/buscar-historico/route";

const mockAuth = auth as ReturnType<typeof vi.fn>;

let testProductId: number;

beforeAll(async () => {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    INSERT INTO productos (codigo, detalle)
    VALUES ('TEST-API-001', 'Producto de prueba API')
    ON CONFLICT (codigo) DO NOTHING
  `;
  const r = await sql`SELECT id FROM productos WHERE codigo = 'TEST-API-001'`;
  testProductId = (r as unknown as { id: number }[])[0].id;
});

// ── Helpers ──────────────────────────────────────────────────────────────
beforeEach(() => {
  mockAuth.mockResolvedValue({ user: { id: 1, email: "test@arjun.local", role: "admin" } });
});

// ── R2: Buscador histórico ──────────────────────────────────────────────
describe("GET /api/productos/buscar-historico", () => {
  it("devuelve máximo 20 resultados", async () => {
    const req = new NextRequest(
      "https://app-arjun.local/api/productos/buscar-historico?q=a"
    );
    const res = await getBuscarHistorico(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(20);
  });

  it("requiere parámetro q", async () => {
    const req = new NextRequest(
      "https://app-arjun.local/api/productos/buscar-historico"
    );
    const res = await getBuscarHistorico(req);
    expect(res.status).toBe(400);
  });

  it("no expone cantidad, bodega, ni saldo", async () => {
    const req = new NextRequest(
      "https://app-arjun.local/api/productos/buscar-historico?q=1161"
    );
    const res = await getBuscarHistorico(req);
    const body = await res.json();
    for (const item of body) {
      expect(item).toHaveProperty("codigo");
      expect(item).not.toHaveProperty("cantidad");
      expect(item).not.toHaveProperty("bodega");
      expect(item).not.toHaveProperty("saldo");
    }
  });
});

// ── R1: Paginación con cursor estable ───────────────────────────────────
describe("GET /api/productos — paginación", () => {
  it("devuelve página con nextCursor", async () => {
    const req = new NextRequest(
      "https://app-arjun.local/api/productos?limit=5"
    );
    const res = await getProductos(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("nextCursor");
    expect(Array.isArray(body.items)).toBe(true);
  });

  // R1: si ORDER BY no es consistente con el cursor, items se repiten o saltan
  it("no repite productos entre páginas", async () => {
    const page1 = await getProductos(
      new NextRequest("https://app-arjun.local/api/productos?limit=3")
    );
    const { items: items1, nextCursor } = await page1.json();

    if (!nextCursor) return; // no hay suficientes datos

    const page2 = await getProductos(
      new NextRequest(
        `https://app-arjun.local/api/productos?limit=3&cursor=${nextCursor}`
      )
    );
    const { items: items2 } = await page2.json();

    const ids1 = new Set(items1.map((i: { id: number }) => i.id));
    const ids2 = items2.map((i: { id: number }) => i.id);
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  it("cursor inválido no crashea", async () => {
    const req = new NextRequest(
      "https://app-arjun.local/api/productos?cursor=99999999"
    );
    const res = await getProductos(req);
    expect(res.status).toBe(200);
  });
});

// ── R4: PATCH campos no permitidos ──────────────────────────────────────
describe("PATCH /api/productos/[id]", () => {
  it("ignora campos no permitidos como codigo o cantidad", async () => {
    const req = new NextRequest(
      `https://app-arjun.local/api/productos/${testProductId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: "hackeado",
          codigoPersonal: "ALIAS-NUEVO",
          cantidad: 9999,
        }),
      }
    );
    const res = await patchProducto(req, { params: Promise.resolve({ id: String(testProductId) }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    // codigo no debe haber cambiado
    expect(body.codigo).not.toBe("hackeado");
    expect(body.cantidad).toBeUndefined();
  });

  // R3: auditoría de codigo_personal
  it("registra en activity_log al modificar codigo_personal", async () => {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);

    const req = new NextRequest(
      `https://app-arjun.local/api/productos/${testProductId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoPersonal: "AUDIT-TEST-001" }),
      }
    );
    await patchProducto(req, {
      params: Promise.resolve({ id: String(testProductId) }),
    });

    const rows = await sql`
      SELECT * FROM activity_log
      WHERE entidad = 'producto'
        AND entidad_id = ${testProductId}
        AND accion = 'update_codigo_personal'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const entries = rows as unknown as { detalles: Record<string, unknown> }[];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].detalles).toHaveProperty("valor_nuevo", "AUDIT-TEST-001");
  });
});

// ── R5: Auth requerido ──────────────────────────────────────────────────
describe("endpoints requieren auth", () => {
  it("GET /api/productos sin sesión devuelve 401", async () => {
    mockAuth.mockResolvedValueOnce(null); // sin sesión
    const req = new NextRequest("https://app-arjun.local/api/productos");
    const res = await getProductos(req);
    expect(res.status).toBe(401);
  });

  it("PATCH /api/productos/1 sin sesión devuelve 401", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("https://app-arjun.local/api/productos/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await patchProducto(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });
});
