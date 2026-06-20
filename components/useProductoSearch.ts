// ── Lógica pura de búsqueda con debounce (exportada para test sin jsdom) ──

type SugerenciaBase = { codigo: string; detalle: string | null; imagenUrl: string | null };

type ProductoSearchConfig<T extends SugerenciaBase = SugerenciaBase> = {
  fetchFn: (q: string) => Promise<unknown>;
  onResults: (items: T[]) => void;
  guard?: () => boolean;
  minLength?: number;
  debounceMs?: number;
};

// Normaliza los dos formatos de respuesta sin any:
// - array directo (buscar-historico)
// - { items: [...] } (por-bodega)
function normalizeResponse<T extends SugerenciaBase>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray((data as { items: unknown }).items)
  ) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export function createProductoSearch<T extends SugerenciaBase = SugerenciaBase>(
  config: ProductoSearchConfig<T>,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;
  let latestId = 0;

  const minLen = config.minLength ?? 2;
  const ms = config.debounceMs ?? 250;
  const guardFn = config.guard ?? (() => true);

  return {
    search(q: string) {
      clearTimeout(timer);
      controller?.abort();
      const id = ++latestId;

      if (q.length < minLen || !guardFn()) {
        config.onResults([]);
        return;
      }

      timer = setTimeout(async () => {
        const currentController = new AbortController();
        controller = currentController;
        try {
          const raw = await config.fetchFn(q);
          if (id !== latestId) return;
          config.onResults(normalizeResponse(raw));
        } catch {
          if (id !== latestId) return;
          config.onResults([]);
        }
      }, ms);
    },

    dispose() {
      clearTimeout(timer);
      controller?.abort();
    },
  };
}
