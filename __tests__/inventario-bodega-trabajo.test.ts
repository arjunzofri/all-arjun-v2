/**
 * Fase B — inv-08: store cliente de bodega de trabajo.
 * ROJO esperado: no existe components/inventario/useBodegaTrabajo.ts.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { fijarBodegaTrabajo, limpiarBodegaTrabajo, obtenerBodegaTrabajo, suscribirBodegaTrabajo, useBodegaTrabajo } from "@/components/inventario/useBodegaTrabajo";

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;
const clave = (id: string) => `inventario.bodega-trabajo.v1.${id}`;
function fake(initial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(initial));
  return { datos,
    getItem: vi.fn((k: string) => datos.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void datos.set(k, v)),
    removeItem: vi.fn((k: string) => void datos.delete(k)) };
}
type Fake = ReturnType<typeof fake>;
const instalar = (f: Fake) => (vi.stubGlobal("sessionStorage", f), f);
afterEach(() => { vi.unstubAllGlobals(); delete (globalThis as { sessionStorage?: unknown }).sessionStorage; }); // accessor propio que lanza
type Uid = string | number | null | undefined;
const Probe = ({ userId }: { userId: Uid }) => {
  const api = useBodegaTrabajo(userId);
  return createElement("span", null, [String(api.bodegaTrabajo), typeof api.fijarBodegaTrabajo, typeof api.limpiarBodegaTrabajo].join(":"));
};

it("SSR: no toca storage y renderiza null", () => {
  const f = instalar(fake({ [clave("ssr-1")]: "2" }));
  const html = renderToString(createElement(Probe, { userId: "ssr-1" }));
  expect(html).toContain("null:function:function");
  expect(f.getItem).not.toHaveBeenCalled();
  expect(f.setItem).not.toHaveBeenCalled();
  expect(f.removeItem).not.toHaveBeenCalled();
});
it("lee solo \"1\" y \"2\" por usuario", () => {
  const a = uid("a"), b = uid("b");
  instalar(fake({ [clave(a)]: "1", [clave(b)]: "2" }));
  expect(obtenerBodegaTrabajo(a)).toBe(1);
  expect(obtenerBodegaTrabajo(b)).toBe(2);
});
it("cualquier otro valor crudo produce null", () => {
  const f = instalar(fake());
  for (const raw of ["", "0", "3", "true", "null", '{"b":1}', "2.0"]) {
    const id = uid("corrupto");
    f.datos.set(clave(id), raw);
    expect(obtenerBodegaTrabajo(id)).toBeNull();
  }
});
it("aisla usuarios y escribe claves distintas", () => {
  const f = instalar(fake());
  const a = uid("a"), b = uid("b"), c = uid("c");
  fijarBodegaTrabajo(a, 1); fijarBodegaTrabajo(b, 2);
  expect([obtenerBodegaTrabajo(a), obtenerBodegaTrabajo(b), obtenerBodegaTrabajo(c)]).toEqual([1, 2, null]);
  expect(f.datos.get(clave(a))).toBe("1");
  expect(f.datos.get(clave(b))).toBe("2");
  expect(f.datos.size).toBe(2);
});
it("ignora valores inválidos y ID vacío no persiste ni notifica", () => {
  const f = instalar(fake()), a = uid("invalido"), oyente = vi.fn();
  suscribirBodegaTrabajo(a, oyente);
  for (const malo of [0, 3, "1", "2", true, undefined, NaN]) fijarBodegaTrabajo(a, malo as never);
  expect(obtenerBodegaTrabajo(a)).toBeNull();
  expect([oyente.mock.calls.length, f.setItem.mock.calls.length]).toEqual([0, 0]);
  for (const vacio of ["", "   "]) { fijarBodegaTrabajo(vacio, 1); limpiarBodegaTrabajo(vacio); }
  expect(obtenerBodegaTrabajo("")).toBeNull();
  expect([f.setItem.mock.calls.length, f.removeItem.mock.calls.length, f.datos.size]).toEqual([0, 0, 0]);
});
it("notifica sin duplicar mismo valor y unsubscribe es idempotente", () => {
  instalar(fake());
  const a = uid("sub"), uno = vi.fn(), dos = vi.fn();
  const offUno = suscribirBodegaTrabajo(a, uno);
  suscribirBodegaTrabajo(a, dos);
  fijarBodegaTrabajo(a, 1); fijarBodegaTrabajo(a, 1); fijarBodegaTrabajo(a, 2);
  expect([uno.mock.calls.length, dos.mock.calls.length]).toEqual([2, 2]);
  offUno(); offUno();
  fijarBodegaTrabajo(a, null);
  expect([uno.mock.calls.length, dos.mock.calls.length]).toEqual([2, 3]);
});
it("limpieza explícita notifica una vez y borra la clave", () => {
  const f = instalar(fake()), a = uid("limpia"), oyente = vi.fn();
  suscribirBodegaTrabajo(a, oyente);
  fijarBodegaTrabajo(a, 2);
  limpiarBodegaTrabajo(a);
  expect(obtenerBodegaTrabajo(a)).toBeNull();
  expect(f.datos.has(clave(a))).toBe(false);
  expect(oyente).toHaveBeenCalledTimes(2);
  limpiarBodegaTrabajo(a);
  expect(oyente).toHaveBeenCalledTimes(2);
  f.datos.set(clave(a), "2"); limpiarBodegaTrabajo(a);
  expect([f.datos.has(clave(a)), oyente.mock.calls.length]).toEqual([false, 2]);
});
it("storage con métodos que lanzan: la memoria sostiene la selección", () => {
  const f = fake();
  f.getItem.mockImplementation(() => { throw new Error("no"); });
  f.setItem.mockImplementation(() => { throw new Error("no"); });
  f.removeItem.mockImplementation(() => { throw new Error("no"); });
  instalar(f);
  const a = uid("denegado");
  expect(obtenerBodegaTrabajo(a)).toBeNull();
  fijarBodegaTrabajo(a, 2);
  expect(obtenerBodegaTrabajo(a)).toBe(2);
  limpiarBodegaTrabajo(a);
  expect(obtenerBodegaTrabajo(a)).toBeNull();
});
it("accessor de sessionStorage que lanza no rompe", () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("denegado"); } });
  const a = uid("acceso");
  expect(() => obtenerBodegaTrabajo(a)).not.toThrow();
  expect(obtenerBodegaTrabajo(a)).toBeNull();
  fijarBodegaTrabajo(a, 1);
  expect(obtenerBodegaTrabajo(a)).toBe(1);
  limpiarBodegaTrabajo(a);
  expect(obtenerBodegaTrabajo(a)).toBeNull();
});
