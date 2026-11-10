"use client";

import { useEffect, useState } from "react";
import type { RespuestaInversion } from "@/app/api/inversion/por-codigo/route";
import type {
  OrigenEmpresa,
  PartidaValorizada,
} from "@/lib/utils/inversion-fifo";
import {
  formatearFecha,
  formatearMoneda,
  formatearNumero,
  formatearPromedio,
} from "@/lib/utils/inversion-formato";

export function urlDetalle(codigo: string): string {
  return `/api/inversion/por-codigo?codigo=${encodeURIComponent(codigo)}`;
}

export function formatearOrigen(origen?: OrigenEmpresa): string {
  if (origen === "vida") return "Vida Digital";
  if (origen === "sanjh") return "Sanjh";
  return "—";
}

/** Key estable de fila: misma nota en dos empresas no colisiona. */
export function clavePartida(
  p: Pick<PartidaValorizada, "origen" | "folio" | "fecha" | "costoUnitario">
): string {
  return `${p.origen ?? ""}-${p.folio}-${p.fecha ?? ""}-${p.costoUnitario ?? ""}`;
}

/** Mensaje por status. Nunca se muestra el mensaje original del servidor. */
export function mensajeErrorDetalle(status: number): string {
  if (status === 400) return "El código no es válido.";
  if (status === 401) return "Tu sesión expiró. Volvé a iniciar sesión.";
  if (status === 403) return "No tenés permiso para ver este detalle.";
  if (status === 404) return "El detalle no está disponible.";
  if (status === 502) return "No se pudo consultar Vida Digital.";
  return "No se pudo cargar el detalle.";
}

interface Props {
  codigo: string;
  onClose: () => void;
}

export default function DetalleCodigo({ codigo, onClose }: Props) {
  const [datos, setDatos] = useState<RespuestaInversion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setDatos(null);
    setError(null);
    setCargando(true);

    (async () => {
      try {
        const res = await fetch(urlDetalle(codigo), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setError(mensajeErrorDetalle(res.status));
          setCargando(false);
          return;
        }
        const data = (await res.json()) as RespuestaInversion;
        if (controller.signal.aborted) return;
        setDatos(data);
        setCargando(false);
      } catch {
        if (controller.signal.aborted) return;
        setError(mensajeErrorDetalle(0));
        setCargando(false);
      }
    })();

    return () => controller.abort();
  }, [codigo]);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-codigo-titulo"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="detalle-codigo-titulo"
              className="text-lg font-bold text-slate-900"
            >
              Detalle {codigo}
            </h2>
            {datos && (
              <p className="text-xs text-slate-500 mt-1">
                Stock actual {formatearNumero(datos.stockActual)} ·{" "}
                {formatearMoneda(datos.valorTotal)} ·{" "}
                {formatearNumero(datos.cantidadSinCosto)} sin costo
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          {cargando && (
            <p role="status" className="py-8 text-center text-sm text-slate-400">
              Cargando detalle…
            </p>
          )}

          {!cargando && error && (
            <p role="alert" className="py-8 text-center text-sm text-red-600">
              {error}
            </p>
          )}

          {!cargando && datos && (
            <>
              {datos.advertencia === "stock_negativo" && (
                <p className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  El stock registrado es negativo (
                  {formatearNumero(datos.stockRegistrado)}). El cálculo usa 0.
                </p>
              )}

              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-2 pl-3 pr-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nota de Venta</th>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Empresa</th>
                    <th className="py-2 px-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Comprado</th>
                    <th className="py-2 px-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Remanente</th>
                    <th className="py-2 px-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Costo unit.</th>
                    <th className="py-2 pl-2 pr-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {datos.partidas.map((p) => (
                    <tr key={clavePartida(p)}>
                      <td className="py-2 pl-3 pr-2 text-xs text-slate-600 tabular-nums">
                        {formatearFecha(p.fecha)}
                      </td>
                      <td className="py-2 px-2 text-xs font-medium text-slate-700">
                        {p.folio}
                      </td>
                      <td className="py-2 px-2 text-xs text-slate-600">
                        {formatearOrigen(p.origen)}
                      </td>
                      <td className="py-2 px-2 text-right text-xs text-slate-600 tabular-nums">
                        {formatearNumero(p.cantidadComprada)}
                      </td>
                      <td className="py-2 px-2 text-right text-xs text-slate-800 tabular-nums">
                        {formatearNumero(p.cantidadRemanente)}
                      </td>
                      <td className="py-2 px-2 text-right text-xs text-slate-600 tabular-nums">
                        {formatearPromedio(p.costoUnitario)}
                      </td>
                      <td className="py-2 pl-2 pr-3 text-right text-xs text-slate-800 tabular-nums">
                        {p.valor === null ? "—" : formatearMoneda(p.valor)}
                      </td>
                    </tr>
                  ))}
                  {datos.partidas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                        Sin compras registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <p className="mt-3 text-xs text-slate-400">
                Compras totales: {formatearNumero(datos.cantidadTotalCompras)} ·
                Valorizadas: {formatearNumero(datos.cantidadValorizada)}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
