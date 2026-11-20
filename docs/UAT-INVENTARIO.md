# UAT — Modo inventario de bodega (app Arjun v2)

Rama `feat/inventario-bodega` (sin push ni deploy). Estado al 2026-11-20: todo el backlog del PRD implementado, con QA aislado por slice y auditorías Señal 2 al día. Los flags siguen en `false` (`inventario_bodega`, `asignacion_bodega_compra`).

Esta guía es para Pablo: qué probar, qué decidir y qué pasos de producción quedan. Nada de lo de abajo se ejecuta sin tu respuesta.

## 1. Cómo probar

Opción A (recomendada, sin tocar producción): en tu PC, entorno TEST, con el modo encendido solo para la prueba:

```powershell
cd C:\Users\pablo\Documents\app-arjun-v2\app-arjun-v2
$env:FEATURE_INVENTARIO_BODEGA='true'   # opcional: $env:FEATURE_ASIGNACION_BODEGA_COMPRA='true'
& "$HOME\.claude\pbravot\qa-entorno.ps1" -Repo (Get-Location).Path -Accion levantar
# abrir http://localhost:3123 ; al terminar:
& "$HOME\.claude\pbravot\qa-entorno.ps1" -Repo (Get-Location).Path -Accion detener
```

Opción B: preview de Vercel. Requiere push de la rama (gate tuyo) y variables de TEST en el preview.

Cuentas: las sintéticas de TEST (qa-admin, qa-operador) o las tuyas en TEST.

## 2. Qué revisar (criterios del PRD)

| # | Flujo | Qué deberías ver |
|---|---|---|
| R1 | Buscar desde el inicio y desde una ficha | El buscador grande abre la ficha; desde la ficha se busca y abre otra sin volver a la lista |
| R2 | Conteo por posición | Cantidad absoluta (0 permitido), usuario y hora automáticos, historial; otra bodega queda intacta |
| R3 | Dos personas contando la misma posición | Aviso de conflicto, sin sobrescritura silenciosa |
| R4 | Bodega de trabajo | Se elige una vez y se recuerda en las siguientes fichas; planta/pasillo/posición siempre manuales |
| R5 | Compras (ACTUALIZAR en el inicio) | Importa catálogo, fotos y compras sin tocar conteos; sección “Compras” en el inicio y desplegable “Compras” en la ficha |
| R6 | Inversión (admin) | En Inventario, “Mostrar valores”: Costo prom. y Valor tras Stock y total “Inversión según últimos conteos”; en la ficha, desglose por lote con “Saldo”; nunca usa compras posteriores al conteo; avisa unidades sin costo |
| R7 | Celular vertical | Lista, ficha, compras e historial sin scroll lateral |
| R8 | Permisos | El operador nunca ve costos ni Usuarios; identificar por foto, editar ficha y crear producto siguen disponibles |
| R9 | Apagado reversible | Entradas, Salidas, Movimientos, Bodegas, Módulos e Inversión antigua redirigen a Inventario con el modo encendido; con el modo apagado todo sigue como hoy |
| CA12 | Volver desde la ficha | Vuelve a la misma búsqueda, página y “Mostrar valores” |
| — | Fotos | Una foto grande del celular (más de 4.5 MB) se reduce sola antes de subir |

## 3. Decisiones que necesito de ti

1. **Contraseña mínima** para usuarios nuevos: hoy acepta 1 carácter (comportamiento anterior). ¿Fijamos 8?
2. **Correcciones de compras en Vida Digital**: hoy el registro guarda el costo de la primera importación; una corrección posterior en VD no se refleja. ¿Está bien así?
3. **ACTUALIZAR compras**: hoy lo puede usar cualquier usuario con sesión. ¿Solo admin?
4. **Sugerencia de bodega desde compras** (GLP/GL2 → Bodega 1, GL1 → Bodega 2): implementada, apagada. ¿La encendemos en producción?
5. **Buscar otro producto desde una ficha**: al volver, la lista usa el término nuevo (no el anterior). ¿Correcto?
6. **Vaciar alias/packing/observaciones**: hoy un campo vacío significa “no cambiar”. ¿Se necesita poder borrarlos?
7. **Reinicio de datos al entregar (R21)**: definir el alcance exacto (qué tablas) antes del corte; yo preparo respaldo y lista.

## 4. Pasos de producción (cada uno requiere tu OK)

1. Aplicar en Neon producción `db/migrations/0003_compras_importadas.sql` y luego `0004_compras_importadas_item.sql` (nunca `drizzle-kit push`). Antes de encender: `SELECT count(*) FROM compras_importadas WHERE item IS NULL` debe dar 0.
2. Crear `CRON_SECRET` en Vercel (Production) y programar cron-job.org según `docs/OPERACION-CRON-COMPRAS.md` (gratis; sin Vercel Cron).
3. Push de la rama y deploy con los flags en `false` (sin cambio visible).
4. Señal 3: auditoría final, smoke E2E, build sin warnings, diferencia de variables prod vs dev, regresión QA completa.
5. Corte: encender `inventario_bodega`, cambiar el humo de producción por `docs/humo-prod-on.json` y correr `qa-prod.ps1`.

## 5. Riesgos conocidos (detalle en BUGS.md)

- Duración del sync de compras en Vercel: medido desde tu PC 13 s promedio y 37 s máximo; cron-job.org corta cerca de 30 s. En uso diario son pocas líneas (unos 7 s).
- Valorización de la lista: unos 770 ms desde tu PC; en Vercel debería ser menor.
- Imágenes de prueba inexistentes en Cloudinary muestran la miniatura vacía (sin marcador).
- En modo apagado, las lecturas antiguas siguen sin validar sesión dentro de la acción (las protege el proxy, como hasta ahora).
