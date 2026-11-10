# CONTEXT-CLAUDE-CHAT.md — app-arjun-v2

Pegar este documento al inicio de una conversación con Claude (Director
Técnico) cuando se necesite tomar decisiones de arquitectura, diseñar un
nuevo slice, o resolver un problema que excede el alcance de un ciclo
PBT-IA en Claude Code.

---

## Qué es este proyecto

App Arjun v2 — reconstrucción completa del sistema de inventario de Anil
Chandnani Import Export EIRL (Mall Zofri, Iquique). Reemplaza a la v1
(`app-arjun`), que fue descontinuada por duplicación crónica de stock
causada por un sync mal diseñado contra WinFac Arjun directo
(`arjun.inv_sdo`).

**Repos y proyectos — todo separado de la v1, sin overlap:**
- Repo: `app-arjun-v2` (local: `C:\Users\pablo\Documents\app-arjun-v2`)
- Vercel: proyecto nuevo `app-arjun-v2`
- Neon: base de datos propia, nueva, sin relación con la base de la v1

## Por qué existe la v2 (causa raíz del problema en v1)

1. El sync de v1 leía `arjun.inv_sdo` (réplica WinFac de Arjun) y asignaba
   bodega con lógica que en algún punto quedó hardcodeada a "Bodega Arjun"
   para todo, ignorando el vendedor real.
2. Se corrigió el routing por vendedor, pero el sync seguía duplicando
   stock por errores de cálculo de delta y por reprocesamientos manuales
   que no usaban la misma lógica que el sync principal.
3. Tras múltiples ciclos de fix-sobre-fix, se decidió abandonar
   `arjun.inv_sdo` como fuente y leer en su lugar **directamente la base
   de Vida Digital**, que ya tiene los datos de compras de Anil
   consolidados y correctos (usada en producción por la app
   `inventario-arjun` sin estos problemas).

## Arquitectura de datos — verificada con queries reales, no asumida

Existe una base Neon llamada "Vida Digital" que NO es de App Arjun. Es
externa, compartida, de **solo lectura** para nosotros. Contiene:

- **Schema `vida`**: réplica raw de WinFac Vida Digital
  (`itemdcto`, `movidcto`, `inventar`, etc.)
- **Schema `sanjh`**: réplica raw de WinFac Sanjh/San Jorge — misma
  estructura de columnas que `vida` en `itemdcto`/`movidcto`
- **Schema `public`**: capa procesada por la app Vida Digital, que unifica
  productos de ambas empresas:
  - `public.productos` (empresa_id=1 → Sanjh, empresa_id=2 → Vida Digital)
    con `saldo`, `cantcaja` (packing), `detalle` (descripción),
    `nroingreso`
  - `public.ubicaciones_bodega` con conteo físico y ubicación interna

### Cómo se identifican las compras de Anil

```sql
-- En vida.movidcto Y en sanjh.movidcto (mismo filtro en ambos)
WHERE tipomovi = 'V'
  AND kcodcli2 IN (2, 20, 218)   -- los 3 códigos de cliente de Anil
```

Cruzando `itemdcto.codunico` con `movidcto.knumfoli`, y luego con
`public.productos.codigo` para traer metadata.

### Cómo se determina la bodega de destino

El 5° segmento (separado por `-`) de `nroingreso` (en `public.productos`)
o `knumezet` (en `vida.itemdcto`/`sanjh.itemdcto`) indica el código de
bodega origen:

| Código | Sistema origen | Bodega destino en App Arjun v2 |
|---|---|---|
| `GLP` | Vida Digital | Bodega 1 Vida Digital |
| `GL1` | Vida Digital | Bodega 2 Vida Digital |
| `GL2` | Sanjh | Bodega 1 Vida Digital (administrativo, sin bodega física propia, confirmado con Pablo) |

Anil compra activamente a ambos proveedores hasta la fecha actual — no es
un caso histórico cerrado, ambos siguen con movimiento.

### Fecha de corte para el sync automático

**Solo se sincronizan automáticamente compras con `fechanvt >= '2026-06-01'`.**//
Todo lo anterior a esa fecha no entra por el sync — si hay mercadería física
de compras más antiguas que necesita regularizarse en el inventario, se
ingresa manualmente usando el buscador histórico (que sí busca en todo el
histórico sin filtro de fecha, pero solo trae código/descripción/imagen,
nunca cantidad).

## Decisiones de diseño ya tomadas (no reabrir sin nueva evidencia)

- Kingnex/OCR: descartado completamente, no entra en ningún MVP.
- GL2 no es una bodega física — confirmado con Pablo, se consolida en
  Bodega 1 Vida Digital.
- Sanjh no tiene tabla de productos usable (`sanjh.producto` es catálogo
  de vehículos/maquinaria sin saldo/packing) — la metadata para productos
  de Sanjh viene igual de `public.productos` (empresa_id=1), que ya está
  sincronizada desde `sanjh.inventar` por la app Vida Digital.
- No se migran datos históricos de stock de la v1. App Arjun v2 arranca en
  cero; el stock real se reconstruye vía sync (desde 1 junio 2026) +
  ingresos manuales para lo anterior.

## Estado del backlog (actualizado 2026-06-19)

| Slice | Commit | PRD | Descripción | Estado |
|---|---|---|---|---|
| 01 | `877a5f5` | 5.9 | Scaffold: Next.js 16, Drizzle schema (7 tablas), NextAuth v5, proxy.ts, Inter font, env vars, vitest setup | ✅ Completo |
| 02 | `0c43c1f` | 5.1, 5.2 | Queries Vida Digital: `getComprasAnilDesde()`, `buscarProductoHistorico()`, `getBodegaPorCodigoIngreso()` | ✅ Completo |
| 03 | `f4527c0` | 5.1 | Sync automático: `syncComprasAnil()`, CTE atómica, idempotencia UNIQUE, watermark, endpoint con CRON_SECRET | ✅ Completo |
| 04 | `2decdf8` | 5.2, 5.3 | API productos: GET paginado, GET ficha + historial, PATCH editar + auditoría, GET buscar-historico, Zod | ✅ Completo |
| 05 | `b143b1f` | 5.4 | Entradas manuales: `crearEntrada()` con CTE atómica, idempotencyKey, página `/entradas` | ✅ Completo |
| 06 | `5c01ab1` | 5.9 | Usuarios: UI `/usuarios`, autorización por rol, crear/editar usuarios, login con bcrypt | ✅ Completo |
| 07 | `13eebd7` | 5.5 | Salidas (Bodega → Módulo): descuento + incremento atómico en CTE, idempotencia, página `/salidas` | ✅ Completo |
| 08 | `c2320ce` | 5.6 | Retornos (Módulo → Bodega): operación inversa a salida, misma CTE atómica, página `/retornos` | ✅ Completo |
| 09 | `cb089cc` | 5.7 | Vistas `/bodegas`, `/modulos`: listado paginado con cursor, filtro "solo con stock", ubicaciónId dinámico | ✅ Completo |
| 10 | `80bcb9d` | 5.3 | UI productos: página `/productos`, ficha detalle, imágenes Cloudinary, editar producto | ✅ Completo |
| 11 | `3bf5993` | 5.8 | Historial global de movimientos: `/movimientos` con filtros por tipo, fecha, bodega | ✅ Completo |
| 12 | `c342e96` | 5.9 | Auth desde cero: username + password, DrizzleAdapter eliminado, JWT session strategy | ✅ Completo |
| — | `a42b51f` | — | Fix: eliminar tests flaky, aislar suites | ✅ Completo |
| — | `997eacd`…`7cc785b` | — | Ponytail-review Grupos 1-4: eliminar código muerto, refactors internos, unificar queries, mover constantes | ✅ Completo |
| — | `758b257` | — | UX: botón de logout en sidebar con SVG inline | ✅ Completo |
| — | `aac54aa`…`bdaaeed` | — | `/productos`: búsqueda en vivo con debounce + paginación "Cargar más" | ✅ Completo |
| — | `af1d5ef`…`69f165f` | — | `UbicacionDetalle`: debounce 250ms en buscador + error handling en `cargar()` | ✅ Completo |
| — | `9c79918`…`d4f3105` | — | `/productos`: persistencia de búsqueda en URL (`?q=`) + botón "Volver" preserva filtro vía `refQ` | ✅ Completo |
| — | `a652d73`…`43e78f3` | — | Fix: `"use server"` faltante en `productos.ts` + URL `?q=` vacío persistente | ✅ Completo |

## Último slice completado

2026-06-19 — refQ: botón "Volver" en detalle preserva filtro de búsqueda (`d4f3105`)


---

## ESTADO AL 2026-11-10 11:20 (Chile) — LEER PRIMERO PARA RETOMAR

Handoff escrito por el Director Tecnico (Claude) antes de cambiar de cuenta. Todo lo de abajo esta verificado con codigo, tests o queries reales.

### Como se trabaja (instrucciones vigentes de Pablo)
- Director Tecnico = Claude (chat, a menudo desde la app Android de Pablo). Programador = **claude-deep** (funcion del perfil PowerShell que configura DeepSeek y lanza `claude`). NO usar `claude` a secas.
- El Director tiene autorizacion de Pablo para commit + push a GitHub (`arjunzofri/all-arjun-v2`, rama `main`), que despliega a Vercel (https://all-arjun-v2.vercel.app).
- "Siempre revisa por tu cuenta lo que te informe claude-deep": el Director lee el codigo, corre los tests y `npx tsc --noEmit` el mismo antes de cada commit.
- A Pablo solo se le avisa por notificacion push cuando se necesita algo; si no, se avanza.
- Ciclo PBT-IA por slice: Fase A (contrato, revision de impacto lateral, riesgos) -> el Director aprueba/ajusta -> Fase B (tests en rojo) -> C (implementacion <=200 lineas) -> D (tsc, vitest completo, build, flag) -> el Director verifica y hace commit.

### Como se invoca claude-deep en modo headless (desde PowerShell del PC)
- Script: `C:\Users\pablo\Documents\app-arjun-v2\_poc_tmp\deep.ps1 -Prompt <archivo.md> -Log <archivo.log> -Tools <lista>`. Carga `~/.claude/pbravot/pbravot-perfil.ps1` (Metodo pBravoT; la API key vive cifrada con DPAPI en `%LOCALAPPDATA%\pbravot\secrets\`) y corre `claude -p` en el repo. Alternativa estandar pBravoT: `~/.claude/pbravot/deep.ps1` (ver ~/.claude/PBRAVOT-MODO-POWERSHELL.md).
- Fase A solo lectura: `-Tools Read,Glob,Grep`. Fases B-C-D: `-Tools "Read,Glob,Grep,Edit,Write,Bash"`. Siempre "SIN commit".
- Lanzar detached (la tool de PowerShell corta a los 60 s): `New-Object System.Diagnostics.ProcessStartInfo 'powershell.exe', "-NoLogo -ExecutionPolicy Bypass -File ..."` con WindowStyle Hidden. El log termina con `=== FIN ===`.
- Prompts y logs de cada slice quedan en `_poc_tmp\` (m2_s*.md/.log, m1_*.md/.log).
- Ojo: claude-deep a veces se aparta del contrato (cambio ubicacion de archivos, quito filtros, dejo un `next dev` vivo en el puerto 3123). Revisar siempre.

### Fallos preexistentes de la suite (NO son de los modulos nuevos; no tocar sin abrir bug)
`smoke-e2e > tsc --noEmit` (timeout), `sync-compras-anil` x2 (timeouts 5 s contra DB), `vistas-unificacion > nextCursor` (depende de datos vivos). A veces `ajuste-entrada` por timeout bajo carga.

### MODULO 2 — Inversion en mercaderia (FIFO): TERMINADO Y ENCENDIDO EN PRODUCCION
Commits: `e6fba50` (FIFO puro), `1a58f7b` (lotes por codigo + dedup), `82d4383` (GET /api/inversion/por-codigo), `7656334` (resumen global), `676d77c` (pagina 5a), `eca819c` (modal detalle 5b), `bef2d80` (nav admin 5c), `d645c09` (flag `inversion_mercaderia=true`, aprobado por Pablo).
- `lib/utils/inversion-fifo.ts`: `calcularInversionFifo(lotes, stock)` asigna el stock a las compras MAS RECIENTES.
- `lib/utils/inversion-lotes.ts`: lee Vida Digital (solo SELECT), `tipomovi='V' AND kcodcli2 IN (2,20,218)`, `fechanvt >= '2023-09-01'`, una query por esquema (vida, sanjh) sin mezclarlos. Dedup `DISTINCT ON (codunico, knumfoli, NULLIF(TRIM(kdocitem),'')::int)`. Stock propio sumado sin clamp.
- `lib/utils/inversion-resumen.ts`, `lib/utils/inversion-formato.ts` (formato sin Intl), `lib/feature-flags.ts`.
- Rutas: `GET /api/inversion/por-codigo?codigo=`, `GET /api/inversion/resumen` (401 sin sesion, 404 flag off, 403 si no es admin, 502 si falla Vida Digital). Pagina `/inversion-mercaderia` (solo admin) + `components/inversion/{TablaInversion,DetalleCodigo}.tsx`. Menu: `components/DashboardShell.tsx` (cliente) + `app/(dashboard)/layout.tsx` (server, `showInversion = admin && flag`). Todas las paginas del dashboard pasaron a Dynamic.
- Verificado en produccion el 2026-11-10 con usuario admin: USD 156.845,81, 22.389 unidades, 269 codigos (32 sin compras desde sep-2023); el modal de HR-6 carga bien.

#### Pendientes del Modulo 2 (pedidos por Pablo el 2026-11-10)
1. **Etiqueta**: "Folio" = numero de **Nota de Venta** (documento "NOTA DE VENTA", tipo 203-VENTA TRASPASO DE MERCANCIAS, `knumfoli`). Cambiar el texto "Folio" por "Nota de Venta" en `DetalleCodigo.tsx` (y donde aparezca en la UI de inversion).
2. **Empresa**: mostrar en cada partida si viene de **Vida Digital** (esquema `vida`) o **Sanjh** (esquema `sanjh`). Requiere agregar `origen` a lo que devuelve `getLotesCompraPorCodigos`/`LoteCompra` o a la respuesta del endpoint (hoy se pierde al juntar esquemas). Los mismos numeros de nota existen en ambas empresas con distinto cliente (ej. sanjh 001986 es de kcodcli2=542, no de Anil).
3. **Menu**: dice "Inversion" sin tilde; corregir a "Inversión" en `components/DashboardShell.tsx`.
4. **Lineas repetidas en itemdcto — INVESTIGACION ABIERTA, no resuelta.** Hechos:
   - Patron A (ya corregido con el DISTINCT ON): misma linea dos veces con igual `kdocitem` (una en formato antiguo `' 13'`, otra normalizada `'13'`). sanjh: 1.993 lineas / 1.017 unicas; vida: 590 / 487.
   - Patron B (NO corregido): misma linea con distinto `kdocitem`, mismo `knumezet` (zeta) y misma cantidad. Ej. vida nota 001986, HR-6: kdocitem 1 y 11, ambas 500 u., zeta 101-26-047568-013.
   - Pablo envio fotos de las notas impresas 001986 y 001987 (guardadas en docs/evidencia/) (fecha 03/08/2026, emisor IMPORT EXPORT VIDA DIGITAL LTDA). La **001986 impresa SI muestra HR-6 dos veces** (500 + 500, USD 1.550 cada una) y su total cuadra con eso: 1.536 unidades, USD 9.080,30. Lineas impresas 001986: HR-6 500, 582-2 50, 4500 15, 4500 20, A-16 36, BL-8801 36, MK0-216 30, EGD-100 5, HN-1 200, HN-2 144, HR-6 500. Lineas impresas 001987: HN-3 250, HN-5 90, KH-10 100, MK-RQ63 60, IP-01 12, IP-02 20, T-501 120, S-266 300 (total 952 u., USD 3.578,00).
   - La app Arjun (sync) registro para 001986: HR-6 500 (fecha_compra 2026-07-17, sync del 2026-07-25), y para 001987 S-266 300, T-501 120. El calculo deduplicado de inversion da para 001987 S-266 600 y T-501 240 (el doble de lo impreso) y para 001986 HN-1 400, HN-2 288 (el doble de lo impreso).
   - Conclusion parcial: el documento impreso es la verdad. Para 001986/HR-6 la verdad es 1.000 (dos lineas impresas) y a la app le faltan 500. Para HN-1/HN-2/S-266/T-501 la verdad es la cantidad impresa y el calculo de inversion esta duplicando. Hay que encontrar una regla de deduplicacion que reproduzca exactamente el documento impreso (comparar todas las columnas de las filas repetidas de 001986 y 001987 en vida.itemdcto: knumdocu, empresaa, adulegal, pestadot, etc.) y validarla contra ambas notas. Luego: (a) aplicarla en inversion-lotes.ts; (b) evaluar con el protocolo de debugging si el sync (`getComprasAnilDesde` + `lib/sync/compras-anil.ts`) pierde lineas legitimas (HR-6) — el sync agrupa por folio+codigo y no relee notas ya sincronizadas aunque Vida Digital las edite (la 001986 cambio de fecha 17-07 a 03-08 despues del sync).
   - Comparacion global hecha el 2026-11-09 (181 movimientos sincronizados vs Vida Digital deduplicado): 161 iguales, 0 inflados, 10 con menos en Arjun (8 exactamente la mitad), 10 sin contraparte.
   - Scripts de diagnostico (solo lectura) en `_poc_tmp\`: vdcheck.cjs, vdcheck2.cjs, synccheck.cjs, fechacheck.cjs, f2.cjs. Uso: `$env:NODE_PATH="<repo>\node_modules"; node <script> <repo>`.

### MODULO 1 — Identificacion de productos por foto: EN CURSO (slice 1 de 10 hecho)
Prueba de concepto (fuera del repo, `_poc_tmp\poc\`): 27 fotos de bodega en `_poc_tmp\bodega\`, catalogo `catalog.json`, miniaturas `thumbs\`, fichas visuales `captions.json` (2.235 de 2.267), scripts `poc.cjs`, `poc2.cjs`, `caption.cjs`, `sheets.cjs`, resultados `result_*.json`. Resultado v2: codigo correcto entre las 3 opciones en ~25-26 de 27; la IA a veces se equivoca con 95-100% de confianza -> no mostrar porcentaje. Codigos reales confirmados por Pablo: 02/04: 1067 o 1045; 05: A-610; 07: DPKK-1000; 10: YQ10011; 15: 1044; 23: R.2839B; 24: QAN-2414; 26: 1044 (la IA insiste en 2767-1; Pablo no respondio si esta seguro).

Plan aprobado (10 slices), flag `identificacion_foto=false`:
1. Cliente Gemini JSON — **HECHO** `0d33595`: `lib/identificacion/gemini.ts` `llamarGeminiJson<T>(parts)`, modelo `gemini-3.5-flash-lite`, `thinkingConfig.thinkingLevel:'low'`, clave en header `x-goog-api-key`, rota en 429/5xx (2 rondas con backoff) y en 401/403, 400/404 sin reintento, timeout 20 s. Test real opt-in (`GEMINI_REAL=1`) verificado OK.
2. Catalogo read-only desde Vida Digital `public.productos` (tercer uso autorizado: actualizar la regla en CLAUDE.md) + tabla `producto_fichas_visuales` (codigo PK, ficha jsonb, imagen_hash, modelo, generado_en; sin FK) aplicada con `npx drizzle-kit push` + agrupacion de codigos duplicados. **SIGUIENTE: lanzar Fase A.**
3. Script local generador de fichas (lotes de 16 imagenes, incremental por hash).
4. Etapa A describir foto. 5. Etapa B preseleccion (palabras + modelo con catalogo completo, union max 48). 6. Etapa C rerank por tandas de 24 miniaturas -> top 3. 7. `POST /api/identificacion` (maxDuration 60, presupuesto 45 s, auth cualquier sesion, flag). 8. UI `/entradas/identificar` (reutiliza `components/CamaraBoton.tsx`). 9. Codigo alternativo `ARJ-` via `upsertProducto`. 10. Activacion.

Decisiones del Director ya comunicadas a claude-deep: catalogo leido directo de Vida Digital sin copia; duplicados (1124 / 1124(ANIL), QAN-2414 / VD-QAN-2414) se muestran como un grupo con los codigos variantes seleccionables, preseleccionando el que exista en la tabla productos propia; lo usa cualquier usuario (operador y admin).
Pendiente operativo: cargar `GEMINI_API_KEY_1/2/3` en las variables de entorno de Vercel antes de activar (hoy solo estan en `.env.local`). `zod` se usa pero no esta declarado en package.json (corregir al llegar al slice 4).

### Cotizacion enviada al cliente
Artifact "Cotizacion App Arjun — Identificacion por foto e Inversion en mercaderia": 120 UF total (Modulo 1 = 65 UF con Etapa 0 PoC de 10 UF y clausula de salida; Modulo 2 = 55 UF).

### ACTUALIZACION 2026-11-10 tarde (Director Tecnico, nueva sesion)

**Modulo 2 — slice 6 HECHO `e4cb0ff`** (pendientes 1-4 de Pablo):
- Regla de lineas validas en `inversion-lotes.ts`: `i.pestadot = '3'` + DISTINCT ON por kdocitem normalizado. Patron B = lineas en borrador (pestadot '1', knumdocu/knumorde NULL) que no salen en el documento impreso. Validado: 214/215 notas de Anil (vida+sanjh desde 2023-09-01) cuadran al centavo con `movidcto.val_doc`; unica excluida vida 002515 (nota completa en borrador, 632 u. / USD 8.682,80). 001986 = 1.536 u. / USD 9.080,30 (HR-6 = 1.000, dos lineas legitimas); 001987 = 952 u. / USD 3.578,00.
- `origen: "vida" | "sanjh"` en LoteCompra/PartidaValorizada; columna "Empresa" y encabezado "Nota de Venta" en DetalleCodigo; menu "Inversión".
- Test real opt-in `INVERSION_REAL=1` (`__tests__/inversion-notas-reales.test.ts`) con reconciliacion completa.
- Diagnosticos: `_poc_tmp\dup_cols.cjs`, `pestado_global.cjs`, `regla_combinada.cjs` (+ .out).
- **PENDIENTE (bug aparte, protocolo de debugging):** el sync (`getComprasAnilDesde`) tampoco filtra `pestadot` ni deduplica por kdocitem, y no relee notas editadas. Probable causa de las 10+10 diferencias de la comparacion global del 2026-11-09. Requiere hipotesis aprobada por Pablo antes de tocar.

**Modulo 1 — slice 2 HECHO** (catalogo + tabla fichas):
- `getCatalogoVidaDigital()` (db/vidadigital/queries.ts): lee todas las filas de public.productos y deduplica en TS (detalle mas frecuente; imagen_url es unica por codigo, verificado). 5.318 filas -> 2.542 codigos con imagen, ~0,5 s.
- `lib/identificacion/catalogo.ts`: `agruparCatalogo` (clave base sin `(ANIL)` ni `VD-`, gate por descripcion: primer token o Jaccard >= 0,5, politica conservadora) y `getCatalogoIdentificacion()`. Real: 2.419 grupos, 115 multi-codigo, 5 pares rechazados (`_poc_tmp\m1_s2_grupos.txt`; 1161A/VD-1161A es falso negativo aceptado).
- Tabla `producto_fichas_visuales` creada en la base propia con CREATE TABLE IF NOT EXISTS (drizzle-kit push queda vetado: ver Zonas de riesgo del PRD, desfase `uq_users_username`).
- CLAUDE.md declara los 4 usos read-only de Vida Digital.
- **SIGUIENTE: Slice 3** (script local generador de fichas, lotes de 16 imagenes, incremental por hash).

### ACTUALIZACION 2026-11-10 13:50 — Debugging del sync CERRADO (codigo) + regularizacion
- Regla de negocio de Pablo: las notas o lineas en borrador NO se consideran hasta ser compras confirmadas.
- Fixes en main: `4d37c44` fix 1 (pestadot 3 + dedup en getComprasAnilDesde), `2a90068` fix 0 (tests del sync con mocks; antes ejecutaban el sync real y forzaban el watermark en produccion), `2047914` fix 4 (watermark por fechconf; absorbe fix 2), `3b4ad6c` fix 3 (UNIQUE folio+producto+bodega, aplicada por SQL puntual).
- Regularizacion aplicada: sync real (+17 movs / +1.913 u.) y 25 ajustes AJT-REGSYNC (-634 u.). Pendientes 5 codigos de 001653 (ver BUGS.md) esperando decision de Pablo.
- REGLA OPERATIVA: no correr `npx vitest run` completo: ~13 archivos de test aun escriben en la base de produccion (con limpieza). Correr solo archivos puntuales que usen mocks o sean solo lectura. Pendiente: base de pruebas separada (rama Neon).
- Tablas de prueba en produccion detectadas: movimientos TRF-TRF-SMOKE-*/TRF-TRF-NEW-* (TEST-TRF-001) y usuarios test-user2, test-dup, test-login (admin).

### ACTUALIZACION 2026-11-10 14:10 — Base de pruebas aislada
- Rama Neon "test" (br-polished-union-adik8tfv, proyecto blue-art-37644995) creada desde production. `TEST_DATABASE_URL` en .env.local; vitest.setup.ts la exige y aborta si su host coincide con produccion. Verificado: suite completa (552 tests) con huella de produccion identica antes/despues. Ya se puede correr `npx vitest run` completo.
- Fallos conocidos de la suite: smoke-e2e tsc (timeout 5 s) y vistas-unificacion nextCursor (asume < 100 filas en bodega 1).
- Datos de prueba borrados de produccion (aprobado por Pablo): 7 productos TEST-*, 10 movimientos, 9 filas de stock, usuarios test-user2, test-dup, test-login.
- Pendiente (decision de Pablo, en espera): 5 codigos de 001653 en Bodega 1 (ver BUGS.md).

### DECISION 2026-11-10 — Entrega con corte de inventario (Pablo / Anil)
- Al entregar la app se parte de cero en stock: la misma semana de la entrega Arjun empieza a usarla y hace inventario fisico completo (Bodega 1, Bodega 2, Bodega Arjun, modulos 180/182/183/184/193).
- Se CONSERVAN productos (278, con 103 ubicaciones asignadas), usuarios, bodegas y modulos. Se REINICIAN stock, movimientos, movimiento_visaciones y ajustes; el watermark compras-anil queda en la fecha de corte (fecha de confirmacion). Antes: rama Neon de respaldo de production.
- Carga del conteo: codigo por codigo en la pantalla de Entradas (decision de Pablo).
- Brecha detectada: `crearEntrada` solo acepta bodegas (bodegaId). Para contar stock que ya esta en los modulos hace falta permitir el conteo inicial directo a un modulo (folio INV-), o habria que cargarlo a bodega y luego hacer salida. Pendiente de slice.
- Con el corte, los 5 codigos pendientes de 001653 y cualquier arrastre previo quedan resueltos.
- Hechos al 2026-11-10: en la v2 nunca se registro una salida a modulos (las 52 salidas son migradas de v1) y no hubo actividad de usuarios en los ultimos 30 dias.

### PLAN DE ENTREGA (aprobado por Pablo 2026-11-10)
1. Conciliacion automatica de compras app vs Vida Digital (slice en curso; Fase A lanzada). Objetivo: poder afirmar con evidencia que las compras de la app son exactamente iguales a las de Vida Digital.
2. Validacion contra WinFac: muestra de ~10 notas de venta impresas (fotos de Pablo) comparadas contra la app.
3. Script de corte de inventario: rama Neon de respaldo, reinicio de stock/movimientos/visaciones/ajustes, watermark = fecha de corte.
4. Arjun hace inventario fisico la semana de la entrega y lo carga codigo por codigo en Entradas. Lo que va a modulos lo manejan los usuarios con salidas normales (decision de Pablo: no se hace slice de conteo directo a modulos).

### VALIDACION CONTRA WINFAC (2026-11-10, punto 2 del plan de entrega) — OK
Fotos de 10 notas de venta impresas del WinFac enviadas por Pablo (5 Vida Digital: 002040, 002109, 002228, 002331, 002515; 5 Sanjh: 003680, 003757, 003758, 003766, 003767). Transcripcion verificada contra unidades y total impresos de cada nota. Resultado (`_poc_tmp/winfac_vs.cjs`, `winfac_impresas.json`, `winfac_vs.out`): en las 10 notas, impreso WinFac = Vida Digital (Neon, regla de la app) = app Arjun, linea por linea (codigo, zeta, cantidad, precio) y por bodega. Unica diferencia inicial (002109 MK-EDF01 vs MK-BDF01) fue error de lectura de la foto, confirmado ampliando la imagen. Suma con 001986/001987: 12 notas impresas validadas.

### MODULO 1 — Identificacion por foto: TERMINADO Y ENCENDIDO (2026-11-10, aprobado por Pablo)
- Commits: a65e812/b31e408 (slice 3 fichas + script `npm run fichas`), 74ce01f (4 describir), e3992a3 (5 preseleccion), 6c2330c (6 rerank), 9606b07 (7 orquestador + POST /api/identificacion), 93d87fe/ebc2604 (8 pantalla /entradas/identificar + menu), 8625e56 (9 codigo ARJ-YYMMDD-XXX), 60c1a2b (etapa B con lista liviana: 307k->189k caracteres, 38 s -> 4 s; plazo por etapa), 14ce085 (reintento ante timeout de Gemini), 8a7c917 (4.a opcion "Otra posibilidad"), 1bcd258 (si el rerank no alcanza, devuelve la preseleccion con aviso), flag identificacion_foto=true.
- Fichas visuales: 2.254 de 2.542 productos en `producto_fichas_visuales` (las 288 restantes tienen la imagen rota en Cloudinary, 404). Regenerar incremental: `npm run fichas` (local, nunca en Vercel).
- Precision real (banco `_poc_tmp/eval_identificacion.ts`, 27 fotos de bodega, 3 corridas): 19, 21 y 20 aciertos (codigo correcto entre las 3-4 opciones); version final 20/27 sin errores, mediana 21 s. 25/27 acertadas en al menos una corrida. Fallos: productos casi identicos (termos, cajas parecidas). Mejora posible: la comparacion visual (etapa C).
- Claves GEMINI_API_KEY_1/2/3 cargadas en Vercel por Pablo (2026-11-10).
- Lineas de produccion por slice declaradas en cada commit; slices 3 y 8 divididos en dos commits por el limite de 200.
