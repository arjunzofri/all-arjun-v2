# Operación: sincronización automática de compras (cron-job.org)

Decisión de Pablo (2026-11-20, N4): automatizar con **cron-job.org (gratis)**. **No usar Vercel Cron si cuesta dinero** (no agregar crons en `vercel.json`).

## Qué hace
`POST /api/sync/compras-anil/cron` ejecuta la sincronización de compras **solo en modo inventario** (`inventario_bodega` encendido): importa catálogo, fotos y compras (costos, fechas, cantidades) al registro `compras_importadas`. **Nunca escribe stock, movimientos ni conteos**: el stock se ingresa solo por conteo físico (decisión N3).

Respuestas: `200` con `procesadas/insertadas/omitidas/pendientes/watermark`; `409` si otra corrida está en curso o el modo inventario está apagado (no ejecuta nada); `401` clave incorrecta; `503` si falta `CRON_SECRET`; `500` error (mensaje fijo, queda en el estado de compras del inicio).

## Pasos para activar (UAT, los hace Pablo)
1. **Producción (Neon):** aplicar en este orden `db/migrations/0003_compras_importadas.sql` y `db/migrations/0004_compras_importadas_item.sql` (idempotentes). Nunca `drizzle-kit push`.
2. **Vercel → Settings → Environment Variables (Production):** crear `CRON_SECRET` con un valor largo aleatorio (p. ej. 40+ caracteres). Redeploy.
3. **Activar el modo inventario** (`inventario_bodega: true`) solo cuando se decida el corte (UAT / Señal 3).
4. **cron-job.org → Create cronjob:**
   - URL: `https://<dominio-de-la-app>/api/sync/compras-anil/cron`
   - Método: **POST**
   - Header: `Authorization` = `Bearer <CRON_SECRET>` (nunca en la URL)
   - Frecuencia sugerida: cada 5 minutos durante la carga inicial; luego cada 15–30 minutos.
   - Activar notificación de fallos.
5. **Carga inicial:** el primer uso importa todo el histórico (~1.483 líneas medidas el 2026-11-20) en lotes de 100 con guarda de 8 s; cada corrida responde `pendientes:true` hasta terminar. También se puede avanzar con el botón **ACTUALIZAR** del inicio (encadena hasta 30 corridas).

## Verificar después de activar
- Inicio → sección **Compras**: “Última actualización” en hora de Chile y “Compras al” avanzando.
- Duración real por corrida en Vercel (logs). Medido desde el PC de Pablo contra TEST: ~13 s promedio, 37 s máximo. Si en Vercel supera ~25 s, avisar al Director (cron-job.org cortaría la espera a ~30 s según un directorio de terceros, no verificado en la documentación oficial).
- En TEST el backfill completo cuadró con Vida Digital: ver AUTO-LOG 2026-11-20.

## Desactivar
Pausar el job en cron-job.org, o apagar `inventario_bodega` (el endpoint responde 409 y no ejecuta nada).