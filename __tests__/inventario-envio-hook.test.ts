/** Fase B — inv-17.3a3: puente hook de envío. ROJO esperado: useEnvioConteo no existe (Fase C). */
import { beforeEach, expect, it, vi } from "vitest";
import type { EdicionConteo } from "@/components/inventario/useEdicionConteo";
import type { BorradorConteo } from "@/lib/inventario/borradores-conteo";
import type { FilaInventario } from "@/lib/inventario/consultas";
import type { ConteoDTO, RegistrarConteoInput, RegistrarConteoRespuesta } from "@/lib/inventario/contratos";
import { MENSAJE_ERROR_ENVIO } from "@/lib/inventario/envio-conteo";
import type { UbicacionInventario } from "@/lib/inventario/ubicaciones";
const R = vi.hoisted(() => {
  const est: unknown[] = [], refs: { current: unknown }[] = [], mem: { v: unknown; d: readonly unknown[] }[] = [];
  const eff: { d: readonly unknown[]; setup: () => void | (() => void); clean?: () => void; activo: boolean }[] = []; let c = 0;
  const igual = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  return { est, reset: () => { c = 0; }, limpiar: () => { est.length = refs.length = mem.length = eff.length = 0; c = 0; },
    cleanup: () => { for (const e of eff) if (e?.activo) { e.clean?.(); e.activo = false; } },
    remount: () => { for (const e of eff) if (e && !e.activo) { e.clean = e.setup() ?? undefined; e.activo = true; } },
    useState<T>(init: T | (() => T)) { const i = c++; if (!(i in est)) est[i] = typeof init === "function" ? (init as () => T)() : init;
      return [est[i] as T, (v: T | ((a: T) => T)) => { est[i] = typeof v === "function" ? (v as (a: T) => T)(est[i] as T) : v; }] as const; },
    useRef<T>(init: T) { const i = c++; if (!(i in refs)) refs[i] = { current: init }; return refs[i] as { current: T }; },
    useMemo<T>(fn: () => T, d: readonly unknown[]) { const i = c++; const p = mem[i]; if (p && igual(p.d, d)) return p.v as T; const v = fn(); mem[i] = { v, d }; return v; },
    useEffect(setup: () => void | (() => void), d: readonly unknown[]) { const i = c++; const p = eff[i];
      if (p && igual(p.d, d)) return; if (p?.activo) { p.clean?.(); p.activo = false; }
      const n = { d, setup, activo: true, clean: undefined as undefined | (() => void) }; eff[i] = n; n.clean = setup() ?? undefined; } };
});
const S = vi.hoisted(() => ({ accion: vi.fn(), descartarEn: vi.fn(), router: { refresh: vi.fn() }, edicion: null as unknown, bloqueado: [] as boolean[] }));
vi.mock("react", () => R);
vi.mock("next/navigation", () => ({ useRouter: () => S.router }));
vi.mock("@/lib/inventario/conteos", () => ({ registrarConteo: (i: RegistrarConteoInput) => S.accion(i) }));
vi.mock("@/components/inventario/useEdicionConteo", () => ({
  useEdicionConteo: (_f: FilaInventario, _u: string, b: boolean) => { S.bloqueado.push(b); return S.edicion; },
}));
import { useEnvioConteo } from "@/components/inventario/useEnvioConteo";
const N0 = "11111111-1111-4111-8111-111111111111", N1 = "22222222-2222-4222-8222-222222222222", N2 = "33333333-3333-4333-8333-333333333333";
const U: UbicacionInventario = { bodega: 1, planta: "", pasillo: "A2", posicion: "P" }, CLAVE = "7|1||A2|P";
const FILA: FilaInventario = { id: 7, codigo: "P1", detalle: null, codigoPersonal: null, packing: null, observaciones: null, imagenUrl: null, posiciones: [], stockContado: null };
const C: ConteoDTO = { id: 9, productoId: 7, bodega: 1, planta: "", pasillo: "A2", posicion: "P", cantidad: 12, usuarioId: 1, creadoEn: "2026-11-01T00:00:00.000Z" };
const D = (o: Partial<BorradorConteo> = {}): BorradorConteo => ({ productoId: 7, ubicacion: U, cantidadTexto: "12", expectedConteoId: null, nonce: N0, actualizadoEn: 1, ...o });
const ed = (o: Partial<EdicionConteo> = {}): EdicionConteo => ({ bodegaTrabajo: 1, seleccion: null, ubicacion: U, vigente: null, draft: D(), clave: CLAVE,
  texto: "12", cantidad: 12, diferencia: null, invalido: false, restaurable: null, mensaje: null, elegirBodega: vi.fn(), cambiarCampo: vi.fn(), cambiarTexto: vi.fn(),
  guardarBorrador: vi.fn(() => D()), restaurar: vi.fn(), descartarEn: S.descartarEn, descartarActual: vi.fn(), limpiarEdicion: vi.fn(), avisar: vi.fn(), ...o });
const usePintar = () => { R.reset(); return useEnvioConteo(FILA, "u1"); };
const diferido = () => { let resolver!: (r: RegistrarConteoRespuesta) => void;
  const promesa = new Promise<RegistrarConteoRespuesta>((res) => { resolver = res; }); return { promesa, resolver }; };
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const mock = (f: unknown) => vi.mocked(f as (...a: unknown[]) => unknown);
beforeEach(() => { vi.clearAllMocks(); R.limpiar(); S.router = { refresh: vi.fn() }; S.edicion = ed(); S.accion.mockResolvedValue({ ok: true, conteo: C, repetido: false }); });

it("éxito: payload canónico 5 campos/expected null, un action pese a doble guardar, pending, descarte y aviso", async () => {
  const d = diferido(), env: RegistrarConteoInput[] = [];
  S.accion.mockImplementation((i: RegistrarConteoInput) => { env.push(i); return d.promesa; });
  const e = ed(); S.edicion = e;
  let api = usePintar(); api.guardar(); api.guardar(); api = usePintar(); api.guardar();
  expect(env).toHaveLength(1);
  expect(env[0]).toStrictEqual({ productoId: 7, ubicacion: U, cantidad: 12, expectedConteoId: null, idempotencyKey: N0 });
  expect([api.estado, S.bloqueado.at(-1), mock(e.guardarBorrador).mock.calls.length]).toEqual(["guardando", true, 1]);
  d.resolver({ ok: true, conteo: C, repetido: true }); await flush(); api = usePintar();
  expect([api.estado, api.conflicto, S.descartarEn.mock.calls, mock(e.limpiarEdicion).mock.calls.length]).toEqual(["listo", null, [[7, U, N0]], 1]);
  expect(mock(e.avisar).mock.calls[0][0]).toEqual({ tono: "exito", texto: expect.stringMatching(/Conteo ya registrado:.*12.*B1 · A2 · Principal/) });
  expect(S.router.refresh).toHaveBeenCalledTimes(1);
});
it("rechazo: error fijo, draft intacto y reintento con el nonce original", async () => {
  let n = 0; const nonces: string[] = [];
  S.accion.mockImplementation(async (i: RegistrarConteoInput): Promise<RegistrarConteoRespuesta> => {
    nonces.push(i.idempotencyKey); if (n++ === 0) throw new Error("boom-raw"); return { ok: true, conteo: C, repetido: false };
  });
  const e = ed(); S.edicion = e; let api = usePintar(); api.guardar(); await flush();
  expect(mock(e.avisar)).toHaveBeenLastCalledWith({ tono: "error", texto: MENSAJE_ERROR_ENVIO });
  expect([JSON.stringify(mock(e.avisar).mock.calls).includes("boom-raw"), mock(e.limpiarEdicion).mock.calls.length, S.descartarEn.mock.calls.length, S.router.refresh.mock.calls.length]).toEqual([false, 0, 0, 0]);
  api = usePintar(); api.guardar(); await flush();
  expect([nonces, S.router.refresh.mock.calls.length]).toEqual([[N0, N0], 1]);
  expect(mock(e.avisar).mock.calls.at(-1)![0]).toEqual({ tono: "exito", texto: expect.stringMatching(/^Conteo guardado:.*B1 · A2 · Principal/) });
});
it("conflicto: no descarta ni refresca; panel solo por clave y seguirRevisando sin guardar", async () => {
  S.accion.mockResolvedValue({ ok: false, conflicto: true, vigente: C });
  let api = usePintar(); api.guardar(); await flush(); api = usePintar();
  expect([api.conflicto, Object.keys(api.conflicto!), S.descartarEn.mock.calls.length, S.router.refresh.mock.calls.length])
    .toEqual([{ vigente: { id: 9, cantidad: 12, creadoEn: C.creadoEn }, propuesta: 12 }, ["vigente", "propuesta"], 0, 0]);
  S.edicion = ed({ clave: "7|1||A2|F" }); api = usePintar(); expect(api.conflicto).toBeNull();
  const e = ed(); S.edicion = e; api = usePintar(); expect(api.conflicto).not.toBeNull();
  api.seguirRevisando(); api = usePintar();
  expect([api.conflicto, mock(e.guardarBorrador).mock.calls.length, S.descartarEn.mock.calls.length]).toEqual([null, 0, 0]);
});
it("review: descarta el draft actual N1, guarda intención N2 sin action; fallo y guardas conservan panel", async () => {
  S.accion.mockResolvedValue({ ok: false, conflicto: true, vigente: C });
  let api = usePintar(); api.guardar(); await flush();
  const e = ed({ draft: D({ nonce: N1 }), guardarBorrador: vi.fn(() => D({ nonce: N2 })) }); S.edicion = e;
  api = usePintar(); api.volverAContar();
  expect([S.descartarEn.mock.calls, mock(e.guardarBorrador).mock.calls, S.accion.mock.calls.length]).toEqual([[[7, U, N1]], [[{ expectedConteoId: 9 }]], 1]);
  expect([mock(e.limpiarEdicion).mock.calls.length, S.router.refresh.mock.calls.length, (mock(e.avisar).mock.calls[0][0] as { tono: string }).tono]).toEqual([1, 1, "info"]);
  expect(usePintar().conflicto).toBeNull();
  api = usePintar(); api.guardar(); await flush();
  const falla = ed({ draft: D({ nonce: N1 }), guardarBorrador: vi.fn(() => null) }); S.edicion = falla;
  api = usePintar(); api.volverAContar(); api = usePintar();
  expect([mock(falla.limpiarEdicion).mock.calls.length, S.router.refresh.mock.calls.length, api.conflicto !== null]).toEqual([0, 1, true]);
  S.edicion = ed({ cantidad: null }); api = usePintar(); api.volverAContar(); expect(S.descartarEn).toHaveBeenCalledTimes(2);
  S.edicion = ed({ draft: null }); api = usePintar(); api.volverAContar(); expect(S.descartarEn).toHaveBeenCalledTimes(2);
  S.edicion = ed({ ubicacion: null }); api = usePintar(); api.volverAContar(); expect(S.descartarEn).toHaveBeenCalledTimes(2);
  api.seguirRevisando(); api = usePintar(); api.volverAContar(); expect(S.descartarEn).toHaveBeenCalledTimes(2);
});
it("descartar manual cierra panel; lock y store nulo no envían", async () => {
  S.accion.mockResolvedValue({ ok: false, conflicto: true, vigente: C });
  let api = usePintar(); api.guardar(); await flush();
  const e = ed(); S.edicion = e; api = usePintar(); api.descartar(); api = usePintar();
  expect([mock(e.descartarActual).mock.calls.length, api.conflicto]).toEqual([1, null]);
  const d = diferido(); S.accion.mockImplementation(() => d.promesa);
  const busy = ed(); S.edicion = busy; api = usePintar(); api.guardar(); api.descartar();
  expect(mock(busy.descartarActual)).not.toHaveBeenCalled();
  d.resolver({ ok: true, conteo: C, repetido: false }); await flush();
  const nulo = ed({ guardarBorrador: vi.fn(() => null) }); S.edicion = nulo; api = usePintar();
  const antes = S.accion.mock.calls.length; api.guardar();
  expect([S.accion.mock.calls.length, api.estado]).toEqual([antes, "listo"]);
  S.edicion = ed({ ubicacion: null }); let n = S.accion.mock.calls.length; usePintar().guardar(); expect(S.accion.mock.calls.length).toBe(n);
  S.edicion = ed({ cantidad: null }); n = S.accion.mock.calls.length; usePintar().guardar(); expect(S.accion.mock.calls.length).toBe(n);
});
it("cleanup antes de resolver: descarta el nonce enviado sin tocar React; StrictMode sí aplica", async () => {
  const d = diferido(); S.accion.mockImplementation(() => d.promesa);
  const e = ed(); S.edicion = e; const api = usePintar(); api.guardar(); R.cleanup();
  d.resolver({ ok: true, conteo: C, repetido: false }); await flush();
  expect([S.descartarEn.mock.calls, mock(e.limpiarEdicion).mock.calls.length, mock(e.avisar).mock.calls.length, S.router.refresh.mock.calls.length, R.est[0]]).toEqual([[[7, U, N0]], 0, 0, 0, "guardando"]);
  R.limpiar(); const d2 = diferido(); S.accion.mockImplementation(() => d2.promesa);
  const e2 = ed(); S.edicion = e2; const api2 = usePintar(); R.cleanup(); R.remount(); api2.guardar();
  d2.resolver({ ok: true, conteo: C, repetido: false }); await flush();
  expect([mock(e2.limpiarEdicion).mock.calls.length, S.router.refresh.mock.calls.length]).toEqual([1, 1]);
  expect(mock(e2.avisar)).toHaveBeenCalledWith(expect.objectContaining({ tono: "exito" }));
});
