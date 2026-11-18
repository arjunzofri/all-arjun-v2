// Fase B — buscador de inventario (inv-10-A). ROJO: falta BuscadorInventario, onError y dispose. DB mockeada.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createProductoSearch } from "@/components/useProductoSearch";
import type { FilaInventario } from "@/lib/inventario/consultas";

vi.mock("@/lib/inventario/consultas", () => ({
  listarInventario: vi.fn(async () => ({ items: [], nextCursor: null })),
}));

const cargarBuscador = () => import("@/components/inventario/BuscadorInventario");

const fila = (over: Partial<FilaInventario> = {}): FilaInventario => ({
  id: 42, codigo: "COD-42", detalle: "Descripción cuarenta y dos", codigoPersonal: "alias-42",
  packing: null, observaciones: null, imagenUrl: null, posiciones: [], stockContado: null, ...over });

type Sugerencia = { codigo: string; detalle: string | null; imagenUrl: string | null };
const renderLista = async (over: Partial<{ items: FilaInventario[]; error: string | null; consultado: boolean; q: string; onElegir: () => void }> = {}) => {
  const { ListaResultados } = await cargarBuscador();
  return renderToStaticMarkup(createElement(ListaResultados, { items: [], error: null, consultado: true, q: "abc", onElegir: () => {}, ...over }));
};
const deferred = <T = unknown>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe("BuscadorInventario (SSR)", () => {
  it("vacío: form GET real, input search y sin resultados ni vacío falso", async () => {
    const { default: Buscador } = await cargarBuscador();
    const html = renderToStaticMarkup(createElement(Buscador));
    ["<form", 'action="/inventario"', 'name="q"', 'type="search"', "<label", "aria-controls", 'aria-autocomplete="list"', 'aria-expanded="false"'].forEach((s) => expect(html).toContain(s));
    [/method="get"/i, /maxlength="100"/i].forEach((r) => expect(html).toMatch(r));
    expect(html).not.toContain("Sin coincidencias");
    expect(html).not.toMatch(/href="\/productos\//);
  });
  it("dos instancias no repiten IDs (useId)", async () => {
    const { default: Buscador } = await cargarBuscador();
    const html = renderToStaticMarkup(createElement("div", null, createElement(Buscador), createElement(Buscador)));
    const controles = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
    expect(controles).toHaveLength(2); expect(new Set(controles).size).toBe(2);
  });
});

describe("ListaResultados (exportada)", () => {
  it.each([
    { nombre: "error visible con role=alert y nunca confundido con vacío", over: { error: "No se pudo buscar. Intente nuevamente." }, si: ['role="alert"', "No se pudo buscar. Intente nuevamente."], no: ["Sin coincidencias"] },
    { nombre: "sin resultados reales muestra 'Sin coincidencias'", over: {}, si: ["Sin coincidencias"], no: ['role="alert"'] },
  ])("$nombre", async ({ over, si, no }) => {
    const html = await renderLista(over);
    si.forEach((s) => expect(html).toContain(s));
    no.forEach((s) => expect(html).not.toContain(s));
  });
  it("resultado: link directo, imagen, código, alias y descripción; sin importes", async () => {
    const html = await renderLista({ items: [fila({ imagenUrl: "/img/42.png" })], q: "cod" });
    ['href="/productos/42"', "/img/42.png", "COD-42", "alias-42", "Descripción cuarenta y dos", "Sin contar"].forEach((s) => expect(html).toContain(s));
    expect(html).not.toContain("$");
  });
  it("stockContado 0 se distingue de null y muestra '0 u.'", async () => {
    const html = await renderLista({ items: [fila({ id: 7, codigo: "CERO", stockContado: 0 })], q: "cero" });
    expect(html).toMatch(/cero/i); expect(html).toContain("0 u.");
    expect(html).not.toContain("Sin contar");
  });
  it("máximo 12 coincidencias y 'Ver todas' con q codificada", async () => {
    const items = Array.from({ length: 13 }, (_, i) => fila({ id: i + 1, codigo: `C${i + 1}` }));
    const html = await renderLista({ items, q: "caño 1/2" });
    expect((html.match(/href="\/productos\//g) ?? []).length).toBe(12); expect(html).toContain("Ver todas las coincidencias");
    expect(html).toContain('href="/inventario?q=ca%C3%B1o%201%2F2"');
  });
});

describe("createProductoSearch (inv-10-A)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("error de la última consulta llama onError una vez y nunca onResults", async () => {
    const error = new Error("falló"), onResults = vi.fn(), onError = vi.fn();
    const fetchFn = vi.fn().mockRejectedValue(error);
    createProductoSearch({ fetchFn, onResults, onError }).search("abc"); await vi.advanceTimersByTimeAsync(250);
    expect(onError.mock.calls).toEqual([[error]]); expect(onResults).not.toHaveBeenCalled();
  });
  it("respuesta vieja que falla tarde no pisa el resultado nuevo", async () => {
    const nuevo: Sugerencia[] = [{ codigo: "NEW", detalle: "nuevo", imagenUrl: null }];
    const viejo = deferred(), fresh = deferred();
    const fetchFn = vi.fn((q: string) => (q === "aa" ? viejo.promise : fresh.promise));
    const onResults = vi.fn(), onError = vi.fn();
    const search = createProductoSearch({ fetchFn, onResults, onError, debounceMs: 0, minLength: 1 });
    for (const q of ["aa", "abc"]) { search.search(q); await vi.advanceTimersByTimeAsync(0); }
    fresh.resolve({ items: nuevo }); await vi.runAllTimersAsync();
    expect(onResults).toHaveBeenCalledWith(nuevo);
    viejo.reject(new Error("viejo")); await vi.runAllTimersAsync();
    expect(onError).not.toHaveBeenCalled(); expect(onResults).toHaveBeenCalledTimes(1);
  });
  it("sin onError conserva el comportamiento legado: onResults([])", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("falló")), onResults = vi.fn();
    createProductoSearch({ fetchFn, onResults }).search("abc"); await vi.advanceTimersByTimeAsync(250);
    expect(onResults).toHaveBeenCalledWith([]);
  });
  it("minLength por defecto sigue siendo 2: 'a' no busca", () => {
    const fetchFn = vi.fn(), onResults = vi.fn();
    createProductoSearch({ fetchFn, onResults }).search("a"); vi.advanceTimersByTime(300);
    expect(fetchFn).not.toHaveBeenCalled(); expect(onResults).toHaveBeenCalledWith([]);
  });
  it("dispose invalida la petición: respuesta tardía no invoca callbacks", async () => {
    const tardia = deferred(), onResults = vi.fn(), onError = vi.fn();
    const fetchFn = vi.fn(() => tardia.promise);
    const search = createProductoSearch({ fetchFn, onResults, onError, debounceMs: 0, minLength: 1 });
    search.search("abc"); await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    search.dispose(); tardia.resolve({ items: [fila()] }); await vi.runAllTimersAsync();
    expect(onResults).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
  });
});
