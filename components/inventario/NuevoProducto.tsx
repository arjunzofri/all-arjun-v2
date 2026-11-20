"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearProductoManual } from "@/lib/actions/productos";
import { createProductoSearch } from "@/components/useProductoSearch";

export type Campos = { codigo: string; detalle: string; packing: string };
type Entrada = { codigo: string; detalle?: string; packing?: number };
type Resultado = { ok: true; id: number } | { ok: false; error: string };
export const MENSAJE_FIJO = "No se pudo crear el producto. Intente nuevamente.";
export function prepararCreacion(c: Campos): { ok: true; data: Entrada } | { ok: false; error: string } {
  const codigo = c.codigo.trim();
  if (!codigo) return { ok: false, error: "Código requerido" };
  if (codigo.length > 30) return { ok: false, error: "El código no puede superar 30 caracteres" };
  const texto = c.packing.trim();
  const packing = texto === "" ? undefined : Number(texto);
  if (packing !== undefined && (!/^\d+$/.test(texto) || !Number.isSafeInteger(packing))) {
    return { ok: false, error: "El packing debe ser un entero mayor o igual que 0" };
  }
  const detalle = c.detalle.trim();
  return { ok: true, data: { codigo, ...(detalle ? { detalle } : {}), ...(packing === undefined ? {} : { packing }) } };
}
// Cerrojo de doble clic: siempre se libera, incluso si la accion rechaza.
export function crearEnvio(accion: (i: Entrada) => Promise<Resultado>) {
  let ocupado = false;
  return {
    async ejecutar(c: Campos): Promise<Resultado | null> {
      if (ocupado) return null;
      ocupado = true;
      try {
        const p = prepararCreacion(c);
        if (!p.ok) return p;
        const r = await accion(p.data);
        return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error };
      } catch {
        return { ok: false, error: MENSAJE_FIJO };
      } finally {
        ocupado = false;
      }
    },
  };
}
type Sugerencia = { codigo: string; detalle: string | null; imagenUrl: string | null; packing: number | null };
const campo = "mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm";
export default function NuevoProducto({ codigoInicial = "" }: { codigoInicial?: string }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(codigoInicial);
  const [detalle, setDetalle] = useState("");
  const [packing, setPacking] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const envio = useRef(crearEnvio(crearProductoManual)).current;
  const buscador = useMemo(() => createProductoSearch<Sugerencia>({
    fetchFn: async (q) => (await fetch(`/api/productos/buscar-historico?q=${encodeURIComponent(q)}`)).json(),
    onResults: setSugerencias,
  }), []);
  useEffect(() => () => buscador.dispose(), [buscador]);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const r = await envio.ejecutar({ codigo, detalle, packing });
      if (r === null) return;
      if (r.ok) router.push(`/productos/${r.id}`);
      else setError(r.error);
    } finally {
      setEnviando(false);
    }
  }
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Crear producto</h1>
      <form onSubmit={enviar} noValidate className="space-y-4">
        <label className="block text-sm font-semibold text-slate-700">Código
          <input value={codigo} maxLength={30} required className={campo}
            onChange={(e) => { setCodigo(e.target.value); buscador.search(e.target.value.trim()); }} />
        </label>
        {sugerencias.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {sugerencias.map((s) => (
              <li key={s.codigo}><button type="button" className="w-full break-words px-3 py-2 text-left hover:bg-violet-50"
                onClick={() => { setCodigo(s.codigo); setDetalle(s.detalle ?? ""); setPacking(s.packing === null ? "" : String(s.packing)); setSugerencias([]); }}>
                {s.codigo}{s.detalle ? ` — ${s.detalle}` : ""}
              </button></li>
            ))}
          </ul>
        )}
        <label className="block text-sm font-semibold text-slate-700">Detalle
          <input value={detalle} className={campo} onChange={(e) => setDetalle(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">Packing
          <input value={packing} inputMode="numeric" className={campo} onChange={(e) => setPacking(e.target.value)} />
        </label>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={enviando} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">Crear producto</button>
      </form>
    </div>
  );
}
