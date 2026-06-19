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
    setError("");
    setOk("");
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

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      <h2 className="text-lg font-semibold text-gray-900">Editar</h2>

      <input
        value={codigoPersonal}
        onChange={(e) => setCp(e.target.value)}
        placeholder="Código personal"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="number"
        value={packing}
        onChange={(e) => setPacking(e.target.value)}
        placeholder="Packing (unids/caja)"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        value={ubicacion}
        onChange={(e) => setUbicacion(e.target.value)}
        placeholder="Ubicación"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <textarea
        value={observaciones}
        onChange={(e) => setObs(e.target.value)}
        placeholder="Observaciones"
        rows={3}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-green-600">{ok}</p>}

      <button
        type="submit"
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Guardar cambios
      </button>
    </form>
  );
}
