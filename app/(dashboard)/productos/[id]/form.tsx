"use client";

import { useState } from "react";
import { updateProducto } from "@/lib/actions/productos";

type Props = {
  producto: {
    id: number;
    codigoPersonal: string | null;
    packing: number | null;
    ubicacion: string | null;
    observaciones: string | null;
  };
};

export function EditarProductoForm({ producto }: Props) {
  const [codigoPersonal, setCp] = useState(producto.codigoPersonal ?? "");
  const [packing, setPacking] = useState(producto.packing?.toString() ?? "");
  const [ubicacion, setUbicacion] = useState(producto.ubicacion ?? "");
  const [observaciones, setObs] = useState(producto.observaciones ?? "");
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setOk("");
    try {
      await updateProducto(producto.id, {
        codigoPersonal: codigoPersonal || undefined,
        packing: packing ? parseInt(packing, 10) : undefined,
        ubicacion: ubicacion || undefined,
        observaciones: observaciones || undefined,
      });
      setOk("Guardado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      <input
        value={codigoPersonal}
        onChange={(e) => setCp(e.target.value)}
        placeholder="Codigo personal"
        className={inputClass}
      />
      <input
        type="number"
        value={packing}
        onChange={(e) => setPacking(e.target.value)}
        placeholder="Packing (unids/caja)"
        className={inputClass}
      />
      <input
        value={ubicacion}
        onChange={(e) => setUbicacion(e.target.value)}
        placeholder="Ubicacion"
        className={inputClass}
      />
      <textarea
        value={observaciones}
        onChange={(e) => setObs(e.target.value)}
        placeholder="Observaciones"
        rows={3}
        className={`${inputClass} resize-y`}
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-600">{error}</div>
      )}
      {ok && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-700">Cambios guardados correctamente</div>
      )}

      <button
        type="submit"
        className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
      >
        Guardar cambios
      </button>
    </form>
  );
}