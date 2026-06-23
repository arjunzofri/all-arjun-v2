"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getMovimientosContribuyentes, crearAjuste } from "@/lib/actions/ajustes";
import type { CrearAjusteInput, CrearAjusteResult } from "@/lib/actions/ajustes";
import type { Ubicacion } from "@/lib/utils/movimiento-ubicacion";

// ── Tipos ──────────────────────────────────────────────────────────────────

type MovimientoItem = {
  movimientoId: number;
  tipo: "salida" | "retorno" | "entrada";
  cantidadOriginal: number;
  cantidadNeta: number;
  createdAt: Date;
};

type AjusteModalProps = {
  productoId: number;
  productoCodigo: string;
  ubicacion: Ubicacion;
  usuarioId: number;
  onClose: () => void;
  onSuccess: () => void;
};

// ── Funciones puras (exportadas para test sin jsdom) ───────────────────────

export function resolverSeleccionInicial(
  movimientos: MovimientoItem[],
): number | null {
  return movimientos.length === 1 ? movimientos[0].movimientoId : null;
}

type ParseResultado =
  | { valido: true; valor: number }
  | { valido: false; error: string };

export function parseCantidadReal(value: string): ParseResultado {
  if (value.trim() === "") {
    return { valido: false, error: "Ingresá la cantidad real" };
  }
  const n = Number(value);
  if (!Number.isInteger(n)) {
    return { valido: false, error: "Debe ser un número entero" };
  }
  if (n < 0) {
    return { valido: false, error: "No puede ser negativa" };
  }
  return { valido: true, valor: n };
}

/**
 * Handler genérico de submit con guard de doble-submit.
 *
 * Trata cualquier resultado sin throw como éxito — incluyendo
 * { ok: false, reason: "idempotente" }, que crearAjuste devuelve
 * sin lanzar excepción. Esto es intencional: idempotente = ya
 * se procesó, mismo resultado neto que el éxito.
 */
export function createAjusteSubmitHandler(config: {
  crearAjusteFn: (input: CrearAjusteInput) => Promise<CrearAjusteResult>;
  getInput: () => CrearAjusteInput;
  isPending: () => boolean;
  setPending: (v: boolean) => void;
  onExito: () => void;
  onError: (mensaje: string) => void;
}) {
  return async () => {
    if (config.isPending()) return;
    config.setPending(true);
    try {
      await config.crearAjusteFn(config.getInput());
      // No inspeccionar result.ok — idempotente también es éxito.
      config.onExito();
    } catch (err) {
      config.onError(err instanceof Error ? err.message : String(err));
    } finally {
      config.setPending(false);
    }
  };
}

// ── Componente ─────────────────────────────────────────────────────────────

export function AjusteModal({
  productoId,
  productoCodigo,
  ubicacion,
  usuarioId,
  onClose,
  onSuccess,
}: AjusteModalProps) {
  const idempotencyKey = useRef(crypto.randomUUID()).current;

  const [cargando, setCargando] = useState(true);
  const [movimientos, setMovimientos] = useState<MovimientoItem[]>([]);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [cantidadReal, setCantidadReal] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFetch, setErrorFetch] = useState<string | null>(null);

  // Cargar movimientos contribuyentes al montar
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const result = await getMovimientosContribuyentes(productoId, ubicacion);
        if (cancelado) return;
        setMovimientos(result);
        setSeleccionado(resolverSeleccionInicial(result));
      } catch (err) {
        if (cancelado) return;
        setErrorFetch(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [productoId, ubicacion]);

  // Tecla Escape → cerrar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ubicacionLabel =
    ubicacion.tipo === "bodega" ? `Bodega ${ubicacion.id}` : `Módulo ${ubicacion.id}`;

  // ── Submit handler ─────────────────────────────────────────────────
  const handleSubmit = useCallback(
    createAjusteSubmitHandler({
      crearAjusteFn: crearAjuste,
      getInput: () => ({
        movimientoOriginalId: seleccionado!,
        cantidadReal: Number(cantidadReal),
        observaciones: observaciones.trim() || undefined,
        idempotencyKey,
        usuarioId,
      }),
      isPending: () => enviando,
      setPending: setEnviando,
      onExito: () => { onSuccess(); onClose(); },
      onError: (msg) => setError(msg),
    }),
    [seleccionado, cantidadReal, observaciones, idempotencyKey, usuarioId, enviando, onSuccess, onClose],
  );

  // Validación local del input
  const cantidadParsed = parseCantidadReal(cantidadReal);
  const puedeEnviar = !enviando && seleccionado !== null && cantidadParsed.valido;

  // ── Render ─────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <Overlay onClose={onClose}>
        <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl">
          <p className="text-gray-500 text-center py-8">Cargando movimientos...</p>
        </div>
      </Overlay>
    );
  }

  if (errorFetch) {
    return (
      <Overlay onClose={onClose}>
        <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl">
          <p className="text-red-600 mb-4">{errorFetch}</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cerrar</button>
        </div>
      </Overlay>
    );
  }

  if (movimientos.length === 0) {
    return (
      <Overlay onClose={onClose}>
        <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl">
          <p className="text-gray-600 text-center py-4">
            No hay movimientos para corregir en {ubicacionLabel}
          </p>
          <div className="text-center">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cerrar</button>
          </div>
        </div>
      </Overlay>
    );
  }

  const seleccion = movimientos.find((m) => m.movimientoId === seleccionado);

  return (
    <Overlay onClose={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Corregir stock — {productoCodigo}
        </h2>
        <p className="text-sm text-gray-500 mb-4">{ubicacionLabel}</p>

        {/* Selección de movimiento (si hay varios) */}
        {movimientos.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm text-gray-700 mb-2">
              Seleccioná el movimiento a corregir:
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto border rounded">
              {movimientos.map((m) => (
                <label
                  key={m.movimientoId}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm ${
                    seleccionado === m.movimientoId
                      ? "bg-blue-50 border-l-2 border-blue-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="movimiento"
                      checked={seleccionado === m.movimientoId}
                      onChange={() => setSeleccionado(m.movimientoId)}
                      className="rounded"
                    />
                    <span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          m.tipo === "salida"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {m.tipo}
                      </span>
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="font-medium">
                    {m.cantidadNeta} →{" "}
                    <span className="text-gray-400">{m.cantidadOriginal} orig.</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Selección única: mostrar info del movimiento preseleccionado */}
        {movimientos.length === 1 && seleccion && (
          <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
            <span
              className={`text-xs px-1.5 py-0.5 rounded mr-2 ${
                seleccion.tipo === "salida"
                  ? "bg-red-100 text-red-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {seleccion.tipo}
            </span>
            <span className="text-gray-500">
              {new Date(seleccion.createdAt).toLocaleDateString()}
            </span>
            <span className="ml-2">
              Cantidad actual: <strong>{seleccion.cantidadNeta}</strong>
              {seleccion.cantidadNeta !== seleccion.cantidadOriginal && (
                <span className="text-gray-400 text-xs ml-1">
                  (original: {seleccion.cantidadOriginal})
                </span>
              )}
            </span>
          </div>
        )}

        {/* Formulario de cantidad real */}
        {seleccionado && (
          <>
            <div className="mb-3">
              <label className="block text-sm text-gray-700 mb-1">
                Cantidad real que llegó
              </label>
              <input
                type="number"
                value={cantidadReal}
                onChange={(e) => {
                  setCantidadReal(e.target.value);
                  setError(null);
                }}
                placeholder="Ej: 18"
                className="w-32 rounded border border-gray-300 px-3 py-2 text-sm"
                min={0}
                step={1}
                autoFocus
              />
              {!cantidadParsed.valido && cantidadReal !== "" && (
                <p className="text-red-600 text-xs mt-1">{cantidadParsed.error}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Opcional"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                disabled={enviando}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!puedeEnviar}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {enviando ? "Guardando..." : "Confirmar corrección"}
              </button>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}

// ── Overlay (interno, no exportado — YAGNI: extraer cuando haya un
//    segundo modal que lo necesite) ───────────────────────────────────

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
