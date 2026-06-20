/**
 * Fase B — useProductoSearch hook: Tests que intentan romper el slice.
 *
 * Riesgos:
 * 1. Debounce: múltiples search() rápidos → un solo fetch tras 250ms.
 * 2. minLength: q.length < 2 → onResults([]) inmediato, sin fetch.
 * 3. Guard externo: si guard() retorna false → onResults([]) inmediato.
 * 4. Guard + minLength combinados: ambos deben cumplirse para el fetch.
 * 5. Normalización de respuesta: array directo (buscar-historico) y
 *    { items: [...] } (por-bodega) se normalizan igual.
 *
 * createProductoSearch() es la función pura testeable, sin jsdom.
 *
 * AHORA EN ROJO: el archivo no existe.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── RED: el hook no existe ──
let createProductoSearch: any = null;
try {
  createProductoSearch = (await import("@/components/useProductoSearch")).createProductoSearch;
} catch {
  // Esperado en Fase B
}

type Sugerencia = { codigo: string; detalle: string | null; imagenUrl: string | null };

describe("createProductoSearch", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("el hook exporta createProductoSearch", () => {
    expect(createProductoSearch).not.toBeNull();
    expect(typeof createProductoSearch).toBe("function");
  });

  // ── R1: Debounce 250ms ──────────────────────────────────────────
  it("dispara un solo fetch tras 250ms de inactividad", async () => {
    const fetchFn = vi.fn().mockResolvedValue([{ codigo: "A", detalle: null, imagenUrl: null }]);
    const onResults = vi.fn();
    const search = createProductoSearch({ fetchFn, onResults });

    search.search("a");
    search.search("ab");
    search.search("abc");

    expect(fetchFn).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(250);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith("abc");
  });

  // ── R2: minLength ───────────────────────────────────────────────
  it("q con menos de minLength caracteres limpia resultados sin fetch", () => {
    const fetchFn = vi.fn();
    const onResults = vi.fn();
    const search = createProductoSearch({ fetchFn, onResults, minLength: 3 });

    search.search("ab");
    vi.advanceTimersByTime(300);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(onResults).toHaveBeenCalledWith([]);
  });

  // ── R3: Guard externo false → sin fetch ─────────────────────────
  it("guard() false: limpia resultados sin fetch, aunque q sea largo", () => {
    const fetchFn = vi.fn();
    const onResults = vi.fn();
    const search = createProductoSearch({ fetchFn, onResults, guard: () => false });

    search.search("test-largo");
    vi.advanceTimersByTime(300);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(onResults).toHaveBeenCalledWith([]);
  });

  // ── R4: Guard + minLength combinados ────────────────────────────
  it("ambos deben cumplirse: guard()=true Y q.length >= minLength", async () => {
    const fetchFn = vi.fn().mockResolvedValue([]);
    const onResults = vi.fn();
    const search = createProductoSearch({ fetchFn, onResults, minLength: 3, guard: () => true });

    // Falla por minLength
    search.search("ab");
    vi.advanceTimersByTime(300);
    expect(fetchFn).not.toHaveBeenCalled();

    // Pasa ambos
    search.search("abc");
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  // ── R5: Normaliza respuesta array directo ───────────────────────
  it("normaliza respuesta tipo array (buscar-historico)", async () => {
    const items: Sugerencia[] = [{ codigo: "A", detalle: "Alpha", imagenUrl: null }];
    const fetchFn = vi.fn().mockResolvedValue(items);
    const onResults = vi.fn();
    const search = createProductoSearch({ fetchFn, onResults });

    search.search("alpha");
    await vi.advanceTimersByTimeAsync(250);

    expect(onResults).toHaveBeenCalledWith(items);
  });

  // ── R6: Normaliza respuesta tipo { items: [...] } ───────────────
  it("normaliza respuesta tipo { items: [...] } (por-bodega)", async () => {
    const items: Sugerencia[] = [{ codigo: "B", detalle: "Beta", imagenUrl: null }];
    const fetchFn = vi.fn().mockResolvedValue({ items });
    const onResults = vi.fn();
    const search = createProductoSearch({ fetchFn, onResults });

    search.search("beta");
    await vi.advanceTimersByTimeAsync(250);

    expect(onResults).toHaveBeenCalledWith(items);
  });

  // ── R7: Race condition — respuesta vieja no pisa a la nueva ─────
  // Mismo patrón que createProductSearch R2 (productos-search.test.ts:69-112).
  it("descarta respuesta de query vieja si una query mas nueva ya resolvio", async () => {
    const itemOld: Sugerencia[] = [{ codigo: "OLD", detalle: "Resultado viejo", imagenUrl: null }];
    const itemNew: Sugerencia[] = [{ codigo: "NEW", detalle: "Resultado nuevo", imagenUrl: null }];

    let resolveOld!: (value: Sugerencia[]) => void;
    let resolveNew!: (value: Sugerencia[]) => void;

    const fetchFn = vi.fn().mockImplementation(((_q: string) => {
      if (_q === "aa") return new Promise((r) => { resolveOld = r; });
      if (_q === "abc") return new Promise((r) => { resolveNew = r; });
      return Promise.resolve([] as Sugerencia[]);
    }));

    const onResults = vi.fn();
    const search = createProductoSearch({ fetchFn, onResults, debounceMs: 0, minLength: 1 });

    // Disparo "aa", avanzo timer, disparo "abc", avanzo timer
    search.search("aa");
    await vi.advanceTimersByTimeAsync(0);
    search.search("abc");
    await vi.advanceTimersByTimeAsync(0);

    // "abc" resuelve primero
    resolveNew(itemNew);
    await vi.runAllTimersAsync();

    expect(onResults).toHaveBeenCalledWith(itemNew);

    // "aa" resuelve después — NO debe pisar
    resolveOld(itemOld);
    await vi.runAllTimersAsync();

    // La última llamada a onResults sigue siendo la de "abc"
    expect(onResults).toHaveBeenCalledTimes(1);
  });

  // ── R8: dispose cancela timer y fetch ───────────────────────────
  it("dispose limpia timer pendiente", () => {
    const fetchFn = vi.fn();
    const onResults = vi.fn();
    const search = createProductoSearch({ fetchFn, onResults });

    search.search("test");
    search.dispose();
    vi.advanceTimersByTime(300);

    expect(fetchFn).not.toHaveBeenCalled();
  });
});
