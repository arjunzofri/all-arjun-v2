/**
 * Fase B — Módulo 2, Slice 5a: página /inversion-mercaderia.
 *
 * Orden de controles: sin sesión → login; flag apagado → 404;
 * operador → 404; admin + flag → carga y compone el resumen.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const state = vi.hoisted(() => ({ flag: true }));
vi.mock("@/lib/feature-flags", () => ({
  flagActivo: (key: string) => key === "inversion_mercaderia" && state.flag,
}));

vi.mock("@/lib/utils/inversion-lotes", () => ({
  getStockPorCodigo: vi.fn(),
  getLotesCompraPorCodigos: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

import { auth } from "@/lib/auth";
import {
  getStockPorCodigo,
  getLotesCompraPorCodigos,
} from "@/lib/utils/inversion-lotes";
import { calcularResumenInversion } from "@/lib/utils/inversion-resumen";
import type { LoteCompra } from "@/lib/utils/inversion-fifo";
import type { StockCodigo } from "@/lib/utils/inversion-lotes";
import TablaInversion from "@/components/inversion/TablaInversion";
import InversionMercaderiaPage, {
  resolverAccesoInversion,
  dynamic,
} from "@/app/(dashboard)/inversion-mercaderia/page";
import { redirect, notFound } from "next/navigation";

const mockAuth = vi.mocked(auth);
const mockStock = vi.mocked(getStockPorCodigo);
const mockLotes = vi.mocked(getLotesCompraPorCodigos);

const ADMIN = { user: { id: "1", role: "admin" } } as never;
const OPERADOR = { user: { id: "2", role: "operador" } } as never;

const stock: Map<string, StockCodigo> = new Map([
  ["1055", { stock: 466, detalle: "PRODUCTO 1055" }],
  ["SIN", { stock: 12, detalle: null }],
]);
const lotes: Map<string, LoteCompra[]> = new Map([
  [
    "1055",
    [
      { folio: "001653", fecha: "2026-05-19", cantidad: 450, costoUnitario: 2 },
      { folio: "002418", fecha: "2025-02-19", cantidad: 60, costoUnitario: 2 },
    ],
  ],
]);

beforeEach(() => {
  vi.clearAllMocks();
  state.flag = true;
  mockAuth.mockResolvedValue(ADMIN);
  mockStock.mockResolvedValue(new Map());
  mockLotes.mockResolvedValue(new Map());
});

describe("resolverAccesoInversion()", () => {
  it("sin sesión → login, aunque el flag esté apagado", () => {
    expect(resolverAccesoInversion(null, false)).toBe("login");
    expect(resolverAccesoInversion(null, true)).toBe("login");
  });

  it("flag apagado con admin → no-encontrado", () => {
    expect(resolverAccesoInversion(ADMIN, false)).toBe("no-encontrado");
  });

  it("operador con flag activo → no-encontrado", () => {
    expect(resolverAccesoInversion(OPERADOR, true)).toBe("no-encontrado");
  });

  it("admin con flag activo → ok", () => {
    expect(resolverAccesoInversion(ADMIN, true)).toBe("ok");
  });
});

describe("página", () => {
  it("es force-dynamic (no se congela en el build)", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("sin sesión → redirect /login sin consultar datos", async () => {
    mockAuth.mockResolvedValue(null as never);

    await expect(InversionMercaderiaPage()).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(mockStock).not.toHaveBeenCalled();
    expect(mockLotes).not.toHaveBeenCalled();
  });

  it("flag apagado → notFound sin consultar datos", async () => {
    state.flag = false;

    await expect(InversionMercaderiaPage()).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(mockStock).not.toHaveBeenCalled();
    expect(mockLotes).not.toHaveBeenCalled();
  });

  it("operador → notFound sin consultar datos", async () => {
    mockAuth.mockResolvedValue(OPERADOR);

    await expect(InversionMercaderiaPage()).rejects.toThrow("NOT_FOUND");
    expect(mockStock).not.toHaveBeenCalled();
    expect(mockLotes).not.toHaveBeenCalled();
  });

  it("admin: una consulta de stock y una batch con sus códigos", async () => {
    mockStock.mockResolvedValue(stock);
    mockLotes.mockResolvedValue(lotes);

    await InversionMercaderiaPage();

    expect(mockStock).toHaveBeenCalledTimes(1);
    expect(mockLotes).toHaveBeenCalledTimes(1);
    expect(mockLotes).toHaveBeenCalledWith([...stock.keys()]);
  });

  it("admin: pasa calcularResumenInversion(stock, lotes) a TablaInversion", async () => {
    mockStock.mockResolvedValue(stock);
    mockLotes.mockResolvedValue(lotes);

    const el = (await InversionMercaderiaPage()) as React.ReactElement;
    const children = React.Children.toArray(
      (el.props as { children: React.ReactNode }).children
    );
    const tabla = children.find(
      (c) => React.isValidElement(c) && c.type === TablaInversion
    ) as React.ReactElement | undefined;

    expect(tabla).toBeDefined();
    expect((tabla!.props as { resumen: unknown }).resumen).toEqual(
      calcularResumenInversion(stock, lotes)
    );
  });
});
