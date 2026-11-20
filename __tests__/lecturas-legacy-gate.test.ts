/**
 * Fase B — inv-29: gate de modo en las 8 lecturas legacy.
 * ON: rechazan antes de cualquier SQL. OFF: responden igual que hoy (DB TEST).
 * ROJO: ninguna de las 8 llama todavía a exigirModoOperativo().
 */
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getProductos, crearProductoManual } from "@/lib/actions/productos";
import {
  getBodegas, getModulos, getStockPorUbicacion, getNombreUbicacion,
  getMovimientosPorProductoUbicacion,
} from "@/lib/actions/vistas";
import { getMovimientos } from "@/lib/actions/movimientos";
import { getMovimientosContribuyentes } from "@/lib/actions/ajustes";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const flagPrevio = process.env.FEATURE_INVENTARIO_BODEGA;
const CASOS: [string, () => Promise<unknown>][] = [
  ["getProductos", () => getProductos({ limit: 1 })],
  ["getBodegas", () => getBodegas()],
  ["getModulos", () => getModulos()],
  ["getStockPorUbicacion", () => getStockPorUbicacion({ tipo: "bodega", ubicacionId: 1, limit: 1 })],
  ["getNombreUbicacion", () => getNombreUbicacion("bodega", 1)],
  ["getMovimientosPorProductoUbicacion", () => getMovimientosPorProductoUbicacion({ productoId: 1, tipo: "bodega", ubicacionId: 1 })],
  ["getMovimientos", () => getMovimientos({ limit: 1 })],
  ["getMovimientosContribuyentes", () => getMovimientosContribuyentes(1, { tipo: "bodega", id: 1 })],
];

beforeEach(() => {
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
  vi.mocked(auth).mockResolvedValue({ user: { id: "1" } } as never);
});
afterAll(() => {
  if (flagPrevio === undefined) delete process.env.FEATURE_INVENTARIO_BODEGA;
  else process.env.FEATURE_INVENTARIO_BODEGA = flagPrevio;
});

it("ON: las 8 lecturas legacy rechazan antes de cualquier SQL", async () => {
  for (const [nombre, invocar] of CASOS) {
    const sel = vi.spyOn(db, "select"), exe = vi.spyOn(db, "execute");
    try {
      await expect(invocar(), nombre).rejects.toThrow(/deshabilitadas/i);
      expect(sel, nombre).not.toHaveBeenCalled();
      expect(exe, nombre).not.toHaveBeenCalled();
    } finally { sel.mockRestore(); exe.mockRestore(); }
  }
});

it("OFF: las 8 lecturas legacy siguen respondiendo", async () => {
  process.env.FEATURE_INVENTARIO_BODEGA = "false";
  try {
    const [productos, bodegas, modulos, stock, nombre, porProducto, movs, contribuyentes] =
      await Promise.all(CASOS.map(([, invocar]) => invocar()));
    expect(productos).toHaveProperty("nextCursor");
    expect(Array.isArray(bodegas) && Array.isArray(modulos)).toBe(true);
    expect(stock).toMatchObject({ items: expect.any(Array) });
    expect(typeof nombre).toBe("string");
    expect(porProducto).toMatchObject({
      entradas: expect.any(Array), salidas: expect.any(Array), ajustes: expect.any(Array),
    });
    expect(movs).toHaveProperty("nextCursor");
    expect(Array.isArray(contribuyentes)).toBe(true);
  } finally { process.env.FEATURE_INVENTARIO_BODEGA = "true"; }
});

it("ON: una acción del modo nuevo NO se gatea", async () => {
  const r = await crearProductoManual({} as never);
  expect(r.ok).toBe(false);
  expect(r.ok === false && r.error).not.toMatch(/deshabilitadas/i);
});
