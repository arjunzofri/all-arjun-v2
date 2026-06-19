"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

// ── Tipos ──────────────────────────────────────────────────────────────

type ProductoItem = {
  id: number;
  codigo: string;
  detalle: string | null;
  packing: number | null;
  ubicacion: string | null;
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

export function buildProductosUrl(q: string): string {
  if (!q) return "/productos";
  return `/productos?q=${encodeURIComponent(q)}`;
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

  // Carga inicial inmediata (sin debounce) — lee ?q= de la URL
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

  // ── JSX ────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Productos</h1>

      <div className="mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar código o descripción..."
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Código</th>
              <th className="py-2">Detalle</th>
              <th className="py-2">Pack</th>
              <th className="py-2">Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="py-2">
                  <Link
                    href={`/productos/${p.id}`}
                    className="font-medium text-gray-900 hover:underline"
                  >
                    {p.codigo}
                  </Link>
                </td>
                <td className="py-2 text-gray-600">
                  {p.detalle ?? "—"}
                </td>
                <td className="py-2 text-gray-500">
                  {p.packing ?? "—"}
                </td>
                <td className="py-2 text-gray-500">
                  {p.ubicacion ?? "—"}
                </td>
              </tr>
            ))}
            {!loading && !error && items.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-gray-400"
                >
                  Sin productos
                </td>
              </tr>
            )}
            {loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-gray-400"
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
            className="w-full rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingMore ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      )}
    </div>
  );
}
