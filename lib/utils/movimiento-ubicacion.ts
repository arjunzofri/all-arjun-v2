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

/**
 * Devuelve el efecto neto de un movimiento sobre una ubicación:
 *   +|cantidad| si la ubicación es el destino (entra stock)
 *   −|cantidad| si la ubicación es el origen (sale stock)
 *   0 en cualquier otro caso
 *
 * Delega en resolverOrigenDestino() — no duplica lógica de interpretación.
 */
export function efectoSobreUbicacion(
  movimiento: ResolverInput,
  ubicacion: Ubicacion,
): number {
  const { origen, destino } = resolverOrigenDestino(movimiento);
  const cantidadAbs = Math.abs(movimiento.cantidad);

  if (destino && destino.tipo === ubicacion.tipo && destino.id === ubicacion.id) {
    return cantidadAbs;
  }
  if (origen && origen.tipo === ubicacion.tipo && origen.id === ubicacion.id) {
    return -cantidadAbs;
  }
  return 0;
}

/**
 * Cantidad neta de un movimiento original + sus ajustes, desde la
 * perspectiva de una ubicación específica.
 *
 * Usa efectoSobreUbicacion() para cada movimiento — la dirección del
 * flujo (origen/destino) ya viene resuelta correctamente sin importar
 * si es salida, retorno o ajuste.
 */
export function calcularCantidadNeta(
  original: ResolverInput,
  ajustes: ResolverInput[],
  ubicacion: Ubicacion,
): number {
  const efectoOriginal = efectoSobreUbicacion(original, ubicacion);
  const efectoAjustes = ajustes.reduce(
    (sum, a) => sum + efectoSobreUbicacion(a, ubicacion),
    0,
  );
  return efectoOriginal + efectoAjustes;
}

/**
 * Calcula la cantidad del ajuste necesaria para corregir un movimiento
 * contribuyente desde su cantidad neta actual hacia la cantidad real
 * observada por el usuario.
 *
 * La asimetría de signo es consistente con el resto del módulo:
 *   - Destino módulo (caso salida): delta se usa directo.
 *     delta < 0 → ajuste con cantidad negativa → módulo es origen
 *     (se devuelve stock al origen). Coincide con efectoSobreUbicacion.
 *   - Destino bodega (caso retorno): delta se invierte.
 *     delta < 0 (llegó menos de lo registrado) → ajuste con cantidad
 *     positiva → bodega es origen (se devuelve stock al módulo).
 *     Es la misma inversión que resolverOrigenDestino ya maneja para
 *     retornos — ver BUGS.md #inversion-semantica-retornos.
 *
 * Lanza error si no hay diferencia (cantidadReal === cantidadNetaActual).
 * La validación de que el delta no exceda lo disponible la hace
 * crearAjuste() contra la DB, no esta función.
 */
export function calcularCantidadAjuste(
  destinoOriginal: Ubicacion,
  cantidadNetaActual: number,
  cantidadReal: number,
): number {
  const delta = cantidadReal - cantidadNetaActual;

  if (delta === 0) {
    throw new Error(
      "No hay diferencia que corregir: la cantidad ingresada coincide con la cantidad neta actual",
    );
  }

  // Destino bodega → signo invertido (misma asimetría que resolverOrigenDestino)
  return destinoOriginal.tipo === "bodega" ? -delta : delta;
}

/**
 * Calcula la corrección necesaria para una entrada manual (1 sola punta,
 * solo bodega, sin módulo involucrado). Solo se permite hacia abajo.
 *
 * No delega en calcularCantidadNeta ni efectoSobreUbicacion — esas funciones
 * modelan el flujo bodega↔módulo de 2 puntas que no aplica a entradas.
 *
 * @param cantidadOriginal  cantidad registrada originalmente en la entrada
 * @param cantidadReal      cantidad que realmente llegó (debe ser menor)
 * @param ajustesPrevios    cantidades de ajustes anteriores (negativas)
 * @returns delta positivo = stock a descontar de la bodega
 * @throws si cantidadReal >= cantidad neta actual (sin diferencia o hacia arriba)
 */
export function calcularCorreccionEntrada(
  cantidadOriginal: number,
  cantidadReal: number,
  ajustesPrevios: number[] = [],
): number {
  const netaActual =
    cantidadOriginal + ajustesPrevios.reduce((sum, a) => sum + a, 0);
  const delta = netaActual - cantidadReal;

  if (delta <= 0) {
    throw new Error(
      "Solo se permite corregir hacia abajo: cantidadReal debe ser menor que la cantidad neta actual",
    );
  }

  return delta;
}
