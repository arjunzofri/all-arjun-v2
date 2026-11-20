// Fase B — inv-24d columnas y total de valorización en ListaInventario. ROJO: props valores/errorValores no existen.
import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ListaInventario from "@/components/inventario/ListaInventario";
import type { FilaInventario } from "@/lib/inventario/consultas";
import type { ValorizacionCodigo } from "@/lib/inventario/valorizacion";
import type { ValorizacionLista } from "@/lib/inventario/consultas";

const fila = (o: Partial<FilaInventario> = {}): FilaInventario => ({ id: 42, codigo: "COD-42", detalle: null, codigoPersonal: null, packing: null, observaciones: null, imagenUrl: "/img/42.png", posiciones: [], stockContado: null, ...o });
const val = (o: Partial<ValorizacionCodigo> = {}): ValorizacionCodigo => ({ stock: 5, valorTotal: 20, cantidadValorizada: 5, cantidadSinCosto: 0, incompleto: false, costoPromedio: 4, fechaConteoMin: "2026-11-16", fechaConteoMax: "2026-11-16", fechasDistintas: false, partidas: [], ...o });
const lista = (o: Partial<ValorizacionLista> = {}): ValorizacionLista => ({ porProducto: [{ productoId: 42, valor: val() }], totales: { valorTotal: 20, unidadesSinCosto: 0, incompleto: false, fechaMin: "2026-11-16", fechaMax: "2026-11-16", fechasDistintas: false, productosConConteo: 1, productosSinContar: 0 }, ...o });
const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(ListaInventario, { items: [fila()], ...props } as never));

it("1: sin props de valores el render no muestra costos", () => {
  const base = html({});
  expect(base).toContain("Stock"); expect(base).not.toContain("Costo prom."); expect(base).not.toContain("Inversión");
  expect(base).not.toMatch(/precio|costo/i);
});

it("2: con valores, encabezados en orden Imagen · Código · Ubicación · Stock · Costo prom. · Valor", () => {
  const h = html({ valores: lista() });
  const pos = ["Imagen", "Código", "Ubicación", "Stock", "Costo prom.", "Valor"].map((s) => h.indexOf(s));
  expect(pos.every((p) => p >= 0)).toBe(true);
  expect([...pos].sort((a, b) => a - b)).toEqual(pos);
});

it("3: producto sin contar → — en ambas columnas; N u. sin costo junto al Valor", () => {
  const sin = html({ valores: lista({ porProducto: [], totales: { ...lista().totales, productosSinContar: 1 } }) });
  expect((sin.match(/—/g) ?? []).length).toBeGreaterThanOrEqual(2);
  const sinCosto = html({ valores: lista({ porProducto: [{ productoId: 42, valor: val({ cantidadSinCosto: 3, incompleto: true }) }] }) });
  expect(sinCosto).toContain("3 u. sin costo");
});

it("4: bloque total con rótulo exacto, rango, aviso de fechas distintas e incompleto; error no oculta la lista", () => {
  const h = html({ valores: lista({ totales: { valorTotal: 20, unidadesSinCosto: 7, incompleto: true, fechaMin: "2026-11-05", fechaMax: "2026-11-16", fechasDistintas: true, productosConConteo: 1, productosSinContar: 0 } }) });
  expect(h).toContain("Inversión según últimos conteos");
  expect(h).toContain("05-11-2026"); expect(h).toContain("16-11-2026");
  expect(h).toContain("Los conteos tienen fechas distintas.");
  expect(h).toContain("Valorización incompleta: 7 unidades sin costo");
  const err = html({ valores: null, errorValores: true });
  expect(err).toContain("No se pudo cargar la valorización. Intente nuevamente."); expect(err).toContain("COD-42");
  expect(err).not.toContain("Inversión según últimos conteos");
});

it("5: tarjeta móvil etiqueta Costo prom. y Valor, sin overflow-x ni anchos fijos", () => {
  const h = html({ valores: lista() });
  const movil = h.slice(h.indexOf("lg:hidden"));
  expect(movil).toContain("Costo prom."); expect(movil).toContain("Valor");
  expect(h).not.toContain("overflow-x"); expect(h).not.toMatch(/w-\[\d/);
});

it("6: nunca Remanente ni los indicadores de totales", () => {
  const h = html({ valores: lista() });
  ["Remanente", "Unidades en stock", "Códigos con stock", "Unidades sin costo"].forEach((s) => expect(h).not.toContain(s));
});
