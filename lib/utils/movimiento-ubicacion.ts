// NO tiene "use server" — función síncrona pura, exportada para test.

export type Ubicacion =
  | { tipo: "bodega"; id: number }
  | { tipo: "modulo"; id: number };

export type ResolverInput = {
  tipo: string;
  bodegaOrigenId: number | null;
  moduloDestinoId: number | null;
};

export type ResolverOutput = {
  origen: Ubicacion | null;
  destino: Ubicacion | null;
};

/**
 * Resuelve origen y destino reales de un movimiento a partir de las columnas
 * bodega_origen_id y modulo_destino_id, cuya semántica depende del tipo.
 *
 * REGLA: esta función es el ÚNICO punto de verdad para interpretar esas
 * columnas. Cualquier query o componente que necesite origen/destino de un
 * movimiento debe pasar por acá — nunca interpretar las columnas inline.
 */
export function resolverOrigenDestino(input: ResolverInput): ResolverOutput {
  const { tipo, bodegaOrigenId, moduloDestinoId } = input;

  if (tipo === "entrada") {
    return {
      origen: null,
      destino: bodegaOrigenId !== null ? { tipo: "bodega", id: bodegaOrigenId } : null,
    };
  }

  if (tipo === "salida") {
    return {
      origen: bodegaOrigenId !== null ? { tipo: "bodega", id: bodegaOrigenId } : null,
      destino: moduloDestinoId !== null ? { tipo: "modulo", id: moduloDestinoId } : null,
    };
  }

  if (tipo === "retorno") {
    // INVERTIDO A PROPÓSITO: en retornos, el INSERT invierte las columnas —
    // bodega_origen_id guarda el destino real (la bodega a donde vuelve) y
    // modulo_destino_id guarda el origen real (el módulo de donde sale).
    // Ver BUGS.md #inversion-semantica-retornos.
    return {
      origen: moduloDestinoId !== null ? { tipo: "modulo", id: moduloDestinoId } : null,
      destino: bodegaOrigenId !== null ? { tipo: "bodega", id: bodegaOrigenId } : null,
    };
  }

  throw new Error(`Tipo de movimiento desconocido: "${tipo}"`);
}
