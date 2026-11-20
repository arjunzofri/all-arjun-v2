// Fase B — inv-24e: interruptor «Mostrar valores» en /inventario + redirect legacy en ON.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const mocks = vi.hoisted(() => ({ lista: vi.fn(), valorizacion: vi.fn(), flags: new Set<string>() }));
vi.mock("@/lib/inventario/consultas", () => ({ listarInventario: mocks.lista, getValorizacionLista: mocks.valorizacion }));
vi.mock("@/lib/utils/inversion-lotes", () => ({ getStockPorCodigo: vi.fn(), getLotesCompraPorCodigos: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: (k: string) => mocks.flags.has(k) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((u: string) => { throw new Error(`REDIRECT:${u}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));

import { auth } from "@/lib/auth";
import Pagina, { leerParametrosLista } from "@/app/(dashboard)/inventario/page";
import InversionMercaderiaPage from "@/app/(dashboard)/inversion-mercaderia/page";
import type { FilaInventario, ValorizacionLista } from "@/lib/inventario/consultas";

const fila: FilaInventario = { id: 42, codigo: "COD-42", detalle: null, codigoPersonal: null, packing: null, observaciones: null, imagenUrl: null, posiciones: [], stockContado: 0 };
const valor: ValorizacionLista = {
  porProducto: [{ productoId: 42, valor: { stock: 0, valorTotal: 123.45, cantidadValorizada: 0, cantidadSinCosto: 0, incompleto: false, costoPromedio: 1.5, fechaConteoMin: "2026-11-17", fechaConteoMax: "2026-11-17", fechasDistintas: false, partidas: [] } }],
  totales: { valorTotal: 123.45, unidadesSinCosto: 0, incompleto: false, fechaMin: "2026-11-17", fechaMax: "2026-11-17", fechasDistintas: false, productosConConteo: 1, productosSinContar: 0, productosConError: 0 },
};
const html = async (sp: Record<string, string | string[]> = {}) => renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve(sp) }) as ReactElement);

beforeEach(() => {
  mocks.flags = new Set(["inventario_bodega"]);
  vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "admin" } } as never);
  mocks.lista.mockResolvedValue({ items: [fila], nextCursor: null });
  mocks.valorizacion.mockResolvedValue(valor);
});
afterEach(() => vi.clearAllMocks());

it("admin con valores=1 llama getValorizacionLista({q}) y muestra el interruptor para ocultar", async () => {
  const h = await html({ q: " caño ", valores: "1" });
  expect(mocks.valorizacion).toHaveBeenCalledWith({ q: "caño" });
  expect(h).toContain("Ocultar valores");
  expect(h).toContain("Inversión según últimos conteos");
});

it("admin sin valores no llama la acción y ofrece Mostrar valores", async () => {
  const h = await html();
  expect(mocks.valorizacion).not.toHaveBeenCalled();
  expect(h).toContain("Mostrar valores");
  expect(h).not.toContain("Costo prom.");
});

it("operador con valores=1: no ve interruptor y nunca se llama la acción", async () => {
  vi.mocked(auth).mockResolvedValueOnce({ user: { id: "2", role: "operador" } } as never);
  const h = await html({ valores: "1" });
  expect(mocks.valorizacion).not.toHaveBeenCalled();
  expect(h).not.toContain("Mostrar valores");
  expect(h).not.toContain("Ocultar valores");
  expect(h).toContain("COD-42");
});

it("leerParametrosLista acepta valores string y rechaza array; links preservan q/cursor/valores", async () => {
  expect(leerParametrosLista({ valores: "1" })).toMatchObject({ ok: true, valores: true });
  expect(leerParametrosLista({ valores: ["1"] })).toEqual({ ok: false, error: "Parámetro de valores inválido." });
  mocks.lista.mockResolvedValueOnce({ items: [fila], nextCursor: 41 });
  const h = await html({ q: "caño", cursor: "41", valores: "1" });
  expect(h).toContain('href="/inventario?q=ca%C3%B1o&amp;cursor=41&amp;valores=1"');
  expect(h).toContain('href="/inventario?q=ca%C3%B1o&amp;valores=1"');
  expect(h).toContain('href="/inventario?q=ca%C3%B1o&amp;cursor=41"');
});

it("error de valorización: la lista base sigue visible con mensaje fijo", async () => {
  mocks.valorizacion.mockRejectedValueOnce(new Error("SECRETO"));
  const h = await html({ valores: "1" });
  expect(h).toContain("COD-42");
  expect(h).toContain("No se pudo cargar la valorización. Intente nuevamente.");
  expect(h).not.toContain("SECRETO");
});

it("/inversion-mercaderia con inventario_bodega ON redirige a /inventario con valores=1", async () => {
  mocks.flags = new Set(["inventario_bodega", "inversion_mercaderia"]);
  await expect(InversionMercaderiaPage()).rejects.toThrow("REDIRECT:/inventario?valores=1");
});
