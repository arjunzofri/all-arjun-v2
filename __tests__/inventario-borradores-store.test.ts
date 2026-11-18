/**
 * Fase B — inv-16.1: store cliente de borradores de conteo (sin React/hook/caller).
 * ROJO esperado: components/inventario/borradoresConteoStore.ts se implementa en Fase C.
 */
import { afterEach, expect, it, vi } from "vitest";
import { BORRADORES_VACIOS, descartarBorradorConteo, guardarBorradorConteo, limpiarBorradoresConteo, obtenerBorradoresConteo, obtenerTokenBorradores, suscribirBorradoresConteo } from "@/components/inventario/borradoresConteoStore";
import { claveBorrador, type BorradorConteo, type EntradaBorrador } from "@/lib/inventario/borradores-conteo";
import type { UbicacionInventario } from "@/lib/inventario/ubicaciones";

const N1 = "11111111-1111-4111-8111-111111111111", N2 = "22222222-2222-4222-8222-222222222222", N3 = "33333333-3333-4333-8333-333333333333";
const U1: UbicacionInventario = { bodega: 1, planta: "", pasillo: "A1", posicion: "F" }, U2: UbicacionInventario = { bodega: 2, planta: "ARRIBA", pasillo: "IZQUIERDA", posicion: "M" };
const borrador = (productoId: number = 7, ubicacion: UbicacionInventario = U1, extra: Partial<BorradorConteo> = {}): BorradorConteo => ({ productoId, ubicacion, cantidadTexto: "1", expectedConteoId: null, nonce: N1, actualizadoEn: 10, ...extra });
const entrada = (productoId: number = 7, ubicacion: UbicacionInventario = U1, expectedConteoId: number | null = null): EntradaBorrador => ({ productoId, ubicacion, expectedConteoId });
let seq = 0;
const uid = (p: string) => `${p}-${++seq}`, CLAVE = (id: string) => `inventario.borradores-conteo.v1.${id}`;
const fake = (initial: Record<string, string> = {}) => {
  const datos = new Map(Object.entries(initial));
  return { datos, getItem: vi.fn((k: string) => datos.get(k) ?? null), setItem: vi.fn((k: string, v: string) => void datos.set(k, v)), removeItem: vi.fn((k: string) => void datos.delete(k)) };
};
const instalar = (f: ReturnType<typeof fake>) => (vi.stubGlobal("sessionStorage", f), f);
const guardar = (id: string, token: number, e: EntradaBorrador, texto: string, ahora: number, nonce = N1) => guardarBorradorConteo(id, token, e, texto, ahora, () => nonce);
afterEach(() => { vi.unstubAllGlobals(); delete (globalThis as { sessionStorage?: unknown }).sessionStorage; });

it("1 carga aislada/trim, snapshot estable, UID inválido vacío", () => {
  const a = uid("a"), b = uid("b"), k = claveBorrador(7, U1), f = instalar(fake({ [CLAVE(a)]: JSON.stringify({ [k]: borrador() }) }));
  const mapa = obtenerBorradoresConteo(` ${a} `);
  expect(mapa).toEqual({ [k]: borrador() });
  expect(obtenerBorradoresConteo(a)).toBe(mapa);
  expect(obtenerBorradoresConteo(b)).toEqual({});
  const lecturas = f.getItem.mock.calls.length;
  for (const v of ["", "   ", null, undefined]) expect(obtenerBorradoresConteo(v)).toEqual({});
  expect([f.getItem.mock.calls.length, Object.keys(BORRADORES_VACIOS)]).toEqual([lecturas, []]);
});
it("2 raíz inválida y entradas manipuladas: descarta solo inválidas sin throw", () => {
  const f = instalar(fake());
  for (const [i, raw] of ["{", "[]", "null", '"x"', "42"].entries()) { const id = uid(`r${i}`); f.datos.set(CLAVE(id), raw); expect(obtenerBorradoresConteo(id)).toEqual({}); }
  const a = uid("mix"), ok = borrador(), k = claveBorrador(7, U1);
  f.datos.set(CLAVE(a), JSON.stringify({ [k]: ok, [claveBorrador(10, U1)]: borrador(9, U1), [claveBorrador(0, U1)]: borrador(0, U1, { nonce: N2 }), [claveBorrador(11, U1)]: { ...borrador(11, U1), extra: 1 }, [claveBorrador(12, U1)]: [borrador(12, U1)] }));
  const mapa = obtenerBorradoresConteo(a);
  expect([Object.keys(mapa), Object.keys(mapa[k]).sort(), Object.keys(mapa[k].ubicacion).sort()]).toEqual([[k], ["actualizadoEn", "cantidadTexto", "expectedConteoId", "nonce", "productoId", "ubicacion"], ["bodega", "pasillo", "planta", "posicion"]]);
  const p = uid("proto"); f.datos.set(CLAVE(p), '{"__proto__":{"contaminado":true}}');
  const proto = obtenerBorradoresConteo(p);
  expect([Object.keys(proto).length, (proto as { contaminado?: boolean }).contaminado, ({} as { contaminado?: boolean }).contaminado]).toEqual([0, undefined, undefined]);
});
it("3 storage que lanza o cupo: memoria autoritativa sin throw", () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("no"); } }); const a = uid("acc");
  expect([obtenerBorradoresConteo(a), guardar(a, obtenerTokenBorradores(a), entrada(), "5", 1)?.cantidadTexto]).toEqual([{}, "5"]);
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  for (const [modo, get, set, remove] of [["get", 1, 0, 0], ["set", 0, 1, 0], ["remove", 0, 0, 1], ["cupo", 1, 1, 1]] as const) {
    const f = fake(), tira = () => { throw new Error("no"); };
    if (get) f.getItem.mockImplementation(tira);
    if (set) f.setItem.mockImplementation(() => { throw new DOMException("lleno", "QuotaExceededError"); });
    if (remove) f.removeItem.mockImplementation(tira);
    instalar(f); const id = uid(modo);
    expect([obtenerBorradoresConteo(id), guardar(id, obtenerTokenBorradores(id), entrada(), "7", 2)?.cantidadTexto]).toEqual([{}, "7"]);
    expect(() => limpiarBorradoresConteo(id)).not.toThrow(); expect(obtenerBorradoresConteo(id)).toEqual({});
  }
});
it("4 guardar: crea, mismo texto no persiste/notifica, fábrica rota, expected original", () => {
  const f = instalar(fake()), a = uid("g"), k = claveBorrador(7, U1), oyente = vi.fn();
  suscribirBorradoresConteo(a, oyente);
  const token = obtenerTokenBorradores(a), creado = guardar(a, token, entrada(7, U1, 5), "12", 100, N1)!;
  expect([creado.cantidadTexto, creado.expectedConteoId, creado.nonce, JSON.parse(f.datos.get(CLAVE(a))!)[k], oyente.mock.calls.length]).toEqual(["12", 5, N1, creado, 1]);
  const sets = f.setItem.mock.calls.length, igual = guardar(a, token, entrada(7, U1, 999), "12", 200, N2);
  expect([igual === creado, igual?.expectedConteoId, f.setItem.mock.calls.length, oyente.mock.calls.length]).toEqual([true, 5, sets, 1]);
  for (const crear of [() => { throw new Error("boom"); }, () => "no-uuid"]) expect(guardarBorradorConteo(a, token, entrada(8, U2), "1", 300, crear)).toBeNull();
  expect([f.setItem.mock.calls.length, oyente.mock.calls.length, obtenerBorradoresConteo(a)[claveBorrador(8, U2)]]).toEqual([sets, 1, undefined]);
  const editado = guardar(a, token, entrada(7, U1, 999), "13", 400, N2)!;
  expect([editado === creado, editado.cantidadTexto, editado.nonce, editado.expectedConteoId, oyente.mock.calls.length]).toEqual([false, "13", N2, 5, 2]);
});
it("5 actualizaciones consecutivas sobre mapa vigente; snapshot viejo intacto", () => {
  instalar(fake());
  const a = uid("v"), token = obtenerTokenBorradores(a);
  const primero = guardar(a, token, entrada(7, U1), "1", 1, N1)!, snap = obtenerBorradoresConteo(a);
  guardar(a, token, entrada(7, U2), "2", 2, N2); guardar(a, token, entrada(8, U1), "3", 3, N3);
  const actual = obtenerBorradoresConteo(a);
  expect([Object.keys(actual).sort(), actual === snap, snap]).toEqual([[claveBorrador(7, U1), claveBorrador(7, U2), claveBorrador(8, U1)].sort(), false, { [claveBorrador(7, U1)]: primero }]);
});
it("6 descarte: nonce viejo no borra, correcto solo objetivo, último remove", () => {
  const f = instalar(fake()), a = uid("d"), token = obtenerTokenBorradores(a), k7 = claveBorrador(7, U1), k8 = claveBorrador(8, U2);
  guardar(a, token, entrada(7, U1), "1", 1, N1);
  const actual = guardar(a, token, entrada(7, U1), "2", 2, N2)!, otro = guardar(a, token, entrada(8, U2), "3", 3, N3)!, sets = f.setItem.mock.calls.length;
  descartarBorradorConteo(a, token, 7, U1, N1); descartarBorradorConteo(a, token, 7, U1, N3);
  expect([obtenerBorradoresConteo(a)[k7] === actual, f.setItem.mock.calls.length, f.removeItem.mock.calls.length]).toEqual([true, sets, 0]);
  descartarBorradorConteo(a, token, 7, U1, N2);
  expect([obtenerBorradoresConteo(a)[k7], obtenerBorradoresConteo(a)[k8] === otro, Object.keys(JSON.parse(f.datos.get(CLAVE(a))!))]).toEqual([undefined, true, [k8]]);
  descartarBorradorConteo(a, token, 8, U2);
  expect([obtenerBorradoresConteo(a), f.datos.has(CLAVE(a)), f.removeItem.mock.calls.length > 0]).toEqual([{}, false, true]);
});
it("7 limpiar: token incremental, notifica solo con datos, token viejo no resucita", () => {
  const f = instalar(fake()), a = uid("l"), k7 = claveBorrador(7, U1), oyente = vi.fn();
  suscribirBorradoresConteo(a, oyente);
  const t0 = obtenerTokenBorradores(a); limpiarBorradoresConteo(a); const t1 = obtenerTokenBorradores(a);
  expect([t1 > t0, oyente.mock.calls.length, f.removeItem.mock.calls.length > 0]).toEqual([true, 0, true]);
  guardar(a, t1, entrada(), "4", 1, N1); limpiarBorradoresConteo(a); const t2 = obtenerTokenBorradores(a);
  expect([t2 > t1, obtenerBorradoresConteo(a), f.datos.has(CLAVE(a)), oyente.mock.calls.length]).toEqual([true, {}, false, 2]);
  limpiarBorradoresConteo(a); const t3 = obtenerTokenBorradores(a), sets = f.setItem.mock.calls.length, removes = f.removeItem.mock.calls.length;
  expect([t3 > t2, oyente.mock.calls.length]).toEqual([true, 2]);
  expect(guardarBorradorConteo(a, t1, entrada(), "5", 2, () => N2)).toBeNull(); descartarBorradorConteo(a, t2, 7, U1);
  expect([f.setItem.mock.calls.length, f.removeItem.mock.calls.length, oyente.mock.calls.length]).toEqual([sets, removes, 2]);
  guardar(a, t3, entrada(), "6", 3, N3); const setsNuevo = f.setItem.mock.calls.length; descartarBorradorConteo(a, t2, 7, U1);
  expect([obtenerBorradoresConteo(a)[k7].cantidadTexto, f.setItem.mock.calls.length, oyente.mock.calls.length]).toEqual(["6", setsNuevo, 3]);
});
it("8 suscripción aislada, unsubscribe idempotente, no-ops sin notificar", () => {
  instalar(fake());
  const a = uid("sa"), b = uid("sb"), oa = vi.fn(), ob = vi.fn(), token = obtenerTokenBorradores(a), offA = suscribirBorradoresConteo(a, oa);
  suscribirBorradoresConteo(b, ob);
  guardar(a, token, entrada(), "1", 1, N1); guardar(a, token, entrada(), "1", 2, N2);
  expect([oa.mock.calls.length, ob.mock.calls.length]).toEqual([1, 0]);
  offA(); offA(); guardar(a, token, entrada(), "2", 3, N3);
  expect([oa.mock.calls.length, ob.mock.calls.length]).toEqual([1, 0]);
  expect(() => suscribirBorradoresConteo("", oa)()).not.toThrow();
});
it("9 reimport recarga storage, no memoria vieja; fábrica rota no cambia", async () => {
  const f = instalar(fake()), a = uid("re"), token = obtenerTokenBorradores(a), k = claveBorrador(7, U1);
  const viejo = guardar(a, token, entrada(), "1", 1, N1)!, enStorage = { ...viejo, cantidadTexto: "9", nonce: N2, actualizadoEn: 50 };
  f.datos.set(CLAVE(a), JSON.stringify({ [k]: enStorage }));
  vi.resetModules(); const fresh = await import("@/components/inventario/borradoresConteoStore");
  const antes = fresh.obtenerBorradoresConteo(a); expect(antes[k]).toEqual(enStorage);
  expect(fresh.guardarBorradorConteo(a, fresh.obtenerTokenBorradores(a), entrada(8, U2), "1", 60, () => { throw new Error("boom"); })).toBeNull();
  expect(fresh.obtenerBorradoresConteo(a)).toBe(antes);
});
