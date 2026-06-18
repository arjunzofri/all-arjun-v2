# Feature Flags — app-arjun-v2

| Flag | Default | Control | Descripción |
|---|---|---|---|
| `syncComprasAnil` | `false` | `lib/flags.ts` | Sync automático de compras (5.1) |
| `buscadorHistorico` | `false` | `lib/flags.ts` | Autocompletado histórico (5.2) |
| `entradasManuales` | `false` | `lib/flags.ts` | Formulario de entradas manuales (5.4) |

## Puntos de control

- Cada flag envuelve su feature en: `if (!FLAGS.<flag>) return notFound()`
- Se activan en `lib/flags.ts` al completar el slice correspondiente
- Sin runtime toggle — para eso se migraría a DB si el caso lo requiere
