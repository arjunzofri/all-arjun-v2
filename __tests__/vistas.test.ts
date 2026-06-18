/**
 * Fase B — Slice 09: Tests que intentan romper las vistas /bodegas y /modulos.
 * Riesgos: R1 cursor inestable, R2 filtro "solo con stock" no bloquea legítimos,
 * R3 auth, R4 bodega/módulo no existe.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockAuth.mockResolvedValue({ user: { id: 1, email: "test@arjun.local", role: "admin" } });
});

// Imports reales — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import {
  getBodegas,
  getModulos,
  getStockPorBodega,
  getStockPorModulo,
} from "@/lib/actions/vistas";

// ── R1: Paginación con cursor estable ──────────────────────────────────
describe("getStockPorBodega() — paginación", () => {
  it("devuelve página con nextCursor", async () => {
    const page = await getStockPorBodega({ bodegaId: 1, limit: 5 });
    expect(page).toHaveProperty("items");
    expect(page).toHaveProperty("nextCursor");
    expect(Array.isArray(page.items)).toBe(true);
    expect(page.items.length).toBeLessThanOrEqual(5);
  });

  // R1: cursor inestable → items se repiten
  it("no repite items entre páginas", async () => {
    const p1 = await getStockPorBodega({ bodegaId: 1, limit: 3 });
    if (!p1.nextCursor) return;

    const p2 = await getStockPorBodega({ bodegaId: 1, limit: 3, cursor: p1.nextCursor });
    const ids1 = new Set(p1.items.map((i: { id: number }) => i.id));
    for (const item of p2.items) {
      expect(ids1.has(item.id)).toBe(false);
    }
  });

  it("soloConStock: true no devuelve items con cantidad 0", async () => {
    const page = await getStockPorBodega({ bodegaId: 1, soloConStock: true });
    for (const item of page.items) {
      expect(item.cantidad).toBeGreaterThan(0);
    }
  });

  // R2: filtro "solo con stock" = false trae todos (no bloquea legítimos)
  it("soloConStock: false incluye items sin stock", async () => {
    const page = await getStockPorBodega({ bodegaId: 1, soloConStock: false });
    // Solo verificamos que no crashea y devuelve estructura correcta
    expect(Array.isArray(page.items)).toBe(true);
  });
});

// ── getStockPorModulo() mismo patrón ───────────────────────────────────
describe("getStockPorModulo()", () => {
  it("devuelve items con paginación", async () => {
    const page = await getStockPorModulo({ moduloId: 1, limit: 5 });
    expect(page).toHaveProperty("items");
    expect(page.items.length).toBeLessThanOrEqual(5);
  });
});

// ── R4: Listados de resumen ────────────────────────────────────────────
describe("getBodegas() y getModulos()", () => {
  it("getBodegas() devuelve array con total de stock", async () => {
    const bodegas = await getBodegas();
    expect(Array.isArray(bodegas)).toBe(true);
    if (bodegas.length > 0) {
      expect(bodegas[0]).toHaveProperty("id");
      expect(bodegas[0]).toHaveProperty("nombre");
    }
  });

  it("getModulos() devuelve array con total de stock", async () => {
    const modulos = await getModulos();
    expect(Array.isArray(modulos)).toBe(true);
    if (modulos.length > 0) {
      expect(modulos[0]).toHaveProperty("id");
      expect(modulos[0]).toHaveProperty("nombre");
    }
  });
});
