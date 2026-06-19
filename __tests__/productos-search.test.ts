/**
 * Fase B — Búsqueda en vivo en /productos: Tests que intentan romper el slice.
 *
 * Riesgos:
 * 1. Debounce: keystrokes rápidos → un solo fetch tras 250ms de inactividad.
 * 2. Race condition: respuesta vieja pisa a la nueva → fetch obsoleto se descarta.
 * 3. Campo vacío restaura: borrar input → fetch sin q → lista completa.
 * 4. Error de API: 401/500 → error visible, no tabla vacía silenciosa.
 * 5. Smoke: carga inicial → escribir → borrar → restaura.
 *
 * Sin jsdom → no se renderiza el componente. Se testea createProductSearch(),
 * la función pura que encapsula debounce + AbortController + callbacks.
 *
 * AHORA EN ROJO: el archivo page.tsx actual no exporta createProductSearch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── RED: page.tsx actual no exporta createProductSearch ──
let createProductSearch: any = null;
try {
  createProductSearch = (await import("@/app/(dashboard)/productos/page")).createProductSearch;
} catch {
  // Esperado en Fase B — export no existe en el Server Component actual
}

type ProductoItem = { id: number; codigo: string; detalle: string | null; packing: number | null; ubicacion: string | null };

describe("productos — búsqueda en vivo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Contrato de existencia ────────────────────────────────────────
  it("el archivo exporta createProductSearch", () => {
    expect(createProductSearch).not.toBeNull();
    expect(typeof createProductSearch).toBe("function");
  });

  // ── R1: Debounce 250ms ────────────────────────────────────────────
  it("dispara un solo fetch después de 250ms de inactividad, no uno por keystroke", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValue({ items: [], nextCursor: null });
    const onResults = vi.fn();
    const onError = vi.fn();
    const onLoading = vi.fn();

    const search = createProductSearch({ fetchFn, onResults, onError, onLoading, debounceMs: 250 });

    // 3 keystrokes rápidos
    search.search("a");
    search.search("ab");
    search.search("abc");

    // Antes de que pasen 250ms, ningún fetch
    expect(fetchFn).toHaveBeenCalledTimes(0);

    // Avanzar 250ms
    await vi.advanceTimersByTimeAsync(250);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith("abc", expect.any(AbortSignal));
  });

  // ── R2: Race condition — respuesta vieja no pisa a la nueva ────────
  it("descarta respuesta de query vieja si una query más nueva ya resolvió", async () => {
    // fetch para "a" tarda 500ms, fetch para "abc" tarda 100ms
    const itemA: ProductoItem = { id: 1, codigo: "A001", detalle: "Resultado A", packing: null, ubicacion: null };
    const itemABC: ProductoItem = { id: 2, codigo: "ABC01", detalle: "Resultado ABC", packing: null, ubicacion: null };

    let resolveA!: (value: { items: ProductoItem[]; nextCursor: null }) => void;
    let resolveABC!: (value: { items: ProductoItem[]; nextCursor: null }) => void;

    const fetchFn = vi.fn()
      .mockImplementation(((_q: string) => {
        if (_q === "a") return new Promise((r) => { resolveA = r; });
        if (_q === "abc") return new Promise((r) => { resolveABC = r; });
        return Promise.resolve({ items: [], nextCursor: null });
      }) as any);

    const results: ProductoItem[][] = [];
    const onResults = vi.fn((items: ProductoItem[]) => { results.push([...items]); });
    const onError = vi.fn();
    const onLoading = vi.fn();

    const search = createProductSearch({ fetchFn, onResults, onError, onLoading, debounceMs: 0 });

    // Disparo "a", avanzo timer, disparo "abc", avanzo timer
    search.search("a");
    await vi.advanceTimersByTimeAsync(0);
    search.search("abc");
    await vi.advanceTimersByTimeAsync(0);

    // "abc" resuelve primero
    resolveABC({ items: [itemABC], nextCursor: null });
    await vi.runAllTimersAsync();

    expect(onResults).toHaveBeenCalledWith([itemABC], null);

    // "a" resuelve después — NO debe pisar
    resolveA({ items: [itemA], nextCursor: null });
    await vi.runAllTimersAsync();

    // La última llamada a onResults sigue siendo la de "abc"
    const lastCall = results[results.length - 1];
    expect(lastCall).toEqual([itemABC]);
    expect(onResults).toHaveBeenCalledTimes(1);
  });

  // ── R3: Campo vacío restaura lista completa ────────────────────────
  it("al borrar el input, busca con q='' y devuelve la lista completa", async () => {
    const items: ProductoItem[] = [
      { id: 1, codigo: "A001", detalle: "Alpha", packing: null, ubicacion: null },
      { id: 2, codigo: "B002", detalle: "Beta", packing: null, ubicacion: null },
    ];

    const fetchFn = vi.fn()
      .mockResolvedValue({ items, nextCursor: null });
    const onResults = vi.fn();
    const onError = vi.fn();
    const onLoading = vi.fn();

    const search = createProductSearch({ fetchFn, onResults, onError, onLoading, debounceMs: 0 });

    // Buscar algo que no existe
    search.search("xyz");
    await vi.runAllTimersAsync();
    // fetchFn se llamó con "xyz"
    expect(fetchFn).toHaveBeenCalledWith("xyz", expect.any(AbortSignal));

    // Borrar input
    search.search("");
    await vi.runAllTimersAsync();
    // fetchFn se llamó con ""
    expect(fetchFn).toHaveBeenCalledWith("", expect.any(AbortSignal));
    // onResults recibió los items completos
    expect(onResults).toHaveBeenLastCalledWith(items, null);
  });

  // ── R4: Error de API → estado de error visible ─────────────────────
  it("llama onError cuando el fetch falla, no deja la tabla en silencio", async () => {
    const fetchFn = vi.fn()
      .mockRejectedValue(new Error("500 Internal Server Error"));
    const onResults = vi.fn();
    const onError = vi.fn();
    const onLoading = vi.fn();

    const search = createProductSearch({ fetchFn, onResults, onError, onLoading, debounceMs: 0 });

    search.search("test");
    await vi.runAllTimersAsync();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toContain("500");
    expect(onResults).not.toHaveBeenCalled();
  });

  // ── R5: Smoke — flujo completo ─────────────────────────────────────
  it("carga inicial → escribir filtra → borrar restaura", async () => {
    const todos: ProductoItem[] = [
      { id: 1, codigo: "A001", detalle: "Alpha", packing: null, ubicacion: null },
      { id: 2, codigo: "B002", detalle: "Beta", packing: null, ubicacion: null },
      { id: 3, codigo: "C003", detalle: "Gamma", packing: null, ubicacion: null },
    ];
    const filtrado: ProductoItem[] = [
      { id: 3, codigo: "C003", detalle: "Gamma", packing: null, ubicacion: null },
    ];

    const fetchFn = vi.fn()
      .mockImplementation((async (q: string) => {
        if (!q) return { items: todos, nextCursor: null };
        return { items: todos.filter((p) => p.detalle!.toLowerCase().includes(q.toLowerCase())), nextCursor: null };
      }) as any);

    const results: ProductoItem[][] = [];
    const onResults = vi.fn((items: ProductoItem[]) => { results.push([...items]); });
    const onError = vi.fn();
    const onLoading = vi.fn();

    const search = createProductSearch({ fetchFn, onResults, onError, onLoading, debounceMs: 0 });

    // Carga inicial
    search.search("");
    await vi.runAllTimersAsync();
    expect(results[0]).toEqual(todos);

    // Filtrar
    search.search("gamma");
    await vi.runAllTimersAsync();
    expect(results[results.length - 1]).toEqual(filtrado);

    // Borrar → restaura
    search.search("");
    await vi.runAllTimersAsync();
    expect(results[results.length - 1]).toEqual(todos);
  });
});
