"use client";

import { useState } from "react";

export function ImagenProducto({
  productoId,
  imagenUrl,
}: {
  productoId: number;
  imagenUrl: string | null;
}) {
  const [preview, setPreview] = useState(imagenUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("imagen", file);

      const res = await fetch(`/api/productos/${productoId}/imagen`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al subir");
      }

      const data = await res.json();
      setPreview(data.imagenUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="w-full aspect-square rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden mb-3">
        {preview ? (
          <img
            src={preview}
            alt="Producto"
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-gray-400 text-sm">Sin imagen</span>
        )}
      </div>

      <label className="block text-center cursor-pointer text-sm text-gray-600 hover:text-gray-900">
        {loading ? "Subiendo..." : preview ? "Reemplazar imagen" : "Subir imagen"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          className="hidden"
          disabled={loading}
        />
      </label>

      {error && <p className="text-sm text-red-600 mt-1 text-center">{error}</p>}
    </div>
  );
}
