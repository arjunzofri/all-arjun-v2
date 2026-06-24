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
    setError(""); setLoading(true);
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
    <div className="flex flex-col">
      {/* Preview */}
      <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
        {preview ? (
          <img src={preview} alt="Producto" className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}>
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="text-sm">Sin imagen</span>
          </div>
        )}
      </div>

      {/* Upload */}
      <label className={`flex items-center justify-center gap-2 py-3 border-t border-slate-100 text-sm cursor-pointer transition-colors ${
        loading
          ? "text-slate-400 bg-slate-50"
          : "text-slate-500 hover:text-violet-600 hover:bg-violet-50"
      }`}>
        {loading ? (
          <>
            <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/><path d="M21 12a9 9 0 00-9-9"/></svg>
            Subiendo...
          </>
        ) : (
          <>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {preview ? "Reemplazar imagen" : "Subir imagen"}
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          className="hidden"
          disabled={loading}
        />
      </label>

      {error && <p className="text-xs text-red-600 px-4 py-2 bg-red-50 border-t border-red-100">{error}</p>}
    </div>
  );
}