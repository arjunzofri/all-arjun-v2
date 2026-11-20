// Fase B — inv-26 CA12: la ficha vuelve a /inventario con q, cursor y valores. ROJO: falta lib/inventario/retorno-lista.
import { createElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const m = vi.hoisted(() => ({ lista: vi.fn(), valorLista: vi.fn(), ficha: vi.fn(), valorFicha: vi.fn(), historial: vi.fn() }));
vi.mock("@/lib/inventario/consultas", () => ({
  listarInventario: m.lista, getValorizacionLista: m.valorLista,
  getFichaInventario: m.ficha, getValorizacionProducto: m.valorFicha, getHistorialConteos: m.historial,
}));
vi.mock("@/lib/utils/inversion-lotes", () => ({ getStockPorCodigo: vi.fn(), getLotesCompraPorCodigos: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) };
});
import Pagina from "@/app/(dashboard)/inventario/page";
import ProductoDetallePage from "@/app/(dashboard)/productos/[id]/page";
import { ListaResultados } from "@/components/inventario/BuscadorInventario";
import { hrefFicha, hrefLista, leerRetorno, SIN_RETORNO } from "@/lib/inventario/retorno-lista";

const fila = { id: 42, codigo: "COD-42", detalle: null, codigoPersonal: null, packing: null, observaciones: null, imagenUrl: null, posiciones: [], stockContado: null };
const htmlPagina = async (sp: Record<string, string | string[]> = {}) => renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve(sp) }) as React.ReactElement);
const htmlFicha = async (sp: Record<string, string | string[]>, role = "admin") => {
  vi.mocked(auth).mockResolvedValue({ user: { id: "1", role } } as never);
  return renderToStaticMarkup(await ProductoDetallePage({ params: Promise.resolve({ id: "42" }), searchParams: Promise.resolve(sp) }) as React.ReactElement);
};
beforeEach(() => {
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
  vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "admin" } } as never);
  m.lista.mockReset().mockResolvedValue({ items: [fila], nextCursor: null });
  m.valorLista.mockReset();
  m.ficha.mockReset().mockResolvedValue(fila);
  m.valorFicha.mockReset().mockResolvedValue(null);
});

it("1: leerRetorno vacío normaliza q vacío, cursor null y valores false", () => {
  expect(leerRetorno({})).toEqual({ q: "", cursor: null, valores: false });
});

it("2: hrefLista canónico por campo y orden", () => {
  expect(hrefLista(SIN_RETORNO)).toBe("/inventario");
  expect(hrefLista({ q: "caño", cursor: 41, valores: true })).toBe("/inventario?q=ca%C3%B1o&cursor=41&valores=1");
  expect(hrefLista({ q: "", cursor: 41, valores: false })).toBe("/inventario?cursor=41");
});

it("3: hrefFicha incluye refQ, refCursor y refValores solo cuando corresponde", () => {
  expect(hrefFicha(42, SIN_RETORNO)).toBe("/productos/42");
  expect(hrefFicha(42)).toBe("/productos/42");
  expect(hrefFicha(42, { q: "caño", cursor: 41, valores: true })).toBe("/productos/42?refQ=ca%C3%B1o&refCursor=41&refValores=1");
});

it("4: arrays u objetos se ignoran por campo y el vecino válido se conserva", () => {
  expect(leerRetorno({ refQ: ["a"], refCursor: ["41"], refValores: ["1"] } as never)).toEqual(SIN_RETORNO);
  expect(leerRetorno({ refQ: "ok", refCursor: ["41"], refValores: "1" } as never, true)).toEqual({ q: "ok", cursor: null, valores: true });
});

it("5: refQ > 100 ignorado; caracteres especiales encodeados y siempre ruta interna", () => {
  expect(leerRetorno({ refQ: "x".repeat(101) }).q).toBe("");
  expect(leerRetorno({ refQ: "x".repeat(100) }).q).toHaveLength(100);
  const r = leerRetorno({ refQ: "a&b#c d//evil.com" });
  const h = hrefLista(r);
  expect(h).toContain(`q=${encodeURIComponent("a&b#c d//evil.com")}`);
  expect(new URL(h, "http://x").origin).toBe("http://x");
  const evil = hrefLista(leerRetorno({ refQ: "//evil.com" }));
  expect(new URL(evil, "http://x").origin).toBe("http://x");
  expect(evil.startsWith("/inventario?")).toBe(true);
});

it("6: refCursor solo entero positivo int4 sin ceros a la izquierda", () => {
  for (const refCursor of ["0", "-1", "1.5", "1e3", "01", "2147483648", ["1"]]) expect(leerRetorno({ refCursor } as never).cursor).toBeNull();
  expect(leerRetorno({ refCursor: "1" }).cursor).toBe(1);
  expect(leerRetorno({ refCursor: "2147483647" }).cursor).toBe(2147483647);
});

it("7: admin con q, cursor y valores enlaza cada fila con el contexto completo", async () => {
  const h = await htmlPagina({ q: "caño", cursor: "41", valores: "1" });
  expect(h).toContain('href="/productos/42?refQ=ca%C3%B1o&amp;refCursor=41&amp;refValores=1"');
});

it("8: operador con valores=1 fabricado no propaga el parámetro privilegiado", async () => {
  vi.mocked(auth).mockResolvedValueOnce({ user: { id: "2", role: "operador" } } as never);
  const h = await htmlPagina({ q: "x", valores: "1" });
  expect(h).toContain('href="/productos/42?refQ=x"');
  expect(h).not.toContain("refValores");
});

it("9: lista sin params enlaza la ficha sin contexto", async () => {
  expect(await htmlPagina()).toContain('href="/productos/42"');
});

it("10: admin vuelve con q, cursor y valores validados", async () => {
  const h = await htmlFicha({ refQ: "ca ja", refCursor: "41", refValores: "1" });
  expect(h).toContain('href="/inventario?q=ca%20ja&amp;cursor=41&amp;valores=1"');
  expect(h).toContain("COD-42");
});

it("11: refQ array y refCursor inválido se ignoran y la ficha renderiza", async () => {
  const h = await htmlFicha({ refQ: ["x"], refCursor: "abc" });
  expect(h).toContain('href="/inventario"');
  expect(h).toContain("COD-42");
});

it("12: operador con refValores=1 vuelve sin valores", async () => {
  const h = await htmlFicha({ refQ: "x", refValores: "1" }, "operador");
  expect(h).toContain('href="/inventario?q=x"');
  expect(h).not.toContain("valores=1");
});

it("13: sugerencias llevan el término tipeado; término vacío sin refQ", () => {
  const lista = (q: string) => renderToStaticMarkup(createElement(ListaResultados, { items: [fila] as never, error: null, consultado: true, q, onElegir: () => {} }));
  expect(lista("cod")).toContain('href="/productos/42?refQ=cod"');
  expect(lista("   ")).toContain('href="/productos/42"');
});

it("14: submit con término en blanco va a /inventario sin query colgante", () => {
  expect(hrefLista({ q: "   ", cursor: null, valores: false })).toBe("/inventario");
});
