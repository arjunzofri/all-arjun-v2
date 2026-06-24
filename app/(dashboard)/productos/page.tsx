"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";

// ── Tipos ──────────────────────────────────────────────────────────────

type StockUbicacion = { id: number; nombre: string; cantidad: number };

type ProductoItem = {
  id: number;
  codigo: string;
  detalle: string | null;
  imagenUrl: string | null;
  packing: number | null;
  ubicacion: string | null;
  stockBodegas: StockUbicacion[];
  stockModulos: StockUbicacion[];
};

type ProductoResponse = { items: ProductoItem[]; nextCursor: number | null };

type SearchConfig = {
  fetchFn: (q: string, signal: AbortSignal) => Promise<ProductoResponse>;
  onResults: (items: ProductoItem[], nextCursor: number | null) => void;
  onError: (error: Error) => void;
  onLoading: (loading: boolean) => void;
  debounceMs: number;
};

// ── Lógica pura de búsqueda (exportada para test sin jsdom) ────────────

export function createProductSearch(config: SearchConfig) {
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latestId = 0;

  return {
    search(q: string) {
      clearTimeout(timer);
      controller?.abort();
      const id = ++latestId;

      timer = setTimeout(async () => {
        const currentController = new AbortController();
        controller = currentController;
        config.onLoading(true);
        try {
          const result = await config.fetchFn(q, currentController.signal);
          if (id !== latestId) return;
          config.onResults(result.items, result.nextCursor);
        } catch (err) {
          if (id !== latestId) return;
          if (
            err instanceof DOMException &&
            err.name === "AbortError"
          ) {
            return;
          }
          config.onError(
            err instanceof Error ? err : new Error(String(err)),
          );
        } finally {
          if (id === latestId) {
            config.onLoading(false);
          }
        }
      }, config.debounceMs);
    },

    dispose() {
      clearTimeout(timer);
      controller?.abort();
    },
  };
}

// ── Lógica pura de "Cargar más" (exportada para test sin jsdom) ──────────

type LoadMoreConfig = {
  fetchFn: (q: string, cursor: number) => Promise<ProductoResponse>;
  getQ: () => string;
  getNextCursor: () => number | null;
  isPending: () => boolean;
  setPending: (v: boolean) => void;
  onResults: (items: ProductoItem[], nextCursor: number | null) => void;
  onError: (error: Error) => void;
};

export function createLoadMoreHandler(config: LoadMoreConfig) {
  return async () => {
    const cursor = config.getNextCursor();
    if (!cursor || config.isPending()) return;
    config.setPending(true);
    try {
      const data = await config.fetchFn(config.getQ(), cursor);
      config.onResults(data.items, data.nextCursor);
    } catch (err) {
      config.onError(
        err instanceof Error ? err : new Error(String(err)),
      );
    } finally {
      config.setPending(false);
    }
  };
}

// ── Helper de fetch (compartido entre carga inicial, search y Cargar más) ──

async function fetchProductos(
  query: string,
  signal?: AbortSignal,
  cursor?: number,
): Promise<ProductoResponse> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("limit", "20");
  if (cursor) params.set("cursor", String(cursor));
  const res = await fetch(
    `/api/productos?${params.toString()}`,
    signal ? { signal } : undefined,
  );
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── URL builder (exportado para test sin jsdom) ───────────────────────

// ── Sync handler (mismo patrón que createLogoutHandler) ──────────────────

export function createSyncHandler(config: {
  syncFn: () => Promise<{ procesadas: number; watermark: string }>;
  isPending: () => boolean;
  setPending: (v: boolean) => void;
  onResult: (result: { procesadas: number; watermark: string }) => void;
  onError: (mensaje: string) => void;
}) {
  return async () => {
    if (config.isPending()) return;
    config.setPending(true);
    try {
      const result = await config.syncFn();
      config.onResult(result);
    } catch (err) {
      config.onError(err instanceof Error ? err.message : String(err));
    } finally {
      config.setPending(false);
    }
  };
}

export function buildProductosUrl(q: string): string {
  if (!q) return "/productos";
  return `/productos?q=${encodeURIComponent(q)}`;
}

// Link al detalle con refQ para preservar el filtro al volver
export function buildProductoDetailHref(id: number, q: string): string {
  if (!q) return `/productos/${id}`;
  return `/productos/${id}?refQ=${encodeURIComponent(q)}`;
}

// Aplica la URL inicial — siempre, incluso si urlQ es "" (limpia ?q= residual)
export function applyInitialUrlSync(
  urlQ: string,
  replace: (url: string) => void,
): void {
  replace(buildProductosUrl(urlQ));
}

// ── Componente de página ───────────────────────────────────────────────

export default function ProductosPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductoItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [syncResultado, setSyncResultado] = useState<{ procesadas: number; watermark: string } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const searchRef = useRef<ReturnType<typeof createProductSearch> | undefined>(undefined);
  const initialDone = useRef(false);

  // Inicialización perezosa del search controller (una sola vez)
  if (!searchRef.current) {
    searchRef.current = createProductSearch({
      fetchFn: (query, signal) => fetchProductos(query, signal),
      onResults: (newItems, cursor) => {
        setItems(newItems);
        setNextCursor(cursor);
        setError(null);
      },
      onError: (err) => setError(err.message),
      onLoading: setLoading,
      debounceMs: 250,
    });
  }

  // Carga inicial inmediata (sin debounce) — lee ?q= de la URL.
  //
  // initialQApplied previene un fetch duplicado: cuando la URL trae ?q=,
  // la carga inicial setea q → el useEffect([q]) vuelve a disparar → search(q)
  // ejecutaría el mismo fetch otra vez. Este flag bloquea esa segunda llamada
  // exactamente una vez. NO es removible sin rediseñar el flujo completo de
  // carga inicial + búsqueda (se evaluó en ponytail-review, Grupo 1).
  const initialQApplied = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // window siempre existe en useEffect (cliente post-hydratación)
    const urlQ =
      new URLSearchParams(window.location.search).get("q") ?? "";

    (async () => {
      setLoading(true);
      try {
        const data = await fetchProductos(urlQ, controller.signal);
        if (cancelled) return;
        setItems(data.items);
        setNextCursor(data.nextCursor);
        setError(null);
        if (urlQ) {
          setQ(urlQ);
          initialQApplied.current = true;
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          initialDone.current = true;
          applyInitialUrlSync(urlQ, router.replace);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Búsqueda con debounce al cambiar q (solo después de carga inicial)
  useEffect(() => {
    if (!initialDone.current) return;
    // La carga inicial ya aplicó el q de la URL — no re-disparar
    if (initialQApplied.current) {
      initialQApplied.current = false;
      return;
    }
    searchRef.current?.search(q);
    router.replace(buildProductosUrl(q));
  }, [q, router]);

  // "Cargar más" — append con cursor, sin reemplazo
  const handleLoadMore = createLoadMoreHandler({
    fetchFn: (query, cursor) => fetchProductos(query, undefined, cursor),
    getQ: () => q,
    getNextCursor: () => nextCursor,
    isPending: () => loadingMore,
    setPending: setLoadingMore,
    onResults: (newItems, cursor) => {
      setItems((prev) => [...prev, ...newItems]);
      setNextCursor(cursor);
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  // Cleanup al desmontar
  useEffect(() => {
    return () => searchRef.current?.dispose();
  }, []);

  // ── Sync handler ───────────────────────────────────────────────────

  const handleSync = useCallback(
    createSyncHandler({
      syncFn: async () => {
        const res = await fetch("/api/sync/compras-anil", { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Error ${res.status}`);
        }
        return res.json();
      },
      isPending: () => syncPending,
      setPending: setSyncPending,
      onResult: (result) => {
        setSyncResultado(result);
        setSyncError(null);
        searchRef.current?.search(q);
      },
      onError: (msg) => {
        setSyncError(msg);
        setSyncResultado(null);
      },
    }),
    [syncPending, q],
  );

  // ── JSX ────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
        <button
          onClick={handleSync}
          disabled={syncPending}
          className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {syncPending ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      {syncResultado && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {syncResultado.procesadas} compras procesadas. Watermark:{" "}
          {syncResultado.watermark}
        </div>
      )}

      {syncError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {syncError}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar código o descripción..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="py-3 pl-4 pr-2 w-10"></th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Código</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Detalle</th>
              <th className="py-3 px-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">Pack</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-44">Bodegas</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Módulos</th>
              <th className="py-3 pl-3 pr-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Ubic.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-2 pl-4 pr-2">
                  <ProductoThumbnail src={p.imagenUrl} alt={p.codigo} size="sm" />
                </td>
                <td className="py-2 px-3">
                  <Link
                    href={buildProductoDetailHref(p.id, q)}
                    className="font-semibold text-violet-600 hover:text-violet-800 hover:underline text-xs"
                  >
                    {p.codigo}
                  </Link>
                </td>
                <td className="py-2 px-3 text-slate-600 max-w-xs">
                  <span className="line-clamp-2 leading-snug">{p.detalle ?? "—"}</span>
                </td>
                <td className="py-2 px-3 text-center text-slate-500 tabular-nums">
                  {p.packing ?? "—"}
                </td>
                <td className="py-2 px-3">
                  {p.stockBodegas.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {p.stockBodegas.map((s) => (
                        <span key={s.id} className="text-xs text-slate-600 whitespace-nowrap">
                          <span className="font-medium text-slate-700">{s.cantidad}</span>
                          <span className="text-slate-400"> uds</span>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-2 px-3">
                  {p.stockModulos.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {p.stockModulos.map((s) => (
                        <span key={s.id} className="text-xs text-slate-600 whitespace-nowrap">
                          <span className="font-medium text-slate-700">{s.cantidad}</span>
                          <span className="text-slate-400"> uds · {s.nombre}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-2 pl-3 pr-4 text-slate-500 text-xs">
                  {p.ubicacion ?? "—"}
                </td>
              </tr>
            ))}
            {!loading && !error && items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-12 text-center text-slate-400 text-sm"
                >
                  Sin productos
                </td>
              </tr>
            )}
            {loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-12 text-center text-slate-400 text-sm"
                >
                  Cargando...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:border-violet-300 transition-colors disabled:opacity-50"
          >
            {loadingMore ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      )}
    </div>
  );
}


