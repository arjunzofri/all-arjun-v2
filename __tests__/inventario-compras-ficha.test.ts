/** Fase B — inv-25: desplegable Compras lazy en ficha. Hooks de React mockeados; el navegador lo cierra Fase E. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { CompraFicha } from "@/lib/inventario/consultas";
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
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) };
});
const S = vi.hoisted(() => ({ compras: vi.fn() }));
vi.mock("@/lib/inventario/consultas", () => ({ getComprasProducto: (i: unknown) => S.compras(i) }));
import { ComprasFicha } from "@/components/inventario/ComprasFicha";
import { FichaProducto } from "@/app/(dashboard)/productos/[id]/FichaProducto";
type Nodo = { type: unknown; props: Record<string, unknown> };
const nodo = (x: unknown): x is Nodo => !!x && typeof x === "object" && "props" in (x as object);
const hijos = (c: unknown): unknown[] => (Array.isArray(c) ? c : c == null || typeof c === "boolean" ? [] : [c]);
const ver = (n: unknown, f: (x: Nodo) => void): void => { if (!nodo(n)) return; f(n); for (const h of hijos(n.props.children)) ver(h, f); };
const texto = (n: unknown): string => typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(texto).join("") : nodo(n) ? texto(n.props.children) : "";
const todos = (a: unknown) => { const r: Nodo[] = []; ver(a, (x) => r.push(x)); return r; };
const conTexto = (a: unknown, t: string) => todos(a).find((x) => texto(x.props.children) === t);
const pintar = (esAdmin = false) => { R.reset(); return ComprasFicha({ productoId: 7, esAdmin }); };
const abrir = (a: unknown) => (todos(a).find((x) => typeof x.props.onToggle === "function")!.props.onToggle as (e: unknown) => void)({ currentTarget: { open: true } });
const pulsar = (a: unknown, t: string) => (conTexto(a, t)!.props.onClick as () => void)(); const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const abierto = async (esAdmin = false) => { R.limpiar(); abrir(pintar(esAdmin)); await flush(); return pintar(esAdmin); };
const C = (id: number, extra: Partial<CompraFicha> = {}): CompraFicha => ({ id, folio: `NV-${id}`, item: 2,
  bodega: "Bodega 1 Vida Digital", cantidad: 120, fechaConfirmacion: "2026-06-05", ...extra });
const pagina = (items: CompraFicha[], nextCursor: { fechaConfirmacion: string; id: number } | null) => ({ items, nextCursor });
beforeEach(() => { vi.clearAllMocks(); R.limpiar(); S.compras.mockResolvedValue(pagina([], null)); });

it("10. no consulta al pintar; primer toggle usa limit 20 y muestra Cargando", async () => {
  expect(todos(pintar())).not.toHaveLength(0);
  expect(S.compras).not.toHaveBeenCalled();
  abrir(pintar());
  expect(S.compras).toHaveBeenCalledTimes(1);
  expect(S.compras).toHaveBeenCalledWith({ productoId: 7, limit: 20 });
  expect(conTexto(pintar(), "Cargando…")).toBeTruthy();
  await flush();
});
it("11. vacío → «Sin compras importadas» y sin «Ver más»; con nextCursor aparece «Ver más» y usa cursor compuesto", async () => {
  const vacio = await abierto();
  expect(texto(vacio)).toContain("Sin compras importadas");
  expect(conTexto(vacio, "Ver más")).toBeUndefined();
  S.compras.mockResolvedValueOnce(pagina([C(9)], { fechaConfirmacion: "2026-06-05", id: 9 }));
  const b = await abierto();
  expect(conTexto(b, "Ver más")).toBeTruthy();
  S.compras.mockResolvedValueOnce(pagina([C(4)], null));
  pulsar(b, "Ver más");
  expect(S.compras).toHaveBeenLastCalledWith({ productoId: 7, limit: 20, cursor: { fechaConfirmacion: "2026-06-05", id: 9 } });
  await flush();
  expect(todos(pintar()).filter((x) => x.type === "tr")).toHaveLength(3);
});
it("12. error: mensaje fijo sin SQL crudo; Reintentar; la ficha base sigue mostrando «Guardar conteo»", async () => {
  S.compras.mockRejectedValueOnce(new Error("postgres://secreto"));
  const b = await abierto();
  expect(texto(b)).toContain("No se pudo cargar el historial de compras. Intente nuevamente.");
  expect(texto(b)).not.toMatch(/postgres|secreto/);
  S.compras.mockResolvedValueOnce(pagina([C(8)], null));
  pulsar(b, "Reintentar");
  expect(S.compras).toHaveBeenLastCalledWith({ productoId: 7, limit: 20 });
  await flush();
  const fila = { id: 7, codigo: "P7", detalle: null, codigoPersonal: null, packing: null, observaciones: null, imagenUrl: null, posiciones: [], stockContado: null };
  expect(renderToStaticMarkup(createElement(FichaProducto, { fila: fila as never, usuarioId: "1" }))).toContain("Guardar conteo");
});
it("13. móvil sin scroll lateral: celdas con data-label y sin overflow-x-auto; fechas/números formateados", async () => {
  S.compras.mockResolvedValueOnce(pagina([C(12, { cantidad: 148163, precioUnitario: 4.35 })], null));
  const b = await abierto(true);
  expect(todos(b).some((x) => String(x.props.className ?? "").includes("overflow-x-auto"))).toBe(false);
  const celdas = todos(b).filter((x) => typeof x.props["data-label"] === "string");
  expect(celdas.map((x) => x.props["data-label"])).toEqual(["Fecha", "Nota", "Bodega", "Cantidad", "Costo unit."]);
  const t = texto(b);
  for (const txt of ["05-06-2026", "NV-12 · 2", "148.163", "USD 4,35", "Compras"]) expect(t).toContain(txt);
});
it("15. solo admin ve «Costo unit.»; operador no; null → «Sin costo», 0 → «USD 0,00»", async () => {
  S.compras.mockResolvedValueOnce(pagina([C(1, { precioUnitario: null })], null));
  const op = texto(await abierto());
  expect(op).not.toMatch(/Costo unit|Sin costo|USD/);
  S.compras.mockResolvedValueOnce(pagina([C(2, { precioUnitario: 0 }), C(1, { precioUnitario: null })], null));
  const ad = texto(await abierto(true));
  expect(ad).toContain("Costo unit.");
  expect(ad).toContain("Sin costo");
  expect(ad).toContain("USD 0,00");
});
it("14. modo OFF no monta ComprasFicha: solo FichaProducto (rama ON) lo referencia", () => {
  const fuente = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
  expect(fuente("app/(dashboard)/productos/[id]/page.tsx")).not.toContain("ComprasFicha");
  expect(fuente("app/(dashboard)/productos/[id]/FichaProducto.tsx")).toContain("<ComprasFicha");
});
