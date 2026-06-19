/**
 * Fase B — Debounce en UbicacionDetalle: Tests que intentan romper el slice.
 *
 * Riesgos:
 * 1. Keystrokes rápidos → un solo cargar() tras 250ms, no uno por letra.
 * 2. Checkbox "Solo con stock" sin debounce → cambio inmediato.
 * 3. Cambiar q resetea items/cursor (nueva búsqueda), "Cargar más" appendea.
 *
 * Sin jsdom → se testea createDebounce() exportada del componente,
 * más los patrones de reset vs append que cargar() ya implementa.
 *
 * AHORA EN ROJO: UbicacionDetalle.tsx actual no exporta createDebounce.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── RED: el componente actual no exporta createDebounce ──
let createDebounce: any = null;
try {
  createDebounce = (await import("@/app/(dashboard)/components/UbicacionDetalle")).createDebounce;
} catch {
  // Esperado en Fase B — export no existe
}

describe("UbicacionDetalle — debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Contrato de existencia ────────────────────────────────────────
  it("el componente exporta createDebounce", () => {
    expect(createDebounce).not.toBeNull();
    expect(typeof createDebounce).toBe("function");
  });

  // ── R1: Debounce — un solo callback tras 250ms ────────────────────
  it("dispara el callback una sola vez despues de 250ms con multiples triggers", () => {
    const fn = vi.fn();
    const debounce = createDebounce(fn, 250);

    // 5 triggers rápidos simulando keystrokes
    debounce.trigger();
    debounce.trigger();
    debounce.trigger();
    debounce.trigger();
    debounce.trigger();

    // Antes de 250ms, nada
    expect(fn).toHaveBeenCalledTimes(0);

    // Avanzar 250ms → un solo call
    vi.advanceTimersByTime(250);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // ── R2: Reinicia el timer con cada trigger ────────────────────────
  it("reinicia el timer si un nuevo trigger llega antes de los 250ms", () => {
    const fn = vi.fn();
    const debounce = createDebounce(fn, 250);

    debounce.trigger();
    vi.advanceTimersByTime(200);  // 200ms — aún no dispara
    expect(fn).toHaveBeenCalledTimes(0);

    debounce.trigger();           // nuevo trigger → reinicia timer
    vi.advanceTimersByTime(200);  // solo 200ms desde el último trigger
    expect(fn).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(50);   // completa 250ms desde el último trigger
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // ── R3: cancel() limpia el timer pendiente ────────────────────────
  it("cancel evita que el callback pendiente se ejecute", () => {
    const fn = vi.fn();
    const debounce = createDebounce(fn, 250);

    debounce.trigger();
    debounce.cancel();
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Tests de especificación — NO son tests de regresión real.
//
// No importan nada de UbicacionDetalle.tsx. Describen el comportamiento
// ESPERADO de cargar() (reset vs append) y del checkbox (inmediato,
// sin debounce). Si alguien rompe cargar() en el componente real, estos
// tests NO lo detectan — solo documentan el contrato.
//
// La alternativa (extraer ternarios de 1 línea a funciones exportadas
// solo para testearlos) se descartó por sobre-ingeniería.
// ══════════════════════════════════════════════════════════════════════

type Item = { id: number; codigo: string; detalle: string | null; packing: number | null; cantidad: number };

describe("UbicacionDetalle — especificación (NO regresión)", () => {
  it("[especificación] cambiar q resetea items y cursor (no appendea)", () => {
    const viejos: Item[] = [{ id: 1, codigo: "A", detalle: "Alpha", packing: null, cantidad: 5 }];
    const nuevos: Item[] = [{ id: 2, codigo: "B", detalle: "Beta", packing: null, cantidad: 3 }];

    let items: Item[] = [...viejos];

    // Patrón que cargar(true) implementa: items = page.items (replace)
    items = nuevos;

    expect(items).toEqual(nuevos);
    expect(items).toHaveLength(1);
  });

  it("[especificación] Cargar mas appendea sin resetear items existentes", () => {
    const viejos: Item[] = [{ id: 1, codigo: "A", detalle: "Alpha", packing: null, cantidad: 5 }];
    const nuevos: Item[] = [{ id: 2, codigo: "B", detalle: "Beta", packing: null, cantidad: 3 }];

    let items: Item[] = [...viejos];

    // Patrón que cargar(false) implementa: items = [...prev, ...page.items] (append)
    items = [...items, ...nuevos];

    expect(items).toEqual([...viejos, ...nuevos]);
    expect(items).toHaveLength(2);
  });

  it("[especificación] soloConStock dispara cargar inmediatamente, sin debounce", () => {
    // El onChange del checkbox llama cargar(true) sin pasar por createDebounce.
    // Este test documenta que el contrato exige ejecución sincrónica.
    let called = false;
    const handler = () => { called = true; };
    handler();
    expect(called).toBe(true);
  });
});
