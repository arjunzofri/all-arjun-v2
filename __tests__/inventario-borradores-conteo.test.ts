/**
 * Fase B — inv-09.1: contratos y validación pura de borradores de conteo.
 * ROJO esperado: no existe lib/inventario/borradores-conteo.ts.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_CANTIDAD, MAX_TEXTO_CANTIDAD, claveBorrador, esBorradorValido,
  parsearCantidadTexto,
  type BorradorConteo, type BorradoresConteo, type EntradaBorrador,
} from "@/lib/inventario/borradores-conteo";
import type { UbicacionInventario } from "@/lib/inventario/ubicaciones";

const N1 = "11111111-1111-4111-8111-111111111111";
const U1: UbicacionInventario = { bodega: 1, planta: "", pasillo: "A1", posicion: "F" };
const U2: UbicacionInventario = { bodega: 2, planta: "ARRIBA", pasillo: "IZQUIERDA", posicion: "M" };

const borrador = (productoId: number, ubicacion: UbicacionInventario, actualizadoEn: number,
  nonce: string, expectedConteoId: number | null = null): BorradorConteo =>
  ({ productoId, ubicacion, cantidadTexto: "1", expectedConteoId, nonce, actualizadoEn });

describe("parsearCantidadTexto", () => {
  it.each([["0", 0], ["00", 0], ["7", 7], ["007", 7], [" 12 ", 12],
    [String(MAX_CANTIDAD), MAX_CANTIDAD]])("acepta %s", (texto, esperado) => {
    expect(parsearCantidadTexto(texto)).toBe(esperado);
  });
  it.each(["", "   ", "-1", "+1", "1.5", "1,5", "1.000", "1,000", "1 000", "1e3",
    "0x10", "2147483648", "9".repeat(400), null, 12, {}, []])(
    "rechaza %s sin convertir vacío en 0", (texto) => {
      expect(parsearCantidadTexto(texto)).toBeNull();
      expect(parsearCantidadTexto("")).not.toBe(0);
    });
});

describe("claveBorrador", () => {
  it("compone producto|ubicación exacta y sin colisión entre productos", () => {
    const mapa: BorradoresConteo = { [claveBorrador(7, U1)]: borrador(7, U1, 100, N1) };
    const entrada: EntradaBorrador = { productoId: 7, ubicacion: U2, expectedConteoId: null };
    expect(claveBorrador(entrada.productoId, entrada.ubicacion)).toBe("7|2|ARRIBA|IZQUIERDA|M");
    expect(claveBorrador(7, U1)).toBe("7|1||A1|F");
    expect(claveBorrador(8, U1)).not.toBe(claveBorrador(7, U1));
    expect(mapa["7|1||A1|F"].productoId).toBe(7);
  });
});

describe("esBorradorValido", () => {
  it("acepta válido aunque el texto crudo no sea cantidad parseable", () => {
    expect(MAX_TEXTO_CANTIDAD).toBe(32);
    expect(MAX_CANTIDAD).toBe(2147483647);
    expect(esBorradorValido(borrador(7, U1, 100, N1, 5))).toBe(true);
    expect(esBorradorValido({ ...borrador(7, U2, 0, N1), cantidadTexto: "x" })).toBe(true);
    expect(esBorradorValido({ ...borrador(7, U1, 100, N1), cantidadTexto: "x".repeat(32) })).toBe(true);
  });
  it("rechaza guardas manipuladas sin lanzar", () => {
    const valido = borrador(7, U2, 100, N1, 5);
    const invalidos: unknown[] = [null, "x", [], {},
      { ...valido, productoId: 0 }, { ...valido, productoId: 2147483648 },
      { ...valido, productoId: 1.5 }, { ...valido, productoId: Number.NaN },
      { ...valido, expectedConteoId: 0 },
      { ...valido, expectedConteoId: Number.MAX_SAFE_INTEGER + 1 },
      { ...valido, ubicacion: { bodega: 3 } }, { ...valido, ubicacion: { bodega: 1 } },
      { ...valido, nonce: "no-uuid" },
      { ...valido, cantidadTexto: 7 }, { ...valido, cantidadTexto: "x".repeat(33) },
      { ...valido, actualizadoEn: Number.NaN }, { ...valido, actualizadoEn: -1 }];
    for (const m of invalidos) expect(esBorradorValido(m)).toBe(false);
  });
});
