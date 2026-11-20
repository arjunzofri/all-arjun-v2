/** Fase B — inv-18.2: historial de conteos lazy. Hooks de React mockeados (sin DOM); la interacción real la cierra Fase E. */
import { beforeEach, expect, it, vi } from "vitest";
import type { PosicionContada } from "@/lib/inventario/consultas";
const R = vi.hoisted(() => {
  const est: unknown[] = [], refs: { current: unknown }[] = [], eff: { d: readonly unknown[]; setup: () => void | (() => void); clean?: () => void; activo: boolean }[] = []; let c = 0;
  const igual = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  return { est, reset: () => { c = 0; }, limpiar: () => { est.length = refs.length = eff.length = 0; c = 0; },
    cleanup: () => { for (const e of eff) if (e?.activo) { e.clean?.(); e.activo = false; } },
    useState<T>(init: T | (() => T)) { const i = c++; if (!(i in est)) est[i] = typeof init === "function" ? (init as () => T)() : init;
      return [est[i] as T, (v: T | ((a: T) => T)) => { est[i] = typeof v === "function" ? (v as (a: T) => T)(est[i] as T) : v; }] as const; },
    useRef<T>(init: T) { const i = c++; if (!(i in refs)) refs[i] = { current: init }; return refs[i] as { current: T }; },
    useEffect(setup: () => void | (() => void), d: readonly unknown[]) { const i = c++; const p = eff[i];
      if (p && igual(p.d, d)) return; if (p?.activo) { p.clean?.(); p.activo = false; }
      const n = { d, setup, activo: true, clean: undefined as undefined | (() => void) }; eff[i] = n; n.clean = setup() ?? undefined; } };
});
vi.mock("react", async (importOriginal) => ({ ...await importOriginal<typeof import("react")>(), useState: R.useState, useRef: R.useRef, useEffect: R.useEffect }));
const S = vi.hoisted(() => ({ historial: vi.fn() }));
vi.mock("@/lib/inventario/consultas", () => ({ getHistorialConteos: (i: unknown) => S.historial(i) }));
import { HistorialConteos } from "@/components/inventario/HistorialConteos";
import { claveHistorial } from "@/lib/inventario/historial-conteo";
type Nodo = { type: unknown; props: Record<string, unknown> };
const nodo = (x: unknown): x is Nodo => !!x && typeof x === "object" && "props" in (x as object);
const hijos = (c: unknown): unknown[] => (Array.isArray(c) ? c : c == null || typeof c === "boolean" ? [] : [c]);
const ver = (n: unknown, f: (x: Nodo) => void): void => { if (!nodo(n)) return; f(n); for (const h of hijos(n.props.children)) ver(h, f); };
const texto = (n: unknown): string => typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(texto).join("") : nodo(n) ? texto(n.props.children) : "";
const todos = (a: unknown) => { const r: Nodo[] = []; ver(a, (x) => r.push(x)); return r; };
const conTexto = (a: unknown, t: string) => todos(a).find((x) => texto(x.props.children) === t);
const conHandler = (a: unknown, k: string) => todos(a).find((x) => typeof x.props[k] === "function")!;
const pintar = (productoId = 7) => { R.reset(); return HistorialConteos({ productoId }); };
const abrir = (a: unknown) => (conHandler(a, "onToggle").props.onToggle as (e: unknown) => void)({ currentTarget: { open: true } });
const pulsar = (a: unknown, t: string) => (conTexto(a, t)!.props.onClick as () => void)();
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const diferido = () => { let resolver!: (r: unknown) => void; const promesa = new Promise((res) => { resolver = res; }); return { promesa, resolver }; };
const P = (id: number, cantidad: number, usuario = "qa-dos", creadoEn = "2026-11-17T02:30:00Z"): PosicionContada => ({ id, bodega: 1, planta: "", pasillo: "A1", posicion: "F", cantidad, usuarioId: 3, usuario, creadoEn });
const pagina = (items: PosicionContada[], nextCursor: number | null) => ({ items, nextCursor });
beforeEach(() => { vi.clearAllMocks(); R.limpiar(); S.historial.mockResolvedValue(pagina([], null)); });

it("no consulta al pintar; abre con limit 10 y muestra miles, 0, ubicación, fecha+hora y autor", async () => {
  expect(todos(pintar())).not.toHaveLength(0); expect(S.historial).not.toHaveBeenCalled();
  S.historial.mockResolvedValue(pagina([P(12, 148163), P(11, 0, "qa-admin")], null));
  abrir(pintar());
  expect(S.historial).toHaveBeenCalledTimes(1);
  expect(S.historial).toHaveBeenCalledWith({ productoId: 7, limit: 10 });
  expect(conTexto(pintar(), "Cargando…")).toBeTruthy();
  await flush();
  const b = pintar(), t = texto(b);
  for (const txt of ["148.163", "0 u.", "B1 · A1 · Fondo", "16-11-2026 23:30", "qa-dos", "qa-admin", "Historial de conteos"]) expect(t).toContain(txt);
  expect(conTexto(b, "Ver más")).toBeUndefined();
  expect(t).not.toMatch(/USD|precio|Detalle/i);
  expect(todos(b).some((x) => x.type === "table")).toBe(false);
});
it("pending: doble apertura produce una sola consulta y una sola tanda de filas", async () => {
  const d = diferido(); S.historial.mockImplementation(() => d.promesa);
  const a = pintar(); abrir(a); abrir(a);
  expect(S.historial).toHaveBeenCalledTimes(1);
  d.resolver(pagina([P(5, 3)], null)); await flush();
  expect(todos(pintar()).filter((x) => x.type === "li")).toHaveLength(1);
});
it("Ver más usa el cursor exacto y agrega sin perder la página previa", async () => {
  S.historial.mockResolvedValueOnce(pagina([P(9, 81)], 9));
  abrir(pintar()); await flush();
  const b = pintar(); expect(conTexto(b, "Ver más")).toBeTruthy();
  S.historial.mockResolvedValueOnce(pagina([P(4, 5, "qa-admin")], null));
  pulsar(b, "Ver más");
  expect(S.historial).toHaveBeenLastCalledWith({ productoId: 7, limit: 10, cursor: 9 });
  await flush();
  const c = pintar();
  expect(todos(c).filter((x) => x.type === "li")).toHaveLength(2);
  expect(conTexto(c, "Ver más")).toBeUndefined();
});
it("error: mensaje fijo sin SQL crudo; Reintentar repite cursor y al éxito limpia el error", async () => {
  S.historial.mockRejectedValueOnce(new Error("postgres://u:p@host/db"));
  abrir(pintar()); await flush();
  const b = pintar();
  expect(texto(b)).toContain("No se pudo obtener el historial. Intente nuevamente.");
  expect(texto(b)).not.toMatch(/postgres|u:p|@host/);
  S.historial.mockResolvedValueOnce(pagina([P(8, 80)], null));
  pulsar(b, "Reintentar");
  expect(S.historial).toHaveBeenLastCalledWith({ productoId: 7, limit: 10 });
  await flush();
  const c = pintar();
  expect(texto(c)).not.toContain("No se pudo obtener el historial");
  expect(todos(c).filter((x) => x.type === "li")).toHaveLength(1);
});
it("error en página 2: Reintentar usa el cursor pendiente, no el siguiente", async () => {
  S.historial.mockResolvedValueOnce(pagina([P(9, 81)], 9)).mockRejectedValueOnce(new Error("boom"));
  abrir(pintar()); await flush();
  pulsar(pintar(), "Ver más"); await flush();
  const c = pintar(); expect(conTexto(c, "Reintentar")).toBeTruthy();
  S.historial.mockResolvedValueOnce(pagina([P(4, 5)], null));
  pulsar(c, "Reintentar");
  expect(S.historial).toHaveBeenLastCalledWith({ productoId: 7, limit: 10, cursor: 9 });
});
it("unmount antes de resolver: sin setState; otro producto no hereda datos", async () => {
  const d = diferido(); S.historial.mockImplementation(() => d.promesa);
  abrir(pintar()); R.cleanup();
  d.resolver(pagina([P(1, 10)], null)); await flush();
  expect(R.est[0]).toBeNull();
  R.limpiar();
  expect(todos(pintar(8)).filter((x) => x.type === "li")).toHaveLength(0);
});
it("clave vectorial: mismo max distinto conjunto, orden indiferente, usuario/producto y sin mutar", () => {
  const a = [{ id: 11 }, { id: 10 }], b = [{ id: 10 }];
  expect(claveHistorial("u1", 7, a)).not.toBe(claveHistorial("u1", 7, b));
  expect(claveHistorial("u1", 7, a)).toBe(claveHistorial("u1", 7, [{ id: 10 }, { id: 11 }]));
  expect(claveHistorial("u2", 7, b)).not.toBe(claveHistorial("u1", 7, b));
  expect(claveHistorial("u1", 8, b)).not.toBe(claveHistorial("u1", 7, b));
  expect([claveHistorial("u1", 7, a).startsWith("u1:7:"), a]).toEqual([true, [{ id: 11 }, { id: 10 }]]);
});
