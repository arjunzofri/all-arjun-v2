# Traspaso Arjun — vigente 2026-11-19 22:50 Chile

Leer este archivo, PRD.md (cabecera vigente), docs/plan-inventario-aprobado.md, CLAUDE.md, BUGS.md, QA-REGISTRO.md, AUTO-LOG.md y archivos reales. Este estado prevalece sobre los estados HISTORICOS de CONTEXT-CLAUDE-CHAT.md.

## Ubicación, autorización y límites
- Repo REAL: C:\Users\pablo\Documents\app-arjun-v2\app-arjun-v2 (doble carpeta), rama feat/inventario-bodega.
- GO de Pablo para todo el rediseño. **HORARIO CARO ES DE DEEPSEEK: 01:00-04:00 y 06:00-10:00 UTC lun-vie (22:00-01:00 y 03:00-07:00 Chile). NUNCA usar DeepSeek (deep.ps1 -Programador deep ni qa-ciclo-deep.ps1) en ese horario** (corrección de Pablo 2026-11-19; dos BCD y cuatro QA se corrieron por error en horario caro). En horario caro usar Sonnet (-Programador auto/sonnet, qa-ciclo.ps1). Sonnet agotado (weekly limit) hasta 2026-11-21 01:00 Chile, verificado 23:28; si Sonnet no está, esperar horario económico, no usar DeepSeek.
- pBravoT: Director NO escribe producto ni tests; Claude Code headless los escribe. A aprobado por Director -> B rojo -> C -> D -> verificación propia -> E aislado -> commit Director. Máximo200 added+deleted incluyendo tests/untracked/movimientos, reservar QA4.
- NO push/deploy/reset real: falta UAT Pablo y Señal3. Vida Digital READ ONLY. Nunca drizzle-kit push (drift constraint puede truncar users).
- Flags inventario_bodega:false, asignacion_bodega_compra:false. Activación solo temporal QA y restaurar.
- No pedir nuevas aprobaciones por fases rutinarias. Seguir backlog aprobado hasta UAT; solo gates humanos reales.

## Punto exacto de reanudación — 19.1 editor ficha CERRADO 4b71811, siguiente auditoria Senal2 y luego 19.2
- 19.1 commit 4b71811 (196 lineas). Contrato inv-19 ../_dt/logs/inv-19-editor-A.md + decisiones ../_dt/prompts/inv-19-decisiones-director.md. Contador **5**: correr auditoria ponytail (inv-audit-19-1-A) antes de 19.2.
- 19.2 imagen CAS: prompt ../_dt/prompts/inv-19-2-BCD.md y QA ../_dt/qa/inv-19-2-on/off.casos.md listos. Nunca Cloudinary real.

## (HISTORICO) inv-15 AuthWRITE CERRADO b62f69b
- Commit b62f69b (192 lineas). updateProducto/PATCH autentican y auditan con sesion; ubicacion libre rechazada en ON. Ver AUTO-LOG. Contador **4** (audit obligatorio al superar 5).
- Siguiente backlog: editor nuevo de ficha ON (alias/packing/observaciones sin ubicacion, con revalidate) + imagen (upload->CAS DB->cleanup). Requiere Fase A nueva.

## (HISTORICO) UsuariosR8 CERRADO c6878dc, siguiente AuthWRITE productos (inv-15)
- UsuariosR8 commit **c6878dc** (189 líneas incl QA). Ver AUTO-LOG Cierre UsuariosR8 y BUGS (ARREGLADO + BACKLOG media errores esperados como valor antes UAT). Contador **3**.
- Siguiente AuthWRITE productos: contrato INV-13.3 en ../_dt/logs/inv-13-lectura-A.md (sección Contrato INV-13.3) + prompt ../_dt/prompts/inv-15-BCD.md y plan QA ../_dt/qa/inv-15-on/off.casos.md preparados por Director 2026-11-19 23:30. Lanzar SOLO en horario permitido.

## (HISTORICO) 18.2 CERRADO 69a9e05
- Commit producto **69a9e05** historial de conteos a demanda: 5archivos196 lineas; registro QA en commit docs. Ver AUTO-LOG 2026-11-19 Cierre18.2.
- QA inv-18-2-on PASA6/6 y inv-18-2-off PASA1/1; Director verificar-historial-arjun.cjs PASA (montaje sin accion, carga, teclado, offline/Reintentar, respuesta tardia otroSKU, 360, JS0).
- Fixtures historial: workspace Director preparar-historial-qa.cjs (solo5179/5180/5181 TEST). QA y verificacion agregaron versiones a5179 (81/82 A1F, 7 A2P); re-correr el preparador antes de reusar.
- **Sin codigo pendiente de commit. Sin Programador/QA activos; TEST apagado, flagsfalse, next-env restaurado.** Contador **2** slices desde inv-audit-17-3b-A.
- Siguiente: UsuariosR8 (crearUsuario/listarUsuarios auth dentro de accion). Contrato ../_dt/logs/inv-usuarios-auth-A.md + ajustes ../_dt/prompts/inv-usuarios-auth-ajustes-director.md. Preparar planQA y prompt BCD; no reabrir18.x.

## (HISTORICO) Punto de reanudación anterior — 18.1 CERRADO, siguiente18.2
Último commit producto **e09a114**, formato fecha/hora Chile y miles;57add+16del=73 incluyendoQA.
- Director34/34 propias, eslint6=0, tsc0/build0 (warningroot preexistente), diff6archivos revisado.
- QA inv-18-1-on PASA1/1/auditoría0/7imágenes; inv-18-1-off PASA1/1/auditoría0/3imágenes, sin defectos ni consola.
- Director verificar-formato-conteos-arjun.cjs PASA: listado/ficha fecha16-11-2026 hora23:30 autor,1280/360sin desbordes, cero frente a Sin contar, JS0. Miles148163->148.163 cubierto en unit; no se afirma fixturevisual con cantidadgrande.
- Hora compartida h23, medianoche00:05, inválida—; entradas numéricas/preview/packing/costos intactos. Se eliminaron2funciones localesduplicadas. Mismo formulario mantiene key usuario+SKU.
- **No código ni implementación pendiente de commit. No Programador/QA de esta sesión activos; TEST apagado, flagsfalse, next-env restaurado.**
- Última auditoría inv-audit-17-3b-A, contador **1** slice desde entonces (18.1). No push/deploy/reset/escriturasproducción.

### Primeros pasos de la otra IA
1. Confirmar git status/rama/HEAD reales y leer este documento + PRD/CLAUDE/BUGS/AUTO-LOG. No repetir17.3b ni18.1 ya cerrados.
2. Próximo **18.2 historial de conteos a demanda**. A ../_dt/logs/inv-18-historial-A.md, decisiones ../_dt/prompts/inv-18-decisiones-director.md. **Prompt BCD preparado ../_dt/prompts/inv-18-2-BCD.md, AÚN NO LANZADO.**
3. Antes de lanzarlo: redactar planQA18.2 (basado en los8casos delA, ajustando decisiones details nativo/sin dedupe innecesario), preparar solo fixturesTEST propios >=12versiones de5179 para paginación y un producto sinconteos. Nunca resetglobal ni baseproducción. El Director puede preparar fixtures fuera producto como los scripts existentes.
4. Lanzar Programador18.2BCD concontrato yplanQAaprobados porDirector, presupuesto<=196+QA4. Si no cabe, repartir porcontrato; nunca comprimir ni quitar riesgos. No aprobaciónhumana adicional.
5. Después verificaciónindependiente/tests/lint/tsc/build, Eaislado, reproducir mayor riesgo ycommitDirector. Actualizar este archivo/AUTO-LOG/contador.
Los contratos restantes de Usuarios/authproductos/imagen y backlog completo están abajo. No confundir esta preparación con trabajo ya implementado.

## Cierre anterior17.3b (referencia)
Commit c51cff5 integra formulario y búsqueda durante guardado:169añadidas+24eliminadas=193 líneas incluyendo QA. Ya NO hay código17.3b sin commit.
API lectura previa25262d0; checkpoint documental inicial3b69822.
Director:59/59 dirigidas del ajuste, eslint0, tsc0/build0 (warningroot preexistente), lectura diff9archivos180líneasproducto/tests.
Prueba real de respuesta perdida/replay/cambioSKU/borrador99 PASA con JS0: GET encuentra siguiente producto ANTES de liberar respuesta del conteo y el borrador nuevo conserva nonce/cantidad.
QA inv-17-3b-search-on PASA1/1/auditoría0/5imágenes; OFF inv-17-3b-off PASA1/1/auditoría0/5imágenes. Director reprodujo OFF: redirección /inventario -> /productos, ficha antigua/Historial/Editor presentes, sin formulario nuevo, JS0. Primer scriptOFF falló por comparar títulos sin considerar CSSuppercase; se corrigió solo script externo y pasó, no fue defecto de app.
D-20261118-SEARCH-PENDING ARREGLADO; P-20261118-1917-1 BACKLOG bajo (texto cantidad fuera de rango). Ver QA-REGISTRO y BUGS.
Flagfalse, next-env restaurado, TEST apagado. Ningún push/deploy/reset/escritura producción.

### Auditoría cerrada y siguiente acción
Auditoría readonly inv-audit-17-3b-A completada; informe ../_dt/logs/inv-audit-17-3b-A.md; decisión ../_dt/prompts/inv-audit-17-3b-decision.md.
Sin bloqueantes. Hallazgo flag/nextenv fue snapshot duranteQAON; Director verificó restauración y stage explícito antescommit. No refactor genérico storage ni cambio de motor compartido por estética.
Contador reiniciado0 tras5slices revisados; luego18.1 cerrado lo dejó en1.
18.1 ya cerrado e09a114; conservar su contrato como evidencia, NO volver a lanzarlo.
Plan QA18.1 ../_dt/qa/inv-18-1-on.casos.md. Después18.2historial y backlog completo abajo.
Comandos/tests/guardas y evidencias externas detallados en las secciones siguientes.

## Evidencia anterior de conteos (complementaria al cierre)
- inv-17-3b-on PASA8/8, auditoría0,11imágenes, JS0: cero;80+30=110; inválidos; borrador; conflicto2pestañas; logout; dobleclic123; actoradmin.
- Director82/82, eslint9/tsc/build0. Suite107files pass/2skip;954tests pass/8skip/0fail: verif-inv-17-3b-suite-completa.*.
- Director dos contextos/cuentas: conflicto50vs60/Seguir/Descartar/revisión explícita, B2 intacta, recarga15,123dobleclic1versión,360nooverflow/JS0 PASA.
- Low P-20261118-1917-1: entero12dígitos rechazado con texto poco preciso “ingresa un número entero”; no corrupción.
- OFF cerrado PASA1/1 + reproducción propia; casos ../_dt/qa/inv-17-3-off.casos.md.

## Comandos exactos
Carpeta externa: C:\Users\pablo\Documents\app-arjun-v2\_dt
Programador:
& "$HOME\.claude\pbravot\deep.ps1" -Repo <repo-real> -Name <nombre> -Fase A|BCD|DEBUG -Programador deep -Detach
Prompts ../_dt/prompts/<nombre>.md; esperar logs/<nombre>.done. -Resume sesión del done. No mutaciones simultáneas.
Tests:
& '..\_dt\pruebas-inventario.ps1' -Archivos '__tests__/uno.test.ts,__tests__/dos.test.ts'
OBLIGATORIO: helper quita solo3 env heredadas del PROCESO y setup carga URLs REALES de.env.local; verifica TEST!=prod. Nunca host ficticio/debilitar guardas. GEMINI_REAL=0/INVERSION_REAL=0 al suitecompleto.
Director build:
& "$HOME\.claude\pbravot\verificar.ps1" -Repo <repo-real> -Name <nombre> -Scripts typecheck,build -Detach
QA:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<_dt>\qa-ciclo-deep.ps1" -Repo "<repo-real>" -Name <nombre> -Casos "<_dt>\qa\<casos>.md" -Flags inventario_bodega
Usar Start-Process -WindowStyle Hidden; omitir Flags para OFF. Esperar qa-ciclo-<nombre>.done/APAGADO/flagsrestaurados ANTES propia reproducción.
Director navegador:
& '..\_dt\verificar-director.ps1' -Script verificar-conteo-respuestas-arjun.cjs
OFF: verificar-director-off.ps1. No competir con apagado QA; build antes de QA.
No credenciales en prompts/docs/logs. Cuentas sintéticas regeneradas ../_dt/qa/cuentas.json.

## Scripts, fixtures y respaldo
Workspace Director: C:\Users\pablo\Documents\Codex\2026-11-17\en-2\work.
Scripts: arjun-verificacion-base.cjs (guardas/login/SQLTEST), preparar-conteo-qa.cjs, verificar-conteos-arjun.cjs, verificar-conteo-respuestas-arjun.cjs, verificar-busqueda-guardado-arjun.cjs, verificar-api-busqueda-arjun.cjs, verificar-api-busqueda-off-arjun.cjs, verificar-busqueda-ficha-arjun.cjs, verificar-logout-borradores-arjun.cjs.
Imágenes arjun-conteo-integrado-movil.png y arjun-busqueda-con-guardado-retenido.png.
Únicos fixtures mutables conteoTEST5179 BASE,5180 PEND,5181 CERO. Preparador limpia solo sus conteos/restaura80/pendiente/0; no resetglobal. Diagnósticos dejaron17/18/123, resetpuntual antes QA si procede.
Read-only4951 UNO8 B1/B2,4952 DOS pendiente,4953 CERO0, no mutarlos.
Migraciones0001/RPC aplicadas SOLO TEST; NO producción.
Respaldos históricos externos ../_dt/handoff-2026-11-19/:17-3b-tracked.patch+2nuevos+SHA256 y18-1-tracked.patch+18-1-SHA256. Ambos YA están incorporados en commits: NO aplicarlos sobre HEAD actual.
Stash FREEZE80489094099d7b2a9e9fa841232c7d96cc45e79d YA reaplicado (anterior al ajusteGET); no aplicar otra vez.

## Arquitectura a conservar
Compras!=conteos. Append-only, última versión por posición; cero!=pendiente. Actor/fecha servidor, optimisticexpected+nonceidempotente+locksSQL. No escribir stocklegacy.
B1 A1–A4/FMP; B2 Arriba/Abajo+Izquierda/Derecha/FMP. MismoSKU múltiples posiciones/bodegas, manual.
Bodega por usuario/tab; borradores nonce/token; logout limpia. Async elimina solo nonceENVIADO, nunca borrador actual distinto. Key formulario usuario+SKU, no nonce/cantidad. Conflicto revisión explícita, noautosave; Descartar cierra panel.
DTO operador sin costos/nonce/ubicación librelegacy. Imagen no destruir antes de DB ni cloudVD externo.

## Backlog restante aprobado
-18.1 CERRADO e09a114; hora/miles/lista ya hechos. Sigue18.2; contratos de18.1 quedan como evidencia.
-18.2 CERRADO 69a9e05. (Era: historial lazy con details nativo, cursor/mounted/error/retry, keyhistorial versiones sin cambiar keyform. Estimaciónoriginal205rechazada; simplificar estados, no quitar riesgos.
-UsuariosR8: crearUsuario/listarUsuarios sin auth dentroacción; actoropcional y returninghash. No explotaciónHTTP afirmada. inv-usuarios-auth-A.md / inv-usuarios-auth-ajustes-director.md listos. Limpieza solo propios, no %test-% global.
-AuthWRITEproductos/PATCH, alias/packing/observaciones; ocultar campo ubicaciónlibreON. Contratos inv-15-B.md / inv-13-lectura-A.md.
-Imagen uploadprimero->CAS DB->cleanupviejo bestEffort; fallo/race limpia nuevo; proteger cloudexterno VD. Integrar editorficha.
-Creación manual/histórico/ARJ e identificadorfoto directoaficha sin Entradas.
-Apagar rutas/acciones/synclegacyON reversiblemente, excepción /entradas/identificar.
-Compras ledger/catálogo/fotos/packing/costos: ACTUALIZAR y automáticoindependiente, lease/concurrencia/idempotencia/watermarkmonotónico; no conteos automáticos ni pisarcamposmanuales; unknownGL no descarta compra.
-GLP/GL2->B1 y GL1->B2 reactivable flagfalse, solo sugerencia sincontextomanual; no pisarubicación/conteos.
-Inversión por últimosconteos y compraselegibles asofcadaconteo, futurasno revalúanviejo. Lotes nodobleusoentreposiciones ordenconteofechaASCdeterminista; remanente usa compras elegibles más recientesprimero (reglaexistente). Faltacosto!=costo0.
-Tablaúnica togglevaloresadmin; imagenprimera56, CostopromantesValor, Saldo, quitar3métricas. Operador nunca recibecostos; avisos comprasposteriores/fechasmixtas.
-CA12 conservarfiltro/búsqueda alvolver, no inventar scroll. refQarrays validar; términopresentealEnviar; foto56/404localizado/retorno/accesodenegado.
-Release benchmarkSQLvolumenrepresentativo, lintglobal45erroresbaseline/rootwarning, audit/QAbarrridocompleto/UATPablo/Señal3. Resetfinalsolo respaldoygateconcretos.
Últimoaudit inv-audit-17-3b-A, decisión inv-audit-17-3b-decision.md; contador1 tras18.1.
**Sin deploy/push/reset ni escrituras de producción. Al reanudar verificar flagsfalse y puerto3123 libre.**
