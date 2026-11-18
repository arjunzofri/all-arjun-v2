/**
 * Fase B — inv-16-B: hook React de borradores (SSR estable, sin lecturas).
 * ROJO esperado: components/inventario/useBorradoresConteo.ts no existe (Fase C).
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { useBorradoresConteo } from "@/components/inventario/useBorradoresConteo";
import { guardarBorradorConteo, limpiarBorradoresConteo, obtenerBorradoresConteo, obtenerTokenBorradores } from "@/components/inventario/borradoresConteoStore";
import { claveBorrador } from "@/lib/inventario/borradores-conteo";

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`, CLAVE = (id: string) => `inventario.borradores-conteo.v1.${id}`;
const U2 = { bodega: 2 as const, planta: "ARRIBA" as const, pasillo: "IZQUIERDA" as const, posicion: "M" as const }, N = "11111111-1111-4111-8111-111111111111";
type Api = ReturnType<typeof useBorradoresConteo>;
const captura: { api?: Api } = {};
const Probe = ({ userId, onApi }: { userId: string | number | null | undefined; onApi?: (a: Api) => void }) => {
  const a = useBorradoresConteo(userId);
  onApi?.(a);
  const tipos = ["borrador", "deProducto", "ultimoCompatible", "guardar", "descartar"].map((k) => typeof (a as unknown as Record<string, unknown>)[k]);
  return createElement("span", null, [String(Object.keys(a.borradores).length), Object.keys(a).sort().join(","), tipos.join(",")].join("|"));
};
const capturar = { onApi: (a: Api) => { captura.api = a; } };
const fake = (initial: Record<string, string> = {}) => {
  const datos = new Map(Object.entries(initial));
  return { datos, getItem: vi.fn((k: string) => datos.get(k) ?? null), setItem: vi.fn((k: string, v: string) => void datos.set(k, v)), removeItem: vi.fn((k: string) => void datos.delete(k)) };
};
const instalar = (f: ReturnType<typeof fake>) => (vi.stubGlobal("sessionStorage", f), f);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete (globalThis as { sessionStorage?: unknown }).sessionStorage; });

const CLAVES = "borrador,borradores,deProducto,descartar,guardar,ultimoCompatible";
const FIRMAS = "function,function,function,function,function";
const ESPERADO = `0|${CLAVES}|${FIRMAS}`;

it("SSR: snapshot vacío, seis claves correctas y cero lecturas de storage con datos", () => {
  const id = uid("ssr"), f = instalar(fake({ [CLAVE(id)]: '{"x":1}' }));
  const html = renderToString(createElement(Probe, { userId: id, ...capturar }));
  expect([html.includes(ESPERADO), f.getItem.mock.calls.length, f.setItem.mock.calls.length, f.removeItem.mock.calls.length]).toEqual([true, 0, 0, 0]);
});
it("SSR: accessor de storage que lanza e ids sin usuario no rompen", () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("denegado"); } });
  for (const id of ["u-1", "", "   ", null, undefined]) expect(renderToString(createElement(Probe, { userId: id, ...capturar }))).toContain(ESPERADO);
});
it("mutadores capturados: token de montaje no resucita ni borra drafts nuevos", () => {
  const id = uid("mut"); instalar(fake());
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(N);
  renderToString(createElement(Probe, { userId: id, ...capturar }));
  expect(captura.api!.guardar({ productoId: 7, ubicacion: U2, expectedConteoId: null }, "3")).not.toBeNull();
  expect([Object.keys(obtenerBorradoresConteo(id)), obtenerBorradoresConteo("otro-uid")]).toEqual([[claveBorrador(7, U2)], {}]);
  limpiarBorradoresConteo(id);
  expect(captura.api!.guardar({ productoId: 7, ubicacion: U2, expectedConteoId: null }, "9")).toBeNull();
  expect(obtenerBorradoresConteo(id)).toEqual({});
  expect(guardarBorradorConteo(id, obtenerTokenBorradores(id), { productoId: 8, ubicacion: U2, expectedConteoId: null }, "4", 1, () => N)).not.toBeNull();
  captura.api!.descartar(8, U2);
  expect(obtenerBorradoresConteo(id)).toHaveProperty(claveBorrador(8, U2));
});
