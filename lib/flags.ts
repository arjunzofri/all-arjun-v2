// ponytail: feature flags como constantes. Si hace falta runtime toggle
// con DB o cookies, se migra a clase con provider.

export const FLAGS = {
  /** Sync automático de compras Anil desde Vida Digital (5.1) */
  syncComprasAnil: false,

  /** Buscador histórico para ingreso manual (5.2) */
  buscadorHistorico: false,

  /** Formulario de entradas manuales (5.4) */
  entradasManuales: false,
} as const;
