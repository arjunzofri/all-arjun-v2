// Fase B — inv11 /inventario (Lista11-A). ROJO: page, ListaInventario y formatearFechaChile no existen.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const lista = vi.hoisted(() => vi.fn());
vi.mock("@/lib/inventario/consultas", () => ({ listarInventario: lista }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((u: string) => { throw new Error(`REDIRECT:${u}`); }) }));
import { auth } from "@/lib/auth";
import { formatearFechaChile } from "@/lib/utils/fecha-chile";
import ListaInventario from "@/components/inventario/ListaInventario";
import Pagina, { dynamic, leerParametrosLista } from "@/app/(dashboard)/inventario/page";
import type { FilaInventario, PosicionContada } from "@/lib/inventario/consultas";
const FECHA = "2026-11-17T02:30:00Z";
const FLAG_PREVIO = process.env.FEATURE_INVENTARIO_BODEGA;
const pos = (o: Partial<PosicionContada> = {}): PosicionContada => ({ id: 1, bodega: 1, planta: "", pasillo: "A1", posicion: "M", cantidad: 5, usuarioId: 1, usuario: "qa-uno", creadoEn: FECHA, ...o });
const fila = (o: Partial<FilaInventario> = {}): FilaInventario => ({ id: 42, codigo: "COD-42", detalle: "SECRETO-DETALLE", codigoPersonal: "ALIAS-42", packing: null, observaciones: null, imagenUrl: "/img/42.png", posiciones: [pos()], stockContado: 5, ...o });
const htmlLista = (items: FilaInventario[]) => renderToStaticMarkup(createElement(ListaInventario, { items }));
const htmlPagina = async (sp: Record<string, string | string[]> = {}) => renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve(sp) }) as ReactElement);
beforeEach(() => { process.env.FEATURE_INVENTARIO_BODEGA = "true"; vi.mocked(auth).mockResolvedValue({ user: { id: "1" } } as never); lista.mockResolvedValue({ items: [fila()], nextCursor: null }); });
afterEach(() => {
  vi.clearAllMocks();
  if (FLAG_PREVIO === undefined) delete process.env.FEATURE_INVENTARIO_BODEGA;
  else process.env.FEATURE_INVENTARIO_BODEGA = FLAG_PREVIO;
});
it("params: trim, cursor válido/ausente null y rechazo de arrays, no-enteros, 0, negativo y overflow", () => {
  const p = leerParametrosLista, pag = { ok: false, error: "Parámetro de página inválido." };
  expect(p({})).toEqual({ ok: true, q: "", cursor: null }); expect(p({ cursor: "" })).toEqual({ ok: true, q: "", cursor: null });
  expect(p({ q: "  hola  ", cursor: "2147483647" })).toEqual({ ok: true, q: "hola", cursor: 2147483647 });
  for (const cursor of ["0", "-1", "abc", "1e3", "1.5", "2147483648", ["1"]]) expect(p({ cursor } as never)).toEqual(pag);
  expect(p({ q: ["a"] } as never)).toEqual({ ok: false, error: "Parámetro de búsqueda inválido." });
  expect(p({ q: "x".repeat(101) })).toEqual({ ok: false, error: "El texto de búsqueda supera 100 caracteres." });
  expect(p({ q: "x".repeat(100) })).toMatchObject({ ok: true, q: "x".repeat(100) });
});
it("auth primero; sin sesión /login aun con flag off y con sesión flag off /productos, sin consultar", async () => {
  process.env.FEATURE_INVENTARIO_BODEGA = "false"; vi.mocked(auth).mockResolvedValueOnce(null as never);
  await expect(htmlPagina()).rejects.toThrow("REDIRECT:/login"); await expect(htmlPagina()).rejects.toThrow("REDIRECT:/productos");
  expect(lista).not.toHaveBeenCalled(); expect(dynamic).toBe("force-dynamic");
});
it("página ON consulta limit 20 con q trimeada y cursor exacto", async () => {
  await htmlPagina({ q: " caño/1 ", cursor: "99" }); expect(lista).toHaveBeenCalledWith({ q: "caño/1", limit: 20, cursor: 99 });
});
it("params inválidos o error del action: error español visible, sin vacío inventado ni consulta", async () => {
  expect(await htmlPagina({ cursor: "abc" })).toContain("Parámetro de página inválido."); expect(lista).not.toHaveBeenCalled();
  lista.mockRejectedValueOnce(new Error("No se pudo obtener el inventario. Intente nuevamente.")); const roto = await htmlPagina();
  expect(roto).toContain("No se pudo obtener el inventario. Intente nuevamente."); expect(roto).not.toContain("Sin coincidencias");
});
it("Lista: foto antes que código, alias, ficha, sin detalle ni costos, Sin contar, sin posiciones y ambas vistas", () => {
  const html = htmlLista([fila({ stockContado: null, posiciones: [] })]);
  ['href="/productos/42"', "Alias: ALIAS-42", "Sin contar", "Sin posiciones contadas", "lg:hidden", "hidden lg:block"].forEach((s) => expect(html).toContain(s));
  expect(html.indexOf("/img/42.png")).toBeLessThan(html.indexOf("COD-42")); expect(html).not.toContain("SECRETO-DETALLE"); expect(html).not.toMatch(/\$|precio|costo/i);
});
it("stock 0 se ve 0, no Sin contar", () => {
  const html = htmlLista([fila({ stockContado: 0, posiciones: [pos({ cantidad: 0 })] })]);
  expect(html).toContain("Total contado: 0 u."); expect(html).not.toContain("Sin contar");
});
it("lista vacía: Sin resultados.", () => { expect(htmlLista([])).toContain("Sin resultados."); });
it("2 posiciones: cada cantidad con su fecha Chile y autor, etiquetas B1/B2 correctas", () => {
  const html = htmlLista([fila({ stockContado: 8, posiciones: [pos(), pos({ id: 2, bodega: 2, planta: "ARRIBA", pasillo: "IZQUIERDA", posicion: "P", cantidad: 3, usuario: "qa-dos" })] })]);
  expect(html).toContain("Total contado: 8 u."); expect(html).toContain("B1 · A1 · Medio · 5 u. · 16-11-2026 · qa-uno"); expect(html).toContain("B2 · Arriba · Izquierda · Principal · 3 u. · 16-11-2026 · qa-dos");
});
it("fecha Chile cruza medianoche UTC al día anterior; inválida em dash", () => {
  expect(formatearFechaChile("2026-11-17T02:30:00Z")).toBe("16-11-2026"); expect(formatearFechaChile("no-es-fecha")).toBe("—");
});
it("Ver más codifica q y cursor; sin nextCursor no hay link; con cursor se vuelve al inicio", async () => {
  lista.mockResolvedValueOnce({ items: [fila()], nextCursor: 41 }); const q = "caño 1/2 & x", enc = "ca%C3%B1o%201%2F2%20%26%20x";
  const conMas = await htmlPagina({ q }); expect(conMas).toContain(`href="/inventario?q=${enc}&amp;cursor=41"`); expect(conMas).toContain("Ver más");
  expect(conMas).toContain("Resultados para"); expect(conMas).toContain("caño 1/2 &amp; x"); expect(conMas).toMatch(/href="\/inventario"[^>]*>Ver todo</);
  expect((await htmlPagina()).includes("Ver más")).toBe(false);
  const conCursor = await htmlPagina({ q, cursor: "41" }); expect(conCursor).toContain(`href="/inventario?q=${enc}"`); expect(conCursor).toContain("Volver al inicio de la lista");
});
