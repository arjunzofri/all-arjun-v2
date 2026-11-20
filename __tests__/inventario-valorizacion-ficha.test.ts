/** Fase B inv-24c: desplegable de valorización en ficha (solo admin). ROJO antes del código. */
import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { auth } from "@/lib/auth";
import type { ValorizacionCodigo } from "@/lib/inventario/valorizacion";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) };
});
const m = vi.hoisted(() => ({ ficha: vi.fn(), valor: vi.fn(), historial: vi.fn() }));
vi.mock("@/lib/inventario/consultas", () => ({
  getFichaInventario: m.ficha, getValorizacionProducto: m.valor, getHistorialConteos: m.historial,
}));
import ProductoDetallePage from "@/app/(dashboard)/productos/[id]/page";

const fila = {
  id: 77, codigo: "P77", detalle: null, codigoPersonal: null, packing: null, observaciones: null, imagenUrl: null,
  posiciones: [], stockContado: null,
};
const partida = (item: number, comprado: number, saldo: number, costo: number | null, valor: number | null) => ({
  loteId: item, folio: "F1", item, fechaConfirmacion: "2026-06-05", cantidadComprada: comprado,
  cantidadSaldo: saldo, costoUnitario: costo, valor,
});
const valorizacion = (extra: Partial<ValorizacionCodigo> = {}): ValorizacionCodigo => ({
  stock: 15, valorTotal: 50, cantidadValorizada: 10, cantidadSinCosto: 5, incompleto: true,
  costoPromedio: 5, fechaConteoMin: "2026-06-05", fechaConteoMax: "2026-06-25", fechasDistintas: true,
  partidas: [partida(2, 10, 10, 5, 50), partida(1, 10, 5, null, null)], ...extra,
});
const html = async () => renderToStaticMarkup(await ProductoDetallePage({
  params: Promise.resolve({ id: "77" }), searchParams: Promise.resolve({}),
}));
const rol = (role: string) => vi.mocked(auth).mockResolvedValue({ user: { id: "1", role } } as never);

beforeEach(() => {
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
  m.ficha.mockReset().mockResolvedValue(fila);
  m.valor.mockReset().mockResolvedValue(valorizacion());
  m.historial.mockReset();
});

it("1. admin ve el desplegable; operador no y nunca llama la acción", async () => {
  rol("admin");
  expect(await html()).toContain("Costo prom.");
  rol("operador");
  const op = await html();
  expect(op).not.toContain("Costo prom.");
  expect(m.valor).toHaveBeenCalledTimes(1); // solo en la corrida admin
});

it("2. usa «Saldo», nunca «Remanente»", async () => {
  rol("admin");
  const out = await html();
  expect(out).toContain("Saldo");
  expect(out).not.toMatch(/Remanente/i);
});

it("3. «Costo prom.» aparece antes de «Valor» en el summary", async () => {
  rol("admin");
  const out = await html();
  expect(out.indexOf("Costo prom.")).toBeGreaterThan(-1);
  expect(out.indexOf("Costo prom.")).toBeLessThan(out.indexOf("Valor:"));
});

it("4. aviso de unidades sin costo y rango de fechas DD-MM-YYYY", async () => {
  rol("admin");
  const out = await html();
  expect(out).toContain("5 unidades sin costo");
  expect(out).toContain("05-06-2026");
  expect(out).toContain("25-06-2026");
});

it("5. dos líneas del mismo folio con distinto item se muestran separadas", async () => {
  rol("admin");
  const out = await html();
  expect(out).toContain("F1 · 1");
  expect(out).toContain("F1 · 2");
  expect(out.match(/F1 · 2/g)).toHaveLength(1);
});

it("6. sin compras elegibles → mensaje; ficha base sigue renderizando", async () => {
  rol("admin");
  m.valor.mockResolvedValue(valorizacion({ partidas: [], cantidadSinCosto: 15, valorTotal: 0, costoPromedio: null }));
  const out = await html();
  expect(out).toContain("Sin compras elegibles para las fechas de conteo");
  expect(out).toContain("Guardar conteo");
});

it("7. no aparecen los indicadores prohibidos", async () => {
  rol("admin");
  const out = await html();
  for (const txt of ["Unidades en stock", "Códigos con stock", "Unidades sin costo"]) expect(out).not.toContain(txt);
});

it("8. fallo de la acción → mensaje fijo y ficha base intacta", async () => {
  rol("admin");
  m.valor.mockRejectedValue(new Error("postgres://secreto"));
  const out = await html();
  expect(out).toContain("No se pudo cargar la valorización");
  expect(out).toContain("Guardar conteo");
  expect(out).not.toContain("secreto");
});
