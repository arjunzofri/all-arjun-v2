/**
 * Fase B — Módulo 2, Slice 5b: modal DetalleCodigo + apertura desde TablaInversion.
 *
 * Riesgos:
 *  - Mensajes de error por status sin filtrar el mensaje original del servidor.
 *  - Cancelación del fetch al cerrar / cambiar de código.
 *  - Modal accesible (role=dialog, aria-modal, Escape).
 *  - Fechas formateadas por string, nunca con new Date (timezone).
 *  - El tipo RespuestaInversion entra como `import type` (no arrastra la
 *    ruta server-side, ni auth ni DB, al bundle cliente).
 *  - TablaInversion: código como <button> y estado seleccionado.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  clavePartida,
  formatearOrigen,
  mensajeErrorDetalle,
  urlDetalle,
} from "@/components/inversion/DetalleCodigo";

// ── urlDetalle ───────────────────────────────────────────────────────────

describe("urlDetalle()", () => {
  it("arma la URL del endpoint y codifica el código", () => {
    expect(urlDetalle("A B/1")).toBe(
      "/api/inversion/por-codigo?codigo=A%20B%2F1"
    );
  });
});

// ── mensajeErrorDetalle ──────────────────────────────────────────────────

describe("mensajeErrorDetalle()", () => {
  it("401 → habla de la sesión", () => {
    expect(mensajeErrorDetalle(401)).toMatch(/sesi[oó]n/i);
  });

  it("403 → habla de permisos", () => {
    expect(mensajeErrorDetalle(403)).toMatch(/permiso/i);
  });

  it("404 → dice que el detalle no está disponible", () => {
    expect(mensajeErrorDetalle(404)).toMatch(/no est[aá] disponible/i);
  });

  it("502 → nombra Vida Digital", () => {
    expect(mensajeErrorDetalle(502)).toMatch(/Vida Digital/i);
  });

  it("cualquier otro status → mensaje genérico, sin números ni URLs", () => {
    const m = mensajeErrorDetalle(500);
    expect(m.length).toBeGreaterThan(0);
    expect(m).not.toMatch(/\d/);
    expect(m).not.toMatch(/http|fetch|api/i);
  });

  it("estados distintos producen mensajes distintos", () => {
    const mensajes = [400, 401, 403, 404, 502, 500].map(mensajeErrorDetalle);
    expect(new Set(mensajes).size).toBe(mensajes.length);
  });
});

// ── Origen de la partida ─────────────────────────────────────────────────

describe("formatearOrigen()", () => {
  it("traduce cada empresa y usa — cuando no hay origen", () => {
    expect(formatearOrigen("vida")).toBe("Vida Digital");
    expect(formatearOrigen("sanjh")).toBe("Sanjh");
    expect(formatearOrigen(undefined)).toBe("—");
  });
});

describe("clavePartida()", () => {
  const base = {
    folio: "001986",
    fecha: "2026-08-03",
    costoUnitario: 3,
  };

  it("produce keys distintas para la misma nota en dos empresas", () => {
    const vida = clavePartida({ ...base, origen: "vida" });
    const sanjh = clavePartida({ ...base, origen: "sanjh" });

    expect(vida).not.toBe(sanjh);
    expect(vida).toBe("vida-001986-2026-08-03-3");
    expect(sanjh).toBe("sanjh-001986-2026-08-03-3");
  });

  it("tolera origen, fecha y costo nulos", () => {
    expect(
      clavePartida({ folio: "MAN-1", fecha: null, costoUnitario: null })
    ).toBe("-MAN-1--");
  });
});

// ── Contrato de fuente: DetalleCodigo ────────────────────────────────────

describe("DetalleCodigo.tsx — contrato de fuente", () => {
  const src = readFileSync(
    resolve(__dirname, "../components/inversion/DetalleCodigo.tsx"),
    "utf8"
  );

  it("es client component", () => {
    expect(src.trimStart()).toMatch(/^"use client";/);
  });

  it("modal accesible: role=dialog, aria-modal y Escape", () => {
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
    expect(src).toMatch(/Escape/);
  });

  it("cancela el fetch con AbortController", () => {
    expect(src).toMatch(/new AbortController\(\)/);
    expect(src).toMatch(/signal:\s*controller\.signal/);
    expect(src).toMatch(/controller\.abort\(\)/);
  });

  it("RespuestaInversion entra como import type desde el route", () => {
    expect(src).toMatch(
      /import\s+type\s*{\s*RespuestaInversion\s*}\s*from\s*"@\/app\/api\/inversion\/por-codigo\/route"/
    );
  });

  it("formatea fechas por string, sin new Date", () => {
    expect(src).toMatch(/formatearFecha/);
    expect(src).not.toMatch(/new Date/);
  });

  it("no renderiza el mensaje original de un error capturado", () => {
    expect(src).not.toMatch(/\.message/);
  });

  it("muestra Nota de Venta y la columna Empresa", () => {
    expect(src).toContain("Nota de Venta");
    expect(src).toContain("Empresa");
    expect(src).not.toMatch(/>Folio</);
    expect(src).toMatch(/clavePartida\(/);
  });
});

// ── Contrato de fuente: TablaInversion ───────────────────────────────────

describe("TablaInversion.tsx — apertura del detalle", () => {
  const src = readFileSync(
    resolve(__dirname, "../components/inversion/TablaInversion.tsx"),
    "utf8"
  );

  it("es client component", () => {
    expect(src.trimStart()).toMatch(/^"use client";/);
  });

  it("mantiene el código seleccionado en estado", () => {
    expect(src).toMatch(/useState<string \| null>/);
  });

  it("la celda de código es un <button> que selecciona", () => {
    expect(src).toMatch(/<button[\s\S]{0,120}?setSeleccionado\(f\.codigo\)/);
  });

  it("renderiza DetalleCodigo del código seleccionado", () => {
    expect(src).toMatch(/<DetalleCodigo/);
    expect(src).toMatch(/onClose=/);
  });
});
