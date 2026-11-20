import { beforeEach, expect, it, vi } from "vitest";
import type { FilaInventario, PosicionContada } from "@/lib/inventario/consultas";
import { obtenerBorrador, type BorradorConteo, type EntradaBorrador } from "@/lib/inventario/borradores-conteo";
import {
  descartarBorradorConteo, guardarBorradorConteo, limpiarBorradoresConteo,
  obtenerBorradoresConteo, obtenerTokenBorradores,
} from "@/components/inventario/borradoresConteoStore";
import type { UbicacionInventario } from "@/lib/inventario/ubicaciones";
import type { SugerenciaBodega } from "@/lib/inventario/sugerencia-bodega";
const R = vi.hoisted(() => {
  const estados: unknown[] = []; let cursor = 0;
  return { estados,
    useState<T>(init: T | (() => T)): [T, (v: T | ((a: T) => T)) => void] {
      const i = cursor++;
      if (!(i in estados)) estados[i] = typeof init === "function" ? (init as () => T)() : init;
      return [estados[i] as T, (v) => { estados[i] = typeof v === "function" ? (v as (a: T) => T)(estados[i] as T) : v; }];
    },
    reset: () => { cursor = 0; }, limpiar: () => { estados.length = 0; cursor = 0; } };
});
const S = vi.hoisted(() => ({ bodega: null as 1 | 2 | null, fijar: vi.fn(), guardar: vi.fn(), descartar: vi.fn(), borrador: vi.fn(), ultimo: vi.fn() }));
vi.mock("react", () => ({ useState: R.useState }));
vi.mock("@/components/inventario/useBodegaTrabajo", () => ({ useBodegaTrabajo: () => ({ bodegaTrabajo: S.bodega, fijarBodegaTrabajo: S.fijar, limpiarBodegaTrabajo: vi.fn() }) }));
vi.mock("@/components/inventario/useBorradoresConteo", () => ({ useBorradoresConteo: () => ({ borrador: S.borrador, ultimoCompatible: S.ultimo, guardar: S.guardar, descartar: S.descartar }) }));
import { MENSAJE_BORRADOR, useEdicionConteo } from "@/components/inventario/useEdicionConteo";
const N = "11111111-1111-4111-8111-111111111111";
const U1: UbicacionInventario = { bodega: 1, planta: "", pasillo: "A2", posicion: "P" };
const U2: UbicacionInventario = { bodega: 2, planta: "ARRIBA", pasillo: "IZQUIERDA", posicion: "M" };
const FILA = (posiciones: PosicionContada[] = [], sugerenciaBodega: SugerenciaBodega | null = null): FilaInventario => ({ id: 7, codigo: "P1", detalle: null, codigoPersonal: null, packing: null, observaciones: null, imagenUrl: null, posiciones, stockContado: null, sugerenciaBodega });
const SUG1: SugerenciaBodega = { bodega: 1, bodegaId: 7, codigoIngreso: "GLP", administrativa: false };
const pos = (o: Partial<PosicionContada> = {}): PosicionContada => ({ id: 9, ...U1, cantidad: 5, usuarioId: 1, usuario: "qa", creadoEn: "2026-11-01T00:00:00.000Z", ...o });
const draft = (o: Partial<BorradorConteo> = {}): BorradorConteo => ({ productoId: 7, ubicacion: U1, cantidadTexto: "12", expectedConteoId: 5, nonce: N, actualizadoEn: 1, ...o });
type M = ReturnType<typeof useEdicionConteo>;
const usePintar = (fila = FILA(), bloqueado = false): M => { R.reset(); return useEdicionConteo(fila, "u1", bloqueado); };
const useEnB1 = (fila = FILA()): M => {
  let m = usePintar(fila); m.elegirBodega(1); m = usePintar(fila);
  m.cambiarCampo("pasillo", "A2"); m = usePintar(fila); m.cambiarCampo("posicion", "P"); return usePintar(fila);
};
beforeEach(() => {
  vi.clearAllMocks(); R.limpiar(); S.bodega = null;
  S.fijar.mockImplementation((b: 1 | 2 | null) => { S.bodega = b; });
  S.borrador.mockReturnValue(null); S.ultimo.mockReturnValue(null);
});
const ENT = { productoId: 7, ubicacion: U1 };
it("sin bodega no guarda; 0 válido; campos parciales sin defaults; texto no stale", () => {
  let m = usePintar();
  expect([m.seleccion, m.ubicacion, m.texto, m.cantidad, m.invalido]).toEqual([null, null, "", null, false]);
  m.cambiarTexto("5"); m.cambiarCampo("pasillo", "A1"); expect(S.guardar).not.toHaveBeenCalled();
  S.bodega = 1; m = usePintar(); m.cambiarCampo("pasillo", "A1"); m = usePintar();
  expect(m.seleccion).toEqual({ bodega: 1, planta: "", pasillo: "A1", posicion: "" }); expect(m.ubicacion).toBeNull();
  m = useEnB1(); m.cambiarTexto("1"); m = usePintar(); m.cambiarTexto("2"); m = usePintar(); m.cambiarTexto("0"); m = usePintar();
  expect(S.guardar.mock.calls.slice(-3).map((c) => c[1])).toEqual(["1", "2", "0"]);
  expect([m.cantidad, m.invalido, S.guardar.mock.calls.at(-1)![0]]).toEqual([0, false, { ...ENT, expectedConteoId: null }]);
});
it("B1/B2: ubicación explícita, sin planta en B1 ni defaults", () => {
  S.bodega = 1; let m = usePintar(); m.cambiarCampo("pasillo", "A1"); m = usePintar(); expect(m.ubicacion).toBeNull();
  m.cambiarCampo("posicion", "F"); m = usePintar();
  expect(m.ubicacion).toEqual({ bodega: 1, planta: "", pasillo: "A1", posicion: "F" });
  S.bodega = 2; R.limpiar(); m = usePintar(); m.cambiarCampo("planta", "ARRIBA"); m = usePintar(); expect(m.ubicacion).toBeNull();
  m.cambiarCampo("pasillo", "IZQUIERDA"); m = usePintar(); m.cambiarCampo("posicion", "M"); m = usePintar(); expect(m.ubicacion).toEqual(U2);
});
it("B1→B2 sin editar recupera B1; editando B2 no", () => {
  let m = useEnB1();
  m.elegirBodega(2); m = usePintar(); expect(m.seleccion).toBeNull();
  m.elegirBodega(1); m = usePintar(); expect(m.ubicacion).toEqual(U1);
  m.elegirBodega(2); m = usePintar(); m.cambiarCampo("planta", "ARRIBA"); m = usePintar();
  m.elegirBodega(1); m = usePintar(); expect(m.seleccion).toBeNull();
});
it("restaurar fija ubicación, texto y aviso info", () => {
  S.bodega = 1; S.ultimo.mockReturnValue(draft()); S.borrador.mockReturnValue(draft());
  let m = usePintar(); expect(m.restaurable).toEqual(draft());
  m.restaurar(); m = usePintar();
  expect([m.ubicacion, m.texto, m.mensaje]).toEqual([U1, "12", { tono: "info", texto: "Borrador restaurado." }]);
});
it("expected: draft null no se sustituye por el 9; sin draft usa el vigente 9", () => {
  S.bodega = 1; S.borrador.mockReturnValue(draft({ expectedConteoId: null }));
  const m = useEnB1(FILA([pos()])); expect(m.vigente?.id).toBe(9); m.cambiarTexto("4");
  expect(S.guardar).toHaveBeenLastCalledWith({ ...ENT, expectedConteoId: null }, "4");
  R.limpiar(); S.borrador.mockReturnValue(null); const sin = useEnB1(FILA([pos()])); sin.cambiarTexto("4");
  expect(S.guardar).toHaveBeenLastCalledWith({ ...ENT, expectedConteoId: 9 }, "4");
});
it("falla del store conserva texto local y error fijo", () => {
  S.bodega = 1; S.borrador.mockReturnValue(draft()); S.ultimo.mockReturnValue(draft()); S.guardar.mockReturnValue(null);
  let m = usePintar(); m.restaurar(); m = usePintar(); expect(m.texto).toBe("12");
  expect(m.guardarBorrador()).toBeNull();
  S.borrador.mockReturnValue(null); m = usePintar();
  expect([m.texto, m.mensaje]).toEqual(["12", { tono: "error", texto: MENSAJE_BORRADOR }]);
  m.cambiarTexto("7"); m = usePintar(); expect([m.texto, m.mensaje?.tono]).toEqual(["7", "error"]);
});
it("guardarBorrador re-guarda canónico y respeta opts expected null", () => {
  S.bodega = 1; S.borrador.mockReturnValue(draft({ cantidadTexto: "5" }));
  const canonico = draft({ cantidadTexto: "99" }); S.guardar.mockReturnValue(canonico);
  let m = useEnB1(); m.cambiarTexto("99"); m = usePintar();
  expect(m.guardarBorrador()).toBe(canonico);
  expect(S.guardar).toHaveBeenLastCalledWith({ ...ENT, expectedConteoId: 5 }, "99");
  expect(m.guardarBorrador({ expectedConteoId: null })).toBe(canonico);
  expect(S.guardar).toHaveBeenLastCalledWith({ ...ENT, expectedConteoId: null }, "99");
});
it("descartarActual usa el nonce y limpia edición; descartarEn no se bloquea", () => {
  S.bodega = 1; S.borrador.mockReturnValue(draft()); S.guardar.mockReturnValue(draft());
  let m = useEnB1(); m.cambiarTexto("8"); m = usePintar();
  S.borrador.mockReturnValue(null); m.descartarActual(); m = usePintar();
  expect(S.descartar.mock.calls).toEqual([[7, U1, N]]); expect(m.texto).toBe("");
  const enlace = usePintar(FILA(), true).descartarEn; m.descartarEn(7, U1, N);
  expect(S.descartar).toHaveBeenLastCalledWith(7, U1, N); expect(usePintar(FILA(), true).descartarEn).toBe(enlace);
});
it("bloqueado: mutadores no-op; bodega y descartarEn operativos", () => {
  S.bodega = 1; S.borrador.mockReturnValue(draft()); S.guardar.mockReturnValue(draft());
  let m = useEnB1(); m.cambiarTexto("3"); m = usePintar(); m = usePintar(FILA(), true);
  const antes = S.guardar.mock.calls.length;
  m.cambiarTexto("4"); m.cambiarCampo("pasillo", "A3"); m.descartarActual();
  expect([S.guardar.mock.calls.length, S.descartar.mock.calls.length, m.texto]).toEqual([antes, 0, "3"]);
  m.elegirBodega(2); expect(S.fijar).toHaveBeenLastCalledWith(2);
  m.descartarEn(7, U1, N); expect(S.descartar).toHaveBeenLastCalledWith(7, U1, N);
});
it("sin sesión, sugerencia B1: ubicar funciona, no fija sesión y elegir vacío no rompe", () => {
  let m = usePintar(FILA([], SUG1));
  m.cambiarCampo("pasillo", "A2"); m = usePintar(FILA([], SUG1)); m.cambiarCampo("posicion", "P"); m = usePintar(FILA([], SUG1));
  expect(m.ubicacion).toEqual(U1);
  m.cambiarTexto("3"); m.guardarBorrador();
  expect(S.fijar).not.toHaveBeenCalled();
  expect(() => m.elegirBodega(null)).not.toThrow();
  m = usePintar(FILA([], SUG1)); m.cambiarCampo("posicion", "P"); m = usePintar(FILA([], SUG1));
  expect(m.seleccion).toMatchObject({ bodega: 1 });
});
it("sesión B2 ignora la sugerencia B1", () => {
  S.bodega = 2;
  let m = usePintar(FILA([], SUG1));
  m.cambiarCampo("planta", "ARRIBA"); m = usePintar(FILA([], SUG1));
  m.cambiarCampo("pasillo", "IZQUIERDA"); m = usePintar(FILA([], SUG1));
  m.cambiarCampo("posicion", "M"); m = usePintar(FILA([], SUG1));
  expect(m.ubicacion).toEqual(U2);
  expect(S.fijar).not.toHaveBeenCalled();
});
it("restaurable consulta la bodega sugerida cuando no hay sesión", () => {
  S.ultimo.mockReturnValue(draft());
  const m = usePintar(FILA([], SUG1));
  expect(S.ultimo).toHaveBeenCalledWith(7, 1);
  expect(m.restaurable).toEqual(draft());
});
it("backbone store real: expected null sobrevive a guardar con draft vivo; solo el descarte explícito habilita expected 9", () => {
  const uid = "u-inv-17-3a1-audit-fix";
  let n = 0;
  const UUID = () => `00000000-0000-4000-8000-${String(n++).padStart(12, "0")}`;
  const token = () => obtenerTokenBorradores(uid);
  S.guardar.mockImplementation((e: EntradaBorrador, texto: string) =>
    guardarBorradorConteo(uid, token(), e, texto, 1000 + n, UUID));
  S.descartar.mockImplementation((p: number, u: UbicacionInventario, nonce: string) =>
    descartarBorradorConteo(uid, token(), p, u, nonce));
  S.borrador.mockImplementation((p: number, u: UbicacionInventario) =>
    obtenerBorrador(obtenerBorradoresConteo(uid), p, u));
  try {
    let m = useEnB1(); expect(m.draft).toBeNull();
    m.cambiarTexto("60"); m = usePintar();
    m.cambiarTexto("70"); m = usePintar();
    expect([m.draft?.cantidadTexto, m.draft?.expectedConteoId]).toEqual(["70", null]);
    const n1 = m.draft!.nonce;

    m = usePintar(FILA([pos({ id: 9 })])); expect(m.vigente?.id).toBe(9);
    m.guardarBorrador({ expectedConteoId: 9 });
    expect(obtenerBorrador(obtenerBorradoresConteo(uid), 7, U1)?.expectedConteoId).toBeNull();

    m = usePintar(FILA([pos({ id: 9 })])); m.descartarEn(7, U1, n1);
    m = usePintar(FILA([pos({ id: 9 })])); expect(m.draft).toBeNull();
    const nuevo = m.guardarBorrador({ expectedConteoId: 9 });
    expect(nuevo).toMatchObject({ expectedConteoId: 9, cantidadTexto: "70" });
    expect(nuevo!.nonce).not.toBe(n1);
    expect(obtenerBorrador(obtenerBorradoresConteo(uid), 7, U1))
      .toMatchObject({ expectedConteoId: 9, cantidadTexto: "70", nonce: nuevo!.nonce });
  } finally {
    S.guardar.mockReset(); S.descartar.mockReset();
    limpiarBorradoresConteo(uid);
  }
});
