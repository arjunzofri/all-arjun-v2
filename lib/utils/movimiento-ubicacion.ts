// NO tiene "use server" — función síncrona pura, exportada para test.

export type Ubicacion =
  | { tipo: "bodega"; id: number }
  | { tipo: "modulo"; id: number };

export type ResolverInput = {
  tipo: string;
  bodegaOrigenId: number | null;
  moduloDestinoId: number | null;
  cantidad: number;
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
  const { tipo, bodegaOrigenId, moduloDestinoId, cantidad } = input;

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

  if (tipo === "ajuste") {
    // DIRECCIÓN POR SIGNO DE CANTIDAD, no por nombres de columna.
    // bodegaOrigenId y moduloDestinoId identifican las ubicaciones involucradas
    // (posicional), pero la dirección real del flujo la determina el signo:
    //   cantidad > 0  → bodega es origen, módulo es destino
    //                    (llegó MÁS de lo registrado, se descuenta de la bodega)
    //   cantidad < 0  → módulo es origen, bodega es destino
    //                    (llegó MENOS, se devuelve la diferencia a la bodega)
    //   cantidad === 0 → sin movimiento real; prevención en crearAjuste (Zod),
    //                    no acá. Si aun así llega, devolvemos null en ambas puntas.
    if (cantidad > 0) {
      return {
        origen: bodegaOrigenId !== null ? { tipo: "bodega", id: bodegaOrigenId } : null,
        destino: moduloDestinoId !== null ? { tipo: "modulo", id: moduloDestinoId } : null,
      };
    }
    if (cantidad < 0) {
      return {
        origen: moduloDestinoId !== null ? { tipo: "modulo", id: moduloDestinoId } : null,
        destino: bodegaOrigenId !== null ? { tipo: "bodega", id: bodegaOrigenId } : null,
      };
    }
    // cantidad === 0
    return { origen: null, destino: null };
  }

  throw new Error(`Tipo de movimiento desconocido: "${tipo}"`);
}
