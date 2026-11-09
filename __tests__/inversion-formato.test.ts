/**
 * Fase B — Módulo 2, Slice 5a: formateo de valores para la UI.
 */

import { describe, it, expect } from "vitest";
import {
  formatearNumero,
  formatearMoneda,
  formatearPromedio,
  formatearFecha,
} from "@/lib/utils/inversion-formato";

describe("formatearNumero()", () => {
  it("usa separador de miles es-CL y sin decimales", () => {
    expect(formatearNumero(0)).toBe("0");
    expect(formatearNumero(148163)).toBe("148.163");
    expect(formatearNumero(-5)).toBe("-5");
  });
});

describe("formatearMoneda()", () => {
  it("prefija USD y usa coma decimal es-CL", () => {
    expect(formatearMoneda(148163.01)).toBe("USD 148.163,01");
    expect(formatearMoneda(0)).toBe("USD 0,00");
    expect(formatearMoneda(932)).toBe("USD 932,00");
  });

  it("conserva el signo en valores negativos", () => {
    expect(formatearMoneda(-7.5)).toBe("USD -7,50");
  });
});

describe("formatearPromedio()", () => {
  it("null → guion largo", () => {
    expect(formatearPromedio(null)).toBe("—");
  });

  it("número → misma moneda que formatearMoneda", () => {
    expect(formatearPromedio(2)).toBe("USD 2,00");
    expect(formatearPromedio(1.5)).toBe("USD 1,50");
  });
});

describe("formatearFecha()", () => {
  it("null → guion largo", () => {
    expect(formatearFecha(null)).toBe("—");
  });

  it("ISO YYYY-MM-DD → DD-MM-YYYY sin corrimiento de zona", () => {
    expect(formatearFecha("2026-05-19")).toBe("19-05-2026");
  });

  it("timestamp ISO → toma solo la fecha", () => {
    expect(formatearFecha("2026-05-19T23:30:00.000Z")).toBe("19-05-2026");
  });

  it("texto inválido → guion largo", () => {
    expect(formatearFecha("garbage")).toBe("—");
    expect(formatearFecha("2026-13")).toBe("—");
  });
});
