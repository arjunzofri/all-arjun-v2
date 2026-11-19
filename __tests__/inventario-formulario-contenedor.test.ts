/** Fase B — inv-17.3b: mapeo del contenedor FormularioConteo (hook simulado tipado + Vista real). */
import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EnvioConteo } from "@/components/inventario/useEnvioConteo";
import type { EdicionConteo } from "@/components/inventario/useEdicionConteo";
import type { PropsFormularioVista } from "@/components/inventario/FormularioConteoVista";
import type { FilaInventario } from "@/lib/inventario/consultas";

const S = vi.hoisted(() => ({ llamadas: [] as { fila: unknown; usuarioId: string }[], envio: null as unknown, props: null as unknown }));
vi.mock("@/components/inventario/useEnvioConteo", () => ({
  useEnvioConteo: (fila: unknown, usuarioId: string) => { S.llamadas.push({ fila, usuarioId }); return S.envio as EnvioConteo; },
}));
vi.mock("@/components/inventario/FormularioConteoVista", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/components/inventario/FormularioConteoVista")>();
  return { ...real, FormularioConteoVista: (p: PropsFormularioVista) => { S.props = p; return real.FormularioConteoVista(p); } };
});
import { FormularioConteo } from "@/components/inventario/FormularioConteo";

const FILA: FilaInventario = { id: 7, codigo: "P7", detalle: null, codigoPersonal: null, packing: null, observaciones: null, imagenUrl: null, posiciones: [], stockContado: null };
const U = { bodega: 1 as const, planta: "" as const, pasillo: "A2" as const, posicion: "P" as const };
const ed = (o: Partial<EdicionConteo> = {}): EdicionConteo => ({
  bodegaTrabajo: 1, seleccion: U, ubicacion: U, vigente: null, draft: null, clave: "7|1||A2|P", texto: "12", cantidad: 12, diferencia: null, invalido: false,
  restaurable: null, mensaje: null, elegirBodega: vi.fn(), cambiarCampo: vi.fn(), cambiarTexto: vi.fn(), guardarBorrador: vi.fn(), restaurar: vi.fn(),
  descartarEn: vi.fn(), descartarActual: vi.fn(), limpiarEdicion: vi.fn(), avisar: vi.fn(), ...o,
});
const env = (o: Partial<EnvioConteo> = {}): EnvioConteo => ({
  edicion: ed(), estado: "listo", conflicto: null, guardar: vi.fn(), reintentar: vi.fn(), volverAContar: vi.fn(), seguirRevisando: vi.fn(), descartar: vi.fn(), ...o,
});
const pintar = (e: EnvioConteo) => { S.envio = e; S.props = null; S.llamadas.length = 0; return renderToStaticMarkup(createElement(FormularioConteo, { fila: FILA, usuarioId: "u9" })); };
const props = () => S.props as PropsFormularioVista;

it("llama al hook con la fila y el usuarioId exactos y mapea los datos de edición", () => {
  const borrador = { productoId: 7, ubicacion: U, expectedConteoId: null, cantidadTexto: "15", nonce: "00000000-0000-4000-8000-000000000001", actualizadoEn: 1 };
  pintar(env({ edicion: ed({ draft: borrador, texto: "15", cantidad: 15, diferencia: 3, invalido: true }) }));
  expect(S.llamadas).toEqual([{ fila: FILA, usuarioId: "u9" }]);
  expect(props()).toMatchObject({
    bodega: { trabajo: 1 }, ubicacion: { seleccion: U, vigente: null },
    cantidad: { texto: "15", valor: 15, diferencia: 3, invalido: true },
    borrador: { actual: true, restaurable: null }, envio: { estado: "listo", mensaje: null, conflicto: null },
  });
});

it("conecta cada handler: descartar cierra el panel vía envío, no llama descartarActual", () => {
  const e = env(); pintar(e);
  const p = props();
  expect(p.borrador.onDescartar).toBe(e.descartar);
  expect(p.borrador.onDescartar).not.toBe(e.edicion.descartarActual);
  expect([p.envio.onGuardar, p.envio.onReintentar, p.envio.onVolverAContar, p.envio.onCancelarRevision])
    .toEqual([e.guardar, e.reintentar, e.volverAContar, e.seguirRevisando]);
  expect([p.bodega.onElegir, p.ubicacion.onCambiar, p.cantidad.onCambiar, p.borrador.onRestaurar])
    .toEqual([e.edicion.elegirBodega, e.edicion.cambiarCampo, e.edicion.cambiarTexto, e.edicion.restaurar]);
});

it("propaga estado pendiente y conflicto a los controles reales", () => {
  const html = pintar(env({ estado: "guardando", conflicto: { vigente: { id: 9, cantidad: 9, creadoEn: "2026-11-17T02:30:00Z" }, propuesta: 12 } }));
  expect(props().envio).toMatchObject({ estado: "guardando", conflicto: { propuesta: 12 } });
  expect(html).toContain("Guardando…"); expect(html).toContain('aria-busy="true"'); expect(html).toMatch(/<input[^>]*disabled/);
});
