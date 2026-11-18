/**
 * Fase B — inv-16-B: logout del shell limpia bodega y borradores del uid actual.
 * ROJO esperado: InventarioShell aún no limpia borradores en onBeforeSignOut (Fase C).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { guardarBorradorConteo, obtenerBorradoresConteo, obtenerTokenBorradores } from "@/components/inventario/borradoresConteoStore";
import { claveBorrador } from "@/lib/inventario/borradores-conteo";
import { obtenerBodegaTrabajo } from "@/components/inventario/useBodegaTrabajo";

const m = vi.hoisted(() => ({ cb: undefined as undefined | (() => void) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/inventario" }));
vi.mock("@/components/inventario/BuscadorInventario", () => ({ default: () => null }));
vi.mock("@/components/LogoutButton", () => ({ default: (p: { onBeforeSignOut?: () => void }) => { m.cb = p.onBeforeSignOut; return null; } }));
import InventarioShell from "@/components/inventario/InventarioShell";

const PROPIO = "u-propio", AJENO = "u-ajeno";
const B = (id: string) => `inventario.bodega-trabajo.v1.${id}`, K = (id: string) => `inventario.borradores-conteo.v1.${id}`;
const U2 = { bodega: 2 as const, planta: "ARRIBA" as const, pasillo: "IZQUIERDA" as const, posicion: "M" as const };
const N = "11111111-1111-4111-8111-111111111111";
const fake = (initial: Record<string, string> = {}) => {
  const datos = new Map(Object.entries(initial));
  return { datos, getItem: vi.fn((k: string) => datos.get(k) ?? null), setItem: vi.fn((k: string, v: string) => void datos.set(k, v)), removeItem: vi.fn((k: string) => void datos.delete(k)) };
};
const draft = (productoId: number) => ({ productoId, ubicacion: U2, cantidadTexto: "3", expectedConteoId: null, nonce: N, actualizadoEn: 10 });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete (globalThis as { sessionStorage?: unknown }).sessionStorage; });

it("SSR captura el callback; el evento limpia solo el uid actual e invalida tokens viejos", () => {
  const f = fake({ [B(PROPIO)]: "2", [K(PROPIO)]: JSON.stringify({ [claveBorrador(7, U2)]: draft(7) }), [B(AJENO)]: "1", [K(AJENO)]: JSON.stringify({ [claveBorrador(8, U2)]: draft(8) }) });
  vi.stubGlobal("sessionStorage", f);
  const token0 = obtenerTokenBorradores(PROPIO);
  renderToStaticMarkup(createElement(InventarioShell, { userId: PROPIO, username: "pablo", esAdmin: false }, "CONT"));
  expect(typeof m.cb).toBe("function");
  expect([f.datos.has(B(PROPIO)), f.datos.has(K(PROPIO))]).toEqual([true, true]); // SSR no ejecutó el callback
  m.cb!();
  expect([obtenerBodegaTrabajo(PROPIO), obtenerBorradoresConteo(PROPIO)]).toEqual([null, {}]);
  expect([f.datos.has(B(PROPIO)), f.datos.has(K(PROPIO)), f.datos.get(B(AJENO)), f.datos.has(K(AJENO))]).toEqual([false, false, "1", true]);
  expect(obtenerTokenBorradores(PROPIO) > token0).toBe(true);
  expect(guardarBorradorConteo(PROPIO, token0, { productoId: 7, ubicacion: U2, expectedConteoId: null }, "9", 1, () => N)).toBeNull();
  expect(f.datos.has(K(PROPIO))).toBe(false);
});
