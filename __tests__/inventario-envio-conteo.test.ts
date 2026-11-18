import { expect, it, vi } from "vitest";
import type { BorradorConteo } from "@/lib/inventario/borradores-conteo";
import type { ConteoDTO, RegistrarConteoInput, RegistrarConteoRespuesta } from "@/lib/inventario/contratos";
import { crearEnvioConteo, MENSAJE_BORRADOR_INVALIDO, MENSAJE_ERROR_ENVIO } from "@/lib/inventario/envio-conteo";
import type { UbicacionInventario } from "@/lib/inventario/ubicaciones";

const N = "11111111-1111-4111-8111-111111111111";
const U: UbicacionInventario = { bodega: 1, planta: "", pasillo: "A2", posicion: "P" };
const D = (o: Partial<BorradorConteo> = {}): BorradorConteo => ({ productoId: 7, ubicacion: U, cantidadTexto: "12", expectedConteoId: null, nonce: N, actualizadoEn: 1, ...o });
const C = (o: Partial<ConteoDTO> = {}): ConteoDTO => ({ id: 9, productoId: 7, bodega: 1, planta: "", pasillo: "A2", posicion: "P", cantidad: 12, usuarioId: 1, creadoEn: "2026-11-01T00:00:00.000Z", ...o });
const PAYLOAD: RegistrarConteoInput = { productoId: 7, ubicacion: U, cantidad: 12, expectedConteoId: null, idempotencyKey: N };
const ctrl = (r: RegistrarConteoRespuesta | Error = { ok: true, conteo: C(), repetido: false }) => {
  const enviados: RegistrarConteoInput[] = [];
  const accion = vi.fn(async (input: RegistrarConteoInput): Promise<RegistrarConteoRespuesta> => {
    enviados.push(input); if (r instanceof Error) throw r; return r;
  });
  const descartar = vi.fn();
  return { accion, descartar, enviados, c: crearEnvioConteo({ accion, descartar }) };
};

it("éxito: payload canónico exacto de 5 campos, un descarte y cantidad", async () => {
  const { accion, descartar, enviados, c } = ctrl();
  const r = await c.enviar(D({ cantidadTexto: " 12 " }));
  expect(enviados).toStrictEqual([PAYLOAD]); expect(accion).toHaveBeenCalledTimes(1);
  expect(descartar.mock.calls).toEqual([[7, U, N]]);
  expect(r).toEqual({ tipo: "exito", conteo: C(), repetido: false, cantidad: 12, nonce: N });
  expect(c.ocupado).toBe(false);
});
it("replay: repetido true distinguible y descarte único", async () => {
  const { descartar, c } = ctrl({ ok: true, conteo: C(), repetido: true });
  expect(await c.enviar(D())).toMatchObject({ tipo: "exito", repetido: true });
  expect(descartar).toHaveBeenCalledTimes(1); expect(descartar).toHaveBeenCalledWith(7, U, N);
});
it("conflicto: no descarta y proyecta vigente a solo 3 campos", async () => {
  const { descartar, c } = ctrl({ ok: false, conflicto: true, vigente: C() });
  const r = await c.enviar(D({ cantidadTexto: "60" }));
  expect(descartar).not.toHaveBeenCalled();
  expect(r).toEqual({ tipo: "conflicto", vigente: { id: 9, cantidad: 12, creadoEn: C().creadoEn }, propuesta: 60, nonce: N });
});
it("conflicto sin vigente: null explícito y 0 válido", async () => {
  const { c } = ctrl({ ok: false, conflicto: true, vigente: null });
  expect(await c.enviar(D({ cantidadTexto: "0" }))).toEqual({ tipo: "conflicto", vigente: null, propuesta: 0, nonce: N });
});
it("throw: error fijo sin raw y sin descarte", async () => {
  const { descartar, c } = ctrl(new Error("boom-raw"));
  const r = await c.enviar(D());
  expect(r).toEqual({ tipo: "error", mensaje: MENSAJE_ERROR_ENVIO, nonce: N });
  expect(JSON.stringify(r)).not.toContain("boom-raw"); expect(descartar).not.toHaveBeenCalled();
});
it("errorDTO: error fijo sin raw y sin descarte", async () => {
  const { descartar, c } = ctrl({ ok: false, error: "raw" });
  const r = await c.enviar(D());
  expect(r).toEqual({ tipo: "error", mensaje: MENSAJE_ERROR_ENVIO, nonce: N });
  expect(JSON.stringify(r)).not.toContain("raw"); expect(descartar).not.toHaveBeenCalled();
});
it("borrador inválido o texto corrupto: inválido sin action ni ocupado", async () => {
  const { accion, c } = ctrl();
  expect(await c.enviar(D({ cantidadTexto: "" }))).toEqual({ tipo: "invalido", mensaje: MENSAJE_BORRADOR_INVALIDO });
  expect(await c.enviar(D({ nonce: "no-uuid" }))).toEqual({ tipo: "invalido", mensaje: MENSAJE_BORRADOR_INVALIDO });
  expect(accion).not.toHaveBeenCalled(); expect(c.ocupado).toBe(false);
});
it("doble envío con draft nuevo pendiente: payload viejo y segundo ocupado", async () => {
  let resolver!: (r: RegistrarConteoRespuesta) => void;
  const enviados: RegistrarConteoInput[] = [];
  const accion = vi.fn((input: RegistrarConteoInput) => { enviados.push(input); return new Promise<RegistrarConteoRespuesta>((res) => { resolver = res; }); });
  const c = crearEnvioConteo({ accion, descartar: vi.fn() });
  const p1 = c.enviar(D());
  expect(await c.enviar(D({ cantidadTexto: "99" }))).toEqual({ tipo: "ocupado" });
  expect(enviados).toStrictEqual([PAYLOAD]); resolver({ ok: true, conteo: C(), repetido: false });
  expect((await p1).tipo).toBe("exito"); expect(accion).toHaveBeenCalledTimes(1);
});
it("snapshot: mutar el borrador pendiente no altera descarte ni nonce", async () => {
  let resolver!: (r: RegistrarConteoRespuesta) => void;
  const descartar = vi.fn();
  const c = crearEnvioConteo({ accion: () => new Promise((res) => { resolver = res; }), descartar });
  const borrador = D();
  const p = c.enviar(borrador);
  borrador.nonce = "22222222-2222-4222-8222-222222222222"; borrador.cantidadTexto = "99";
  resolver({ ok: true, conteo: C(), repetido: false });
  const r = await p;
  expect(descartar.mock.calls).toEqual([[7, U, N]]); expect(r).toMatchObject({ tipo: "exito", nonce: N });
});
it("tras error: ocupado false y reintento con el mismo nonce", async () => {
  const { enviados, c } = ctrl({ ok: false, error: "raw" });
  expect((await c.enviar(D())).tipo).toBe("error"); expect(c.ocupado).toBe(false);
  await c.enviar(D()); expect(enviados.map((e) => e.idempotencyKey)).toEqual([N, N]);
});
