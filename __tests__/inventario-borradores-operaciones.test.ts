/**
 * Fase B — inv-09.2: operaciones de borradores de conteo.
 * ROJO esperado: el helper aún no expone guardar/descartar/consultar.
 */
import { describe, expect, it } from "vitest";
import {
  borradoresDeProducto, claveBorrador, descartarBorrador, guardarCantidadTexto, obtenerBorrador,
  ultimoBorradorCompatible, type BorradorConteo, type BorradoresConteo, type EntradaBorrador,
} from "@/lib/inventario/borradores-conteo";
import type { UbicacionInventario } from "@/lib/inventario/ubicaciones";
const N1 = "11111111-1111-4111-8111-111111111111";
const N2 = "22222222-2222-4222-8222-222222222222";
const N3 = "33333333-3333-4333-8333-333333333333";
const U1: UbicacionInventario = { bodega: 1, planta: "", pasillo: "A1", posicion: "F" };
const U2: UbicacionInventario = { bodega: 2, planta: "ARRIBA", pasillo: "IZQUIERDA", posicion: "M" };
const U3: UbicacionInventario = { bodega: 2, planta: "ABAJO", pasillo: "IZQUIERDA", posicion: "P" };
const U4: UbicacionInventario = { bodega: 2, planta: "ARRIBA", pasillo: "DERECHA", posicion: "M" };
const b = (productoId: number, ubicacion: UbicacionInventario, actualizadoEn: number,
  nonce: string, expectedConteoId: number | null = null): BorradorConteo =>
  ({ productoId, ubicacion, cantidadTexto: "1", expectedConteoId, nonce, actualizadoEn });
const mapa = (...bs: BorradorConteo[]): BorradoresConteo =>
  Object.fromEntries(bs.map((x) => [claveBorrador(x.productoId, x.ubicacion), x]));
const entrada = (productoId: number, ubicacion: UbicacionInventario,
  expectedConteoId: number | null = null): EntradaBorrador => ({ productoId, ubicacion, expectedConteoId });
const nonces = (...ns: string[]) => { let i = 0; return () => ns[i++]; };
describe("guardarCantidadTexto", () => {
  it("crea el borrador exacto bajo producto|ubicación sin mutar el mapa original", () => {
    const original: BorradoresConteo = {};
    const r = guardarCantidadTexto(original, entrada(5, U1, 5), "12", 100, nonces(N1));
    expect([Object.keys(r.borradores), r.borrador]).toEqual([["5|1||A1|F"],
      { productoId: 5, ubicacion: U1, cantidadTexto: "12", expectedConteoId: 5, nonce: N1, actualizadoEn: 100 }]);
    expect([original, r.borradores === original]).toEqual([{}, false]);
    expect(guardarCantidadTexto({}, entrada(6, U2), "x", 0, nonces(N2)).borrador?.cantidadTexto).toBe("x");
  });
  it("mismo texto conserva referencias, expected, nonce y tiempo sin llamar factory", () => {
    let llamadas = 0;
    const f = () => { llamadas++; return N1; };
    const a = guardarCantidadTexto({}, entrada(5, U1, 5), "12", 100, f);
    const r = guardarCantidadTexto(a.borradores, entrada(5, U1, 99), "12", 200, f);
    expect([r.borrador === a.borrador, r.borrador?.expectedConteoId, r.borrador?.nonce, r.borrador?.actualizadoEn]).toEqual([true, 5, N1, 100]);
    expect([r.borradores === a.borradores, llamadas]).toEqual([true, 1]);
  });
  it("texto nuevo rota nonce y conserva expected, incluso al volver al texto previo", () => {
    const f = nonces(N1, N2, N3);
    const a = guardarCantidadTexto({}, entrada(5, U1, 5), "12", 100, f);
    const r1 = guardarCantidadTexto(a.borradores, entrada(5, U1, 99), "13", 200, f);
    const r2 = guardarCantidadTexto(r1.borradores, entrada(5, U1, 99), "12", 300, f);
    const s = [a.borrador, r1.borrador, r2.borrador];
    expect(s.map((x) => x?.nonce)).toEqual([N1, N2, N3]);
    expect(s.map((x) => [x?.expectedConteoId, x?.actualizadoEn])).toEqual([[5, 100], [5, 200], [5, 300]]);
    expect(r2.borradores).not.toBe(r1.borradores);
  });
});
describe("descartarBorrador", () => {
  it("borra solo la clave indicada y respeta nonceEsperado e inexistentes", () => {
    const b1 = b(7, U1, 100, N1), b2 = b(7, U2, 200, N2), otro = b(8, U2, 300, N3);
    const m = mapa(b1, b2, otro), r = descartarBorrador(m, 7, U2);
    expect([obtenerBorrador(r, 7, U2), obtenerBorrador(r, 7, U1), obtenerBorrador(r, 8, U2),
      obtenerBorrador(m, 7, U2)]).toEqual([null, b1, otro, b2]);
    expect([descartarBorrador(m, 7, U2, N1) === m, obtenerBorrador(descartarBorrador(m, 7, U2, N1), 7, U2) === b2]).toEqual([true, true]);
    expect(obtenerBorrador(descartarBorrador(m, 7, U2, N2), 7, U2)).toBeNull();
    expect([descartarBorrador(m, 9, U1) === m, descartarBorrador(m, 7, U2, "no-uuid") === m])
      .toEqual([true, true]);
  });
});
describe("consultas", () => {
  it("ordena fecha DESC con desempate clave ASC y filtra por bodega manual", () => {
    const a = b(7, U1, 100, N1), b2 = b(7, U2, 200, N2);
    const c = b(7, U3, 200, N3), d = b(7, U4, 300, N1), ajeno = b(8, U4, 400, N2);
    const m = mapa(a, b2, c, d, ajeno);
    expect(borradoresDeProducto(m, 7).map((x) => claveBorrador(x.productoId, x.ubicacion)))
      .toEqual(["7|2|ARRIBA|DERECHA|M", "7|2|ABAJO|IZQUIERDA|P",
        "7|2|ARRIBA|IZQUIERDA|M", "7|1||A1|F"]);
    expect([ultimoBorradorCompatible(m, 7, 2), ultimoBorradorCompatible(m, 7, 1),
      ultimoBorradorCompatible(m, 9, 2), borradoresDeProducto(m, 9)]).toEqual([d, a, null, []]);
  });
});
describe("guardas de entrada", () => {
  const invalidas: [unknown, string, number][] = [
    [entrada(0, U1), "1", 100], [entrada(2147483648, U1), "1", 100],
    [entrada(1.5, U1), "1", 100], [entrada(7, { bodega: 3 } as never), "1", 100],
    [entrada(7, { bodega: 1 } as never), "1", 100], [entrada(7, U1, 0), "1", 100],
    [entrada(7, U1, 1.5), "1", 100], [entrada(7, U1), "x".repeat(33), 100],
    [entrada(7, U1), "1", Number.NaN], [entrada(7, U1), "1", -1],
  ];
  it("devuelve mapa intacto o null sin lanzar ni invocar factory", () => {
    const base = b(7, U1, 100, N1), m = mapa(base);
    let llamadas = 0;
    const f = () => { llamadas++; return N2; };
    for (const [e, texto, ahora] of invalidas) {
      const r = guardarCantidadTexto(m, e as EntradaBorrador, texto, ahora, f);
      expect([r.borrador, r.borradores === m]).toEqual([null, true]);
    }
    expect(guardarCantidadTexto(m, entrada(7, U1), "2", 100, () => "no-uuid").borrador).toBeNull();
    expect([llamadas, descartarBorrador(m, 0, U1) === m,
      descartarBorrador(m, 7, { bodega: 3 } as never) === m]).toEqual([0, true, true]);
    expect([obtenerBorrador(m, 0, U1), obtenerBorrador(m, 7, { bodega: 3 } as never),
      obtenerBorrador(m, 7, U1)]).toEqual([null, null, base]);
  });
});
