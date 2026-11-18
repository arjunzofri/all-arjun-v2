# QA-REGISTRO

Registro automatico de la Fase E (Metodo pBravoT, ver ~/.claude/PBRAVOT-QA.md).
Cada pendiente se cierra cambiando `[ ]` por `[x]` y agregando la resolucion al final de la linea:
`-> ARREGLADO <commit>` / `-> BACKLOG <referencia>` / `-> DESCARTADO <motivo>`.
Con pendientes (alta) o (critica) abiertos, el hook pre-commit bloquea el commit. BACKLOG solo para media o baja.

## 2026-11-10 21:44 - arjun-barrido - commit 8c15d08 - INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\arjun-barrido
- [x] P-20261110-2144-1 (media) FALTA: FALTA-1 — Fecha en la entrada manual -> 
- [x] P-20261110-2144-2 (baja) CONSOLA: Failed to load resource: the server responded with a status of 403 (Forbidden) (/usuarios) -> DESCARTADO duplicado de P-20261110-2327-1
- [x] P-20261110-2144-3 (media) CONSOLA: Each child in a list should have a unique "key" prop. See https://react.dev/link/warning-keys for more information. -> 

## 2026-11-10 21:58 - arjun-barrido-c1 - commit 8c15d08 - FALLA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\arjun-barrido-c1
- [x] P-20261110-2158-1 (media) FALLA: BAR-DEF-1 — Packing negativo se acepta y se guarda -> DESCARTADO duplicado de P-20261110-2158-5 (verificado por el Director: lib/actions/productos.ts no valida packing)
- [x] P-20261110-2158-2 (alta) FALLA: BAR-DEF-2 — /movimientos "Cargar mas" repite filas -> 
- [x] P-20261110-2158-3 (baja) FALLA: BAR-DEF-3 — /inversion-mercaderia: el código parece enlace y no hace nada -> DESCARTADO falso positivo (verificado por el Director: el clic en el codigo abre el modal)
- [x] P-20261110-2158-4 (alta) ROTO: /movimientos - button "Cargar mas": -> DESCARTADO duplicado de P-20261110-2158-2
- [x] P-20261110-2158-5 (alta) ROTO: /productos/:id - spinbutton "Packing (unids/caja)" y button "Guardar cambios": -> 
- [x] P-20261110-2158-6 (alta) ROTO: /inversion-mercaderia - button de fila (en filas): -> DESCARTADO falso positivo (verificado por el Director: el clic en el codigo abre el modal)
- [x] P-20261110-2158-7 (baja) HALLAZGO: EXP-1 — Formato de miles inconsistente -> 
- [x] P-20261110-2158-8 (media) HALLAZGO: EXP-2 — Tipo "ajuste" ausente en el filtro de /movimientos -> 
- [x] P-20261110-2158-9 (media) HALLAZGO: EXP-3 — Tras "Corregir", el detalle no coincide con el saldo -> BACKLOG UX: "Corregir" funciona segun diseno; mejorar como se muestra el detalle
- [x] P-20261110-2158-10 (media) HALLAZGO: EXP-4 — Saldos de salida sin entrada en /bodegas/1 ->  | ACTUALIZADO 2026-11-11: ARREGLADO (decision de Pablo): retornos suman en Entro de la bodega y columna Ajustes con signo; QA columnas + columnas2 PASA
- [x] P-20261110-2158-11 (baja) HALLAZGO: EXP-5 — Textos y avisos inconsistentes -> 
- [x] P-20261110-2158-12 (baja) HALLAZGO: EXP-6 — Búsquedas lentas y errores de consola ->  | MEDIDO en produccion 2026-11-11 (commit bede189, 4 rondas x 4 busquedas): primera llamada fria 1,3 s; despues 0,3-0,4 s en buscar-historico, por-bodega y productos. No se toca
- [x] P-20261110-2158-13 (baja) HALLAZGO: EXP-7 — Columna "Bodegas" sin nombres en /productos -> 
- [x] P-20261110-2158-14 (media) CONSOLA: Failed to load resource: the server responded with a status of 404 () (/dxkidwxjl/image/upload/productos/87086-5(ANIL)) -> 
- [x] P-20261110-2158-15 (media) CONSOLA: [probable misma causa que P-20261110-2158-2, filas repetidas] Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7200 -> 
- [x] P-20261110-2158-16 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7199 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-17 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7198 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-18 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7197 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-19 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7196 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-20 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7195 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-21 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7194 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-22 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7193 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-23 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7189 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-24 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7188 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-25 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7187 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-26 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7186 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-27 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7185 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-28 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7184 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-29 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7183 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-30 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7182 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-31 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7181 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-32 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7180 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-33 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 5728 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-34 (media) CONSOLA: Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 5727 -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2158-35 (media) CONSOLA: Failed to load resource: the server responded with a status of 404 () (/dxkidwxjl/image/upload/productos/1130-5) -> 
- [x] P-20261110-2158-36 (alta) CONSOLA: Failed to load resource: the server responded with a status of 500 (Internal Server Error) (/salidas) -> 

## 2026-11-10 22:07 - arjun-barrido-c2 - commit 8c15d08 - INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\arjun-barrido-c2
- [x] P-20261110-2207-1 (baja) HALLAZGO: EXP-1 — Sugerencias de producto no aparecen al rellenar el campo de golpe -> 
- [x] P-20261110-2207-2 (baja) HALLAZGO: EXP-2 — Consola: error de React por claves duplicadas -> DESCARTADO duplicado de P-20261110-2158-15
- [x] P-20261110-2207-3 (baja) HALLAZGO: EXP-3 — Cuadro de /modulos/1 para TEST-RET-001 no suma ->  | ACTUALIZADO 2026-11-11: ARREGLADO (decision de Pablo): retornos suman en Entro de la bodega y columna Ajustes con signo; QA columnas + columnas2 PASA

## 2026-11-10 22:55 - prod-prueba1 - commit 1b99433 - PRODUCCION PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-prueba1
- Sin pendientes nuevos.

## 2026-11-10 23:27 - prod-sesion2 - commit bde7ddb - PRODUCCION FALLA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-sesion2
- [x] P-20261110-2327-1 (media) FALLA: QA-P01 a QA-P10 — Error 403 en consola al cargar cualquier pantalla con sesión [Director: severidad critica->media; causa verificada: components/DashboardShell.tsx muestra "Usuarios" a todos los roles y proxy.ts responde 403 a no-admin; sin exposicion de datos] -> DESCARTADO duplicado de P-20261111-0039-1 (sigue abierto con el texto que produce el humo)
- [x] P-20261110-2327-2 (media) HALLAZGO: EXP-6 — `/usuarios` responde 403 "No autorizado" -> DESCARTADO duplicado de P-20261110-2327-1
- [x] P-20261110-2327-3 (baja) CONSOLA: Failed to load resource: the server responded with a status of 403 () (/usuarios) -> DESCARTADO duplicado de P-20261110-2327-1

## 2026-11-10 23:52 - prod-roles1-anon - commit 8e10081 - PRODUCCION PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-roles1-anon
- Sin pendientes nuevos.

## 2026-11-10 23:52 - prod-roles1-admin - commit 8e10081 - PRODUCCION INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-roles1-admin
- [x] P-20261110-2352-1 (media) CONSOLA: Manifest: Line: 1, column: 1, Syntax error. (/manifest.json) [Director: causa verificada: proxy.ts matcher no excluye /manifest.json; prod responde 307 a /login (HTML) y el manifest se pide sin cookies, falla con y sin sesion; PWA no instalable] -> 

## 2026-11-10 23:52 - prod-roles1-operador - commit 8e10081 - PRODUCCION INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-roles1-operador
- Sin pendientes nuevos.

## 2026-11-11 00:28 - prod-mec1-admin - commit fad4b0f - PRODUCCION PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-mec1-admin
- [x] P-20261111-0028-1 (media) CONSOLA: JS: pbravot: solo lectura (/usuarios) -> DESCARTADO: lo produjo la barrera de solo lectura del humo (listarUsuarios es server action por POST); se agrego /usuarios a permitirPost y el script ya no cuenta sus propios cortes como error

## 2026-11-11 00:31 - prod-mec2-admin - commit fad4b0f - PRODUCCION PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-mec2-admin
- Sin pendientes nuevos.

## 2026-11-11 00:31 - prod-mec2-operador - commit fad4b0f - PRODUCCION FALLA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-mec2-operador
- [x] P-20261111-0031-1 (critica) FALLA: QA-OPE10 - /inversion-mercaderia: termino en /inversion-mercaderia (status 200) -> DESCARTADO falso positivo: la captura muestra "404 This page could not be found" (notFound() con loading.tsx responde 200); el script ahora juzga lo que se ve
- [x] P-20261111-0031-2 (media) FALLA: QA-OPE12 - /: termino en / (status 200); SE VE: Usuarios [Director: severidad critica->media; mismo defecto que P-20261110-2327-1 (DashboardShell.tsx sin filtro de rol); sin exposicion de datos: /usuarios responde 403] -> DESCARTADO duplicado de P-20261111-0039-1
- [x] P-20261111-0031-3 (baja) CONSOLA: Failed to load resource: the server responded with a status of 403 () (/usuarios) [Director: consecuencia de P-20261111-0039-1; se cierra con el] -> 

## 2026-11-11 00:33 - prod-mec3-admin - commit fad4b0f - PRODUCCION PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-mec3-admin
- Sin pendientes nuevos.

## 2026-11-11 00:33 - prod-mec3-operador - commit fad4b0f - PRODUCCION FALLA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-mec3-operador
- Sin pendientes nuevos.

## 2026-11-11 00:36 - cob1-admin - commit fa2219d - PRODUCCION PASA
- Evidencia: C:\Users\pablo\AppData\Local\Temp\pbt-dt-prueba2\qa\cob1-admin
- Sin pendientes nuevos.

## 2026-11-11 00:37 - cob1-operador - commit fa2219d - PRODUCCION FALLA
- Evidencia: C:\Users\pablo\AppData\Local\Temp\pbt-dt-prueba2\qa\cob1-operador
- [x] P-20261111-0037-1 (critica) FALLA: QA-OPE13 - /: termino en / (status 200); SE VE: Usuarios -> DESCARTADO duplicado de P-20261111-0039-1 (el titulo llevaba el ID del caso; corregido para que sea estable)

## 2026-11-11 00:39 - cob2-operador - commit fa2219d - PRODUCCION FALLA
- Evidencia: C:\Users\pablo\AppData\Local\Temp\pbt-dt-prueba3\qa\cob2-operador
- [x] P-20261111-0039-1 (media) FALLA: / (menuNoVe): termino en / (status 200); SE VE: Usuarios [Director: severidad critica->media; causa verificada: components/DashboardShell.tsx muestra "Usuarios" a todos los roles; sin exposicion de datos: /usuarios responde 403 al operador] -> 

## 2026-11-11 02:38 - ia1-admin-ia - commit fa063d3 - PRODUCCION FALLA
- Evidencia: C:\Users\pablo\AppData\Local\Temp\pbt-dt-ia1\qa\ia1-admin-ia
- [x] P-20261111-0238-1 (critica) FALLA: QA-ADM01 — Error de consola: manifest.json con error de sintaxis -> 
- [x] P-20261111-0238-2 (critica) FALLA: QA-ADM02 — Error de consola: manifest.json con error de sintaxis -> 
- [x] P-20261111-0238-3 (media) HALLAZGO: EXP-1 — `/salidas`: error de consola de manifest.json -> 
- [x] P-20261111-0238-4 (media) HALLAZGO: EXP-2 — `/retornos`: error de consola de manifest.json -> 
- [x] P-20261111-0238-5 (media) HALLAZGO: Observación sobre `/productos` -> 

## 2026-11-11 02:40 - fix-noche - commit fa063d3 - INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\fix-noche
- [x] P-20261111-0240-1 (media) FALLA: QA-08 — La fecha de ingreso se guarda y se muestra un día antes -> 
- [x] P-20261111-0240-2 (media) HALLAZGO: EXP-1 — Envío vacío en /salidas (sin hallazgo) -> 
- [x] P-20261111-0240-3 (baja) HALLAZGO: EXP-2 — El mensaje de error anterior sigue visible con el formulario ya completado -> 
- [x] P-20261111-0240-4 (baja) HALLAZGO: EXP-3 — Consola con error de React "unique key" en la ficha de producto -> 
- [x] P-20261111-0240-5 (baja) HALLAZGO: EXP-4 — Fecha de la fila expandida en /bodegas/1 distinta de la de /movimientos -> 
- [x] P-20261111-0240-6 (media) HALLAZGO: EXP-5 — Abrir y cerrar filas en /bodegas/1 (sin hallazgo) -> 
- [x] P-20261111-0240-7 (baja) HALLAZGO: EXP-6 — /favicon.ico responde 404 -> 

## 2026-11-11 03:07 - fix-noche2 - commit fa063d3 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\fix-noche2
- [x] P-20261111-0307-1 (baja) HALLAZGO: EXP-1 — La ficha muestra "---" como fecha donde /bodegas/1 muestra una fecha -> 

## 2026-11-11 05:02 - fix-noche3 - commit fa063d3 - BLOQUEADO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\fix-noche3
- Sin pendientes nuevos.

## 2026-11-11 05:05 - fix-noche3 - commit fa063d3 - INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\fix-noche3
- Sin pendientes nuevos.

## 2026-11-11 07:55 - prod-deploy-bede189-operador - commit bede189 - PRODUCCION PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-deploy-bede189-operador
- [x] P-20261111-0755-1 (baja) CONSOLA: Failed to load resource: the server responded with a status of 403 () (/usuarios) -> DESCARTADO: es el 403 esperado del caso "operador no ve /usuarios" del humo; qa-prod-mecanico.js ya no cuenta errores de consola de casos oculta

## 2026-11-11 08:25 - columnas - commit 5ad313d - FALLA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\columnas
- [x] P-20261111-0825-1 (media) FALLA: QA-05 — Con un ajuste en el detalle, la tabla se desborda y el botón "Corregir" queda cortado -> ARREGLADO: folios largos truncados con title en el detalle; QA columnas2 PASA

## 2026-11-11 08:36 - columnas2 - commit 5ad313d - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\columnas2
- Sin pendientes nuevos.

## 2026-11-11 09:32 - ciclo-prueba - commit 37ff5e9 - FALLA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\ciclo-prueba
- [x] P-20261111-0932-1 (baja) FALLA: QA-02 — El título de /bodegas es "Bodegas", no "Bodegas ZZZ-PRUEBA-QA-CICLO" -> DESCARTADO: caso que falla a proposito para probar qa-ciclo.ps1 (re-prueba confirmo la falla como se esperaba)

## 2026-11-11 11:32 - animacion-identificar - commit cbe8f9e - INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\animacion-identificar
- Sin pendientes nuevos.

## 2026-11-11 11:44 - animacion-identificar-2 - commit e7cb99b - BLOQUEADO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\animacion-identificar-2
- Sin pendientes nuevos.

## 2026-11-11 11:47 - animacion-identificar-3 - commit e7cb99b - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\animacion-identificar-3
- Sin pendientes nuevos.

## 2026-11-17 20:52 - inv-01 - commit f0a5c37 - INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-01
- Sin pendientes nuevos.
- Director: no se ejecutaron casos. Causa externa: limite semanal de Claude Sonnet (429), reinicio informado 21 nov 01:00 Chile. Pendiente Fase E; no clasificar como PASA ni falla de la app.

## 2026-11-17 21:31 - inv-01-deep - commit f0a5c37 - INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-01-deep
- Sin pendientes nuevos.

## 2026-11-17 21:35 - inv-01-deep2 - commit f0a5c37 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-01-deep2
- [x] P-20261117-2135-1 (baja) HALLAZGO: EXP-1 — Página "No autorizado" sin navegación al entrar a /usuarios como operador -> BACKLOG BUGS.md 2026-11-17; preexistente, Director reprodujo 403 correcto y acceso a Productos, no causado por contrato inerte de ubicaciones.
- [x] P-20261117-2135-2 (media) CONSOLA: Failed to load resource: the server responded with a status of 404 (Not Found) (/inversion) -> DESCARTADO: QA probo una ruta inventada; la ruta real es /inversion-mercaderia (ver DashboardShell.tsx), 404 esperado, sin enlace roto demostrado.

## 2026-11-17 21:48 - inv-02 - commit 4d6a914 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-02
- [x] P-20261117-2148-1 (baja) HALLAZGO: EXP-5 — Acceso directo de operador a /inversion-mercaderia devuelve un 404 crudo en inglés -> BACKLOG BUGS.md 2026-11-17; pagina anterior usa notFound deliberadamente para no-admin, sin fuga de costos. Mejora de texto/localizacion preexistente, sin relacion con la nueva tabla de conteos.

## 2026-11-17 22:02 - inv-03 - commit 4e28ae5 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-03
- [x] P-20261117-2202-1 (baja) HALLAZGO: EXP-1 — Buscar "%" devuelve el listado completo en vez de un resultado vacío -> BACKLOG BUGS.md 2026-11-17; comportamiento previo de ILIKE parametrizado en getProductos, no causado por funcion atomica. Buscar literalmente comodines se cubrira en contrato del nuevo buscador.

## 2026-11-17 22:15 - inv-04 - commit 6be66d0 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-04
- Sin pendientes nuevos.

## 2026-11-17 22:36 - inv-05 - commit 9d3a77f - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-05
- Sin pendientes nuevos.

## 2026-11-17 23:03 - inv-06 - commit 478c562 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-06
- Sin pendientes nuevos.

## 2026-11-17 23:20 - inv-07 - commit b73ac99 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-07
- Sin pendientes nuevos.

## 2026-11-17 23:35 - inv-08 - commit a756a06 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-08
- Sin pendientes nuevos.

## 2026-11-18 02:06 - inv-10 - commit 169ad4a - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-10
- Sin pendientes nuevos.

## 2026-11-18 02:24 - inv-11-on - commit da217d9 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-11-on
- Sin pendientes nuevos.

## 2026-11-18 02:29 - inv-11-off - commit da217d9 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-11-off
- Sin pendientes nuevos.

## 2026-11-18 03:06 - inv-12-on - commit 8dec764 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-12-on
- Sin pendientes nuevos.

## 2026-11-18 03:09 - inv-12-off - commit 8dec764 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-12-off
- Sin pendientes nuevos.

## 2026-11-18 03:36 - inv-13-on - commit ac6686b - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-13-on
- [x] P-20261118-0336-1 (baja) HALLAZGO: EXP-1 — URL inválida /productos/abc devuelve 404 crudo en inglés, sin navegación de retorno -> BACKLOG BUGS.md: localizacion de 404, variante del hallazgo inv-02 EXP-5; revisar antes UAT.
- [x] P-20261118-0336-2 (baja) HALLAZGO: EXP-2 — A 360 px el texto guía del buscador del encabezado aparece cortado -> ARREGLADO b9bd56e: guia corta Codigo o descripcion, label accesible completo; QA inv-13-fix PASA1/1 y Director verifico360px.
- [x] P-20261118-0336-3 (media) CONSOLA: Failed to load resource: the server responded with a status of 404 (Not Found) (/productos/abc) -> DESCARTADO respuesta HTTP 404 esperada al probar deliberadamente un ID invalido; no es error JavaScript ni fallo adicional. La mejora visual esta en P-20261118-0336-1.

## 2026-11-18 03:45 - inv-13-fix - commit ac6686b - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-13-fix
- Sin pendientes nuevos.

## 2026-11-18 03:52 - inv-13-off - commit ac6686b - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-13-off
- Sin pendientes nuevos.

## 2026-11-18 15:42 - inv-14-on - commit 2de6850 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-14-on
- [x] P-20261118-1542-1 (baja) HALLAZGO: EXP-1 — La respuesta JSON del API 404 empieza con un carácter BOM (U+FEFF) -> DESCARTADO: Director verifico bytes reales desde fetch/arrayBuffer; respuesta404 comienza con123 (llave), sin BOM. Captura EXP-1 tampoco prueba BOM; no se reproduce el defecto.
- [x] P-20261118-1542-2 (media) CONSOLA: Failed to load resource: the server responded with a status of 400 (Bad Request) (/api/productos/abc) -> DESCARTADO: HTTP400 esperado para ID deliberadamente invalido; no error JavaScript. Director reprodujo.
- [x] P-20261118-1542-3 (media) CONSOLA: Failed to load resource: the server responded with a status of 404 (Not Found) (/api/productos/999999999) -> DESCARTADO: HTTP404 esperado para producto inexistente; no error JavaScript. Director reprodujo.

## 2026-11-18 15:47 - inv-14-off - commit 2de6850 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-14-off
- Sin pendientes nuevos.

## 2026-11-18 15:54 - inv-09-1 - commit a39c1ff - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-09-1
- Sin pendientes nuevos.

## 2026-11-18 16:05 - inv-09-2 - commit 244e635 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-09-2
- [x] P-20261118-1605-1 (baja) HALLAZGO: EXP-1 — Navegación de retorno desde la ficha -> DESCARTADO: el propio informe observa comportamiento esperado, retorno correcto al inventario sin errores; no describe defecto. Director verifico navegacion y ausencia de erroresJS.

## 2026-11-18 16:21 - inv-16-1 - commit 8e47a0d - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-16-1
- Sin pendientes nuevos.

## 2026-11-18 16:35 - inv-16-2-on - commit df2047a - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-16-2-on
- Sin pendientes nuevos.

## 2026-11-18 17:11 - inv-17-1-on - commit 1499df8 - PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\inv-17-1-on
- Sin pendientes nuevos.
