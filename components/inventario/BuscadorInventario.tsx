"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";
import { createProductoSearch } from "@/components/useProductoSearch";
import { listarInventario, type FilaInventario } from "@/lib/inventario/consultas";

const MENSAJE_ERROR = "No se pudo buscar. Intente nuevamente.";
type Props = { items: FilaInventario[]; error: string | null; consultado: boolean; q: string; onElegir: () => void };

export function ListaResultados({ items, error, consultado, q, onElegir }: Props) {
  if (error) return <p role="alert" className="px-3 py-2 text-sm text-red-600">{error}</p>;
  if (!consultado) return null; if (!items.length) return <p className="px-3 py-2 text-sm text-slate-500">Sin coincidencias.</p>;
  return (
    <div aria-live="polite"><ul role="listbox" aria-label="Resultados de búsqueda" className="divide-y divide-slate-100">
      {items.slice(0, 12).map((p) => (
        <li key={p.id} role="presentation"><Link href={`/productos/${p.id}`} role="option" aria-selected="false" onClick={onElegir}
          className="flex min-w-0 items-start gap-3 px-3 py-2 hover:bg-violet-50 focus:bg-violet-50 focus:outline-none">
          <ProductoThumbnail src={p.imagenUrl} alt={p.codigo} size="sm" /><span className="min-w-0 flex-1">
            <span className="flex flex-wrap gap-x-2 text-sm font-medium text-slate-800">
              <span className="break-all">{p.codigo}</span>
              {p.codigoPersonal && <span className="break-all font-normal text-slate-500">{p.codigoPersonal}</span>}
            </span>
            {p.detalle && <span className="block break-words text-xs text-slate-600">{p.detalle}</span>}
            <span className="block text-xs font-medium text-violet-700">{p.stockContado === null ? "Sin contar" : `${p.stockContado} u.`}</span>
          </span>
        </Link></li>
      ))}
    </ul><Link href={`/inventario?q=${encodeURIComponent(q)}`} className="block border-t border-slate-100 px-3 py-2 text-center text-sm font-medium text-violet-700 hover:bg-violet-50">Ver todas las coincidencias</Link>
    </div>
  );
}

export default function BuscadorInventario({ grande = false }: { grande?: boolean }) {
  const router = useRouter();
  const id = useId(), listaId = `${id}-lista`;
  const [q, setQ] = useState(""); const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<FilaInventario[]>([]); const [error, setError] = useState<string | null>(null);
  const [consultado, setConsultado] = useState(false); const [buscando, setBuscando] = useState(false);
  const motor = useMemo(() => createProductoSearch<FilaInventario>({
    minLength: 1,
    fetchFn: async (texto) => (await listarInventario({ q: texto.trim(), limit: 12 })).items,
    onResults: (res) => { setItems(res); setError(null); setConsultado(true); setBuscando(false); },
    onError: () => { setItems([]); setError(MENSAJE_ERROR); setConsultado(true); setBuscando(false); },
  }), []);
  useEffect(() => () => motor.dispose(), [motor]);
  function cambiar(texto: string) {
    setQ(texto); setItems([]); setError(null); setConsultado(false); setAbierto(true);
    if (texto.trim() === "") { setBuscando(false); motor.dispose(); return; }
    setBuscando(true); motor.search(texto);
  }
  function elegir() {
    setAbierto(false); setQ(""); setItems([]); setError(null); setConsultado(false); setBuscando(false);
    motor.dispose();
  }
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // navegación interna: conserva la bodega en memoria aunque storage esté bloqueado
    const termino = q.trim();
    elegir();
    router.push(`/inventario?q=${encodeURIComponent(termino)}`);
  }
  const mostrarLista = abierto && (buscando || consultado || error !== null);
  return (
    <form action="/inventario" method="get" role="search" onSubmit={enviar}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false); }}
      className="relative flex w-full min-w-0 items-stretch gap-2">
      <label htmlFor={`${id}-q`} className="sr-only">Buscar producto por código, alias o descripción</label>
      <input id={`${id}-q`} name="q" type="search" role="combobox" aria-expanded={mostrarLista} aria-controls={listaId} aria-autocomplete="list" autoComplete="off" maxLength={100} value={q}
        onChange={(e) => cambiar(e.target.value)} onFocus={() => { if (consultado) setAbierto(true); }} onKeyDown={(e) => { if (e.key === "Escape") setAbierto(false); }}
        placeholder="Buscar por código, alias o descripción" className={`min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 ${grande ? "py-3 text-base" : "py-2 text-sm"}`} />
      <button type="submit" className="shrink-0 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700">Buscar</button>
      {mostrarLista && (
        <div id={listaId} className="absolute top-full z-20 mt-1 max-h-80 w-full min-w-0 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {buscando ? <p className="px-3 py-2 text-sm text-slate-500" aria-live="polite">Buscando…</p>
            : <ListaResultados items={items} error={error} consultado={consultado} q={q} onElegir={elegir} />}
        </div>
      )}
    </form>
  );
}
