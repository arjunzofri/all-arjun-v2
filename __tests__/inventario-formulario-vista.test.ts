// Fase B — inv-17.2 vista SSR. ROJO: FormularioConteoVista aun no existe. No cubre tecleo/foco/navegador (Fase E).
import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormularioConteoVista, type PropsFormularioVista } from "@/components/inventario/FormularioConteoVista";

const props = (o: Partial<PropsFormularioVista> = {}): PropsFormularioVista => ({
  bodega: { trabajo: 1, onElegir: vi.fn() }, ubicacion: { seleccion: null, vigente: null, onCambiar: vi.fn() },
  cantidad: { texto: "", valor: null, diferencia: null, invalido: false, onCambiar: vi.fn() },
  borrador: { actual: false, restaurable: null, onRestaurar: vi.fn(), onDescartar: vi.fn() },
  envio: { estado: "listo", mensaje: null, conflicto: null, onGuardar: vi.fn(), onReintentar: vi.fn(), onVolverAContar: vi.fn(), onCancelarRevision: vi.fn() },
  ...o,
});
const html = (o: Partial<PropsFormularioVista> = {}) => renderToStaticMarkup(createElement(FormularioConteoVista, props(o)));
const ubic = (pasillo: string) => ({ bodega: 1 as const, planta: "", pasillo, posicion: "F" });
const pos = (cantidad: number) => ({ id: 9, bodega: 1, planta: "", pasillo: "A1", posicion: "F", cantidad, usuarioId: 1, usuario: "qa-uno", creadoEn: "2026-11-17T02:30:00Z" });
const sel = (o: Partial<PropsFormularioVista["ubicacion"]> = {}): PropsFormularioVista["ubicacion"] => ({ ...props().ubicacion, seleccion: ubic("A1"), ...o });

it("sin bodega: selector explicito, controles apagados y Guardar deshabilitado sin defaults", () => {
  const h = html({ bodega: { trabajo: null, onElegir: vi.fn() } });
  ["Bodega de trabajo", "Elegir bodega", "Bodega 1", "Bodega 2"].forEach((s) => expect(h).toContain(s)); expect((h.match(/<select[^>]*disabled/g) ?? []).length).toBeGreaterThanOrEqual(2);
  expect(h).toMatch(/<input[^>]*disabled/); expect(h).toMatch(/<button[^>]*disabled[^>]*>Guardar conteo/); for (const t of h.match(/<option[^>]*selected[^>]*>/g) ?? []) expect(t).toMatch(/value=""/);
});
it("B1 sin planta y solo A1-A4/F-M-P; B2 Arriba/Abajo+Izquierda/Derecha sin A1; labels for/id", () => {
  const b1 = html(); ["A1", "A2", "A3", "A4", "Fondo", "Medio", "Principal"].forEach((s) => expect(b1).toContain(s)); expect(b1).not.toContain("Planta"); expect(b1).not.toContain("Arriba"); expect(b1).not.toContain("Izquierda");
  for (const t of ["Pasillo", "Posición"]) { const id = b1.match(new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${t}</label>`))?.[1]; expect(id, t).toBeTruthy(); expect(b1).toContain(`id="${id}"`); }
  const b2 = html({ bodega: { trabajo: 2, onElegir: vi.fn() } }); ["Planta", "Arriba", "Abajo", "Izquierda", "Derecha"].forEach((s) => expect(b2).toContain(s)); expect(b2).not.toContain("A1");
});
it("comparacion: ausencia no es 0; previo 10 con 7 da -3; cero real visible", () => {
  const vacio = html({ ubicacion: sel() }); expect(vacio).toContain("Sin conteo previo"); expect(vacio).toMatch(/Diferencia[\s\S]*—/);
  const previo = html({ ubicacion: sel({ vigente: pos(10) }), cantidad: { texto: "7", valor: 7, diferencia: -3, invalido: false, onCambiar: vi.fn() } });
  expect(previo).toMatch(/Conteo anterior[\s\S]{0,80}10/); expect(previo).toContain("qa-uno"); expect(previo).toContain("16-11-2026"); expect(previo).toContain("23:30"); expect(previo).toMatch(/[−-]3/); expect(previo).not.toContain("Sin conteo previo");
  const cero = html({ ubicacion: sel({ vigente: pos(0) }), cantidad: { texto: "0", valor: 0, diferencia: 0, invalido: false, onCambiar: vi.fn() } }); expect(cero).toMatch(/Conteo anterior[\s\S]{0,80}0/); expect(cero).not.toContain("Sin conteo previo");
  const positivo = html({ ubicacion: sel({ vigente: pos(0) }), cantidad: { texto: "7", valor: 7, diferencia: 7, invalido: false, onCambiar: vi.fn() } }); expect(positivo).toMatch(/Diferencia[\s\S]{0,80}\+7/);
});
it("cantidad: vacia sin error pero apaga Guardar; invalida error simple, aria, input y movil", () => {
  const vacia = html({ ubicacion: sel() }); expect(vacia).not.toContain("Cantidad inválida"); expect(vacia).toMatch(/<button[^>]*disabled[^>]*>Guardar conteo/);
  const h = html({ ubicacion: sel(), cantidad: { texto: "1.5", valor: null, diferencia: null, invalido: true, onCambiar: vi.fn() } });
  expect(h).toContain("Cantidad inválida: ingresa un número entero."); expect(h).not.toContain("2147483647"); expect(h).toMatch(/aria-invalid="true"/); expect(h).toMatch(/<button[^>]*disabled[^>]*>Guardar conteo/);
  const ids = h.match(/aria-describedby="([^"]+)"/)?.[1]?.split(" ") ?? []; expect(ids.length).toBeGreaterThan(0); ids.forEach((id) => expect(h).toContain(`id="${id}"`));
  expect(h).toMatch(/<input[^>]*type="text"/); expect(h).toMatch(/<input[^>]*inputmode="numeric"/i); expect(h).toMatch(/<input[^>]*maxlength="32"/i); expect(h).toMatch(/<input[^>]*pattern="\[0-9\]\*"/);
  expect(h).toMatch(/<form[^>]*novalidate/i);
  const sinUbic = html(); expect(sinUbic).toMatch(/<input[^>]*disabled/);
  expect(h).toContain("Cantidad total contada en esta posición; 0 es un conteo válido."); expect(h).not.toContain("<table"); expect(h).not.toMatch(/w-\[\d+px\]|style="width/);
});
it("borrador: aviso, restaurar por etiqueta y descartar solo con draft activo", () => {
  const b: PropsFormularioVista["borrador"]["restaurable"] = { productoId: 1, ubicacion: { bodega: 2, planta: "ARRIBA", pasillo: "IZQUIERDA", posicion: "M" }, expectedConteoId: null, cantidadTexto: "15", nonce: "00000000-0000-4000-8000-000000000001", actualizadoEn: 1 };
  const con = html({ bodega: { trabajo: 2, onElegir: vi.fn() }, borrador: { actual: true, restaurable: b, onRestaurar: vi.fn(), onDescartar: vi.fn() } });
  expect(con).toContain("Borrador sin guardar"); expect(con).toContain("Restaurar borrador de B2 · Arriba · Izquierda · Medio"); expect(con).toContain("Descartar borrador");
  const sin = html(); expect(sin).not.toContain("Borrador sin guardar"); expect(sin).not.toContain("Restaurar borrador"); expect(sin).not.toContain("Descartar borrador");
});
it("pendiente: texto, aria-busy y controles/submit apagados; error alert+Reintentar; exito status", () => {
  const base = props(); const h = html({ envio: { ...base.envio, estado: "guardando" } });
  expect(h).toContain("Guardando…"); expect(h).toContain('aria-busy="true"'); expect(h).toMatch(/<button[^>]*disabled[^>]*>Guardando…/); expect(h).toMatch(/<input[^>]*disabled/); expect((h.match(/<select[^>]*disabled/g) ?? []).length).toBeGreaterThanOrEqual(2);
  const err = html({ envio: { ...base.envio, mensaje: { tono: "error", texto: "No se pudo guardar el conteo." } } }); expect(err).toContain('role="alert"'); expect(err).toContain("No se pudo guardar el conteo."); expect(err).toMatch(/<button[^>]*type="button"[^>]*>Reintentar/);
  const ok = html({ envio: { ...base.envio, mensaje: { tono: "exito", texto: "Conteo guardado: 7 u." } } }); expect(ok).toContain('role="status"'); expect(ok).toContain("Conteo guardado: 7 u.");
});
it("conflicto: vigente vs propuesta, fecha sin autor inventado, ubicación/cantidad bloqueadas y un solo descartar", () => {
  const base = props(); const conflicto: PropsFormularioVista["envio"]["conflicto"] = { vigente: { id: 9, cantidad: 9, creadoEn: "2026-11-17T02:30:00Z" }, propuesta: 7 };
  const borradorActivo: PropsFormularioVista["borrador"] = { actual: true, restaurable: null, onRestaurar: vi.fn(), onDescartar: vi.fn() };
  const cantidad = { texto: "7", valor: 7, diferencia: null, invalido: false, onCambiar: vi.fn() };
  const h = html({ ubicacion: sel(), cantidad, borrador: borradorActivo, envio: { ...base.envio, conflicto } });
  expect(h).toContain('role="alert"'); expect(h).toContain("El conteo cambió mientras editabas"); expect(h).toContain("Vigente: 9 u."); expect(h).toContain("Tu propuesta: 7 u.");
  expect(h).toContain("16-11-2026"); expect(h).toContain("23:30"); expect(h).not.toMatch(/qa-|usuario:/); expect(h).toMatch(/no se guarda/i);
  for (const t of ["Volver a contar sobre la versión actual", "Seguir revisando"]) expect(h).toMatch(new RegExp(`<button[^>]*type="button"[^>]*>${t}</button>`));
  expect(h).toMatch(/<input[^>]*disabled/); expect((h.match(/<select[^>]*disabled/g) ?? []).length).toBeGreaterThanOrEqual(2);
  expect((h.match(/Descartar borrador/g) ?? []).length).toBe(1); expect(borradorActivo.onDescartar).not.toHaveBeenCalled();
  expect(base.envio.onGuardar).not.toHaveBeenCalled(); expect(base.envio.onVolverAContar).not.toHaveBeenCalled();
});
