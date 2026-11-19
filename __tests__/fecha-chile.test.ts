/**
 * Fase B — Bug de fechas corridas un día.
 * `new Date("YYYY-MM-DD")` se interpreta como medianoche UTC: en Chile (UTC-3)
 * muestra el día anterior. Y la fecha de un timestamp debe ser la de Chile,
 * no la UTC.
 */

import { describe, it, expect } from "vitest";
import { formatearFechaISO, fechaChileDeTimestamp, formatearFechaChile, formatearHoraChile } from "@/lib/utils/fecha-chile";

describe("formatearFechaISO()", () => {
  it("YYYY-MM-DD → DD-MM-YYYY sin corrimiento de zona", () => {
    expect(formatearFechaISO("2026-10-01")).toBe("01-10-2026");
  });

  it("toma el prefijo de un timestamp ISO", () => {
    expect(formatearFechaISO("2026-10-01T00:00:00.000Z")).toBe("01-10-2026");
  });
});

describe("fechaChileDeTimestamp()", () => {
  it("01:00 UTC del 11-11 es todavía 10-11 en Chile", () => {
    expect(fechaChileDeTimestamp(new Date("2026-11-11T01:00:00Z"))).toBe("2026-11-10");
  });

  it("04:37 UTC del 11-11 ya es 11-11 en Chile", () => {
    expect(fechaChileDeTimestamp(new Date("2026-11-11T04:37:00Z"))).toBe("2026-11-11");
  });
});

describe("formatearHoraChile()", () => {
  it("02:30 UTC del 17-11 es 23:30 del 16-11 en Chile", () => {
    expect(formatearHoraChile("2026-11-17T02:30:00Z")).toBe("23:30");
    expect(formatearFechaChile("2026-11-17T02:30:00Z")).toBe("16-11-2026");
  });

  it("medianoche local es 00:05, nunca 24:05", () => {
    expect(formatearHoraChile("2026-11-17T03:05:00Z")).toBe("00:05");
    expect(formatearHoraChile("2026-11-17T03:05:00Z")).not.toBe("24:05");
  });

  it("fecha inválida devuelve — sin lanzar", () => {
    expect(() => formatearHoraChile("no-es-fecha")).not.toThrow();
    expect(formatearHoraChile("no-es-fecha")).toBe("—");
  });
});
