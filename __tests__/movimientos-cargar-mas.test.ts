/**
 * Bug P-20261110-2158-2: "Cargar mas" en /movimientos repite filas.
 * El cursor se leia del estado dentro de un useCallback (closure del render
 * anterior), asi que el segundo pedido volvia a la primera pagina.
 *
 * El repo no tiene setup de tests de componentes (RTL + jsdom), asi que se
 * extrae la construccion de parametros a `lib/utils/paginacion.ts` y se
 * prueba esa funcion con el flujo de dos paginas.
 */

import { describe, it, expect } from "vitest";
import { parametrosPagina } from "@/lib/utils/paginacion";

type Fila = { id: number };

const FILTROS = { tipo: "todas", desde: "", hasta: "" };

const pagina1: { items: Fila[]; nextCursor: number | null } = {
  items: Array.from({ length: 20 }, (_, i) => ({ id: i + 1 })),
  nextCursor: 20,
};
const pagina2: { items: Fila[]; nextCursor: number | null } = {
  items: Array.from({ length: 20 }, (_, i) => ({ id: i + 21 })),
  nextCursor: null,
};

describe("parametrosPagina() — cargar mas", () => {
  it("la primera pagina no envia cursor", () => {
    expect(parametrosPagina(FILTROS, undefined)).toEqual({
      tipo: undefined,
      desde: undefined,
      hasta: undefined,
      limit: 20,
      cursor: undefined,
    });
  });

  it("cargar mas pide el cursor de la pagina anterior y no repite filas", async () => {
    const cursoresRecibidos: (number | undefined)[] = [];
    const fetchPage = async (cursor?: number) => {
      cursoresRecibidos.push(cursor);
      return cursor === undefined ? pagina1 : pagina2;
    };

    const primera = await fetchPage(parametrosPagina(FILTROS, undefined).cursor);
    const segunda = await fetchPage(
      parametrosPagina(FILTROS, primera.nextCursor).cursor
    );

    expect(cursoresRecibidos).toEqual([undefined, 20]);

    const filas = [...primera.items, ...segunda.items];
    expect(filas).toHaveLength(40);
    expect(new Set(filas.map((f) => f.id)).size).toBe(40);
  });

  it("respeta los filtros activos", () => {
    expect(
      parametrosPagina({ tipo: "salida", desde: "2026-01-01", hasta: "2026-02-01" }, null)
    ).toEqual({
      tipo: "salida",
      desde: "2026-01-01",
      hasta: "2026-02-01",
      limit: 20,
      cursor: undefined,
    });
  });
});
