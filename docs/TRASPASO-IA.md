# Traspaso Arjun — vigente 2026-11-19

Leer este archivo, PRD.md (cabecera vigente), docs/plan-inventario-aprobado.md, CLAUDE.md, BUGS.md, QA-REGISTRO.md, AUTO-LOG.md y archivos reales. Este estado prevalece sobre los estados HISTORICOS de CONTEXT-CLAUDE-CHAT.md.

## Ubicación, autorización y límites
- Repo REAL: C:\Users\pablo\Documents\app-arjun-v2\app-arjun-v2 (doble carpeta), rama feat/inventario-bodega.
- GO de Pablo para todo el rediseño. DeepSeek aprobado para Programador y QA separado. Sonnet agotado hasta Nov21 01:00 Chile según última respuesta; verificar vigencia si se intenta después.
- pBravoT: Director NO escribe producto ni tests; Claude Code headless los escribe. A aprobado por Director -> B rojo -> C -> D -> verificación propia -> E aislado -> commit Director. Máximo200 added+deleted incluyendo tests/untracked/movimientos, reservar QA4.
- NO push/deploy/reset real: falta UAT Pablo y Señal3. Vida Digital READ ONLY. Nunca drizzle-kit push (drift constraint puede truncar users).
- Flags inventario_bodega:false, asignacion_bodega_compra:false. Activación solo temporal QA y restaurar.
- No pedir nuevas aprobaciones por fases rutinarias. Seguir backlog aprobado hasta UAT; solo gates humanos reales.

## Punto exacto
Último commit producto cerrado25262d0 (API lectura GET); anterior docs a90ee5b / puente2626699.
**17.3b está implementado SIN commit/cierre. Preservar el árbol de trabajo.**
7 modificados:
components/inventario/BuscadorInventario.tsx; lib/inventario/conteos.ts;
app/(dashboard)/productos/[id]/page.tsx y FichaProducto.tsx;
__tests__/inventario-buscador.test.ts, inventario-conteos-action.test.ts y productos-ficha-lectura.test.ts.
2 NUEVOS: components/inventario/FormularioConteo.tsx y __tests__/inventario-formulario-contenedor.test.ts.
Informe Programador:180 added+deleted, Director debe contar otra vez.
Integra formulario antes de metadatos, key usuarioId:productoId, revalida cache solo éxito/replay, cierra VerTodas.
Ajuste último: sugerenciasGET exportada usa GET independiente; NO modifica motor compartido.

## Bug abierto y siguiente acción
D-20261118-SEARCH-PENDING (media), QA-REGISTRO y BUGS.
Director retuvo respuesta de conteo DESPUÉS de commit TEST: búsqueda ServerAction esperando; al liberar empieza búsqueda. Causa confirmada Next16 node_modules/next/dist/client/components/app-router-instance.js104-160 (cola serial).
Primera hipótesis confirmada, ningún fix fallido aún; cambio GET evita cola.
- API25262d0: route42 + test136 + QA/BUGS16 =194. Auth ID numérico -> flag -> query única q trim1..100 -> listarInventario fijo12. Sin costos/nonce/nextCursor; no-store; error genérico.
- Director API52/52, eslint0, tsc/build0 (warningroot baseline); QA inv-17-search-api-on PASA1/1/auditoría0/4imágenes. Director HTTP real auth/anon bloqueado/query400/stock8/no-store y OFF404 PASA. GET aún sin caller durante ese QA.
- Programador inv-17-3b-search-BCD terminó exit0; sesión a029acd7-5fbb-4673-a541-bbfa28b195b5; informe ../_dt/logs/inv-17-3b-search-BCD.md.
- **Falta Director tests/lint/tsc/build del ajuste, reproducción real tardía y QA afectada. No declararlo cerrado por verde del Programador.**

Pasos exactos:
1. Leer diff real, propios tests dirigidos de b+API+hooks, eslint, tsc/build; entorno TEST estricto.
2. Repetir work/verificar-busqueda-guardado-arjun.cjs: coincidencia debe aparecer ANTES de liberar.
3. Repetir work/verificar-conteo-respuestas-arjun.cjs: respuesta perdida tras servidor recibió -> Reintentar sin duplicados; pausar otro conteo -> buscar/abrir siguienteSKU -> escribir99 -> liberar viejo ->99/nonce nuevo conservados y SOLO borrador enviado eliminado.
4. Fallo -> diagnosticar causa antes nuevo fix, no parchear Next.
5. QA afectada código/descripción desde ficha, SKU/B2, VerTodas,360; OFF1 caso preparado. Conteos8casos ya pasaron ANTES ajuste.
6. Resolver bug solo con evidencia; low de cantidad enorme puede BACKLOG. Commit explícito9archivos+QA <=200.
7. Actualizar este archivo/context/AUTO-LOG. Auditoría tras cerrar b (5slices), luego18.1/18.2/backlog.

## Evidencia anterior de conteos (no confundir con ajuste posterior)
- inv-17-3b-on PASA8/8, auditoría0,11imágenes, JS0: cero;80+30=110; inválidos; borrador; conflicto2pestañas; logout; dobleclic123; actoradmin.
- Director82/82, eslint9/tsc/build0. Suite107files pass/2skip;954tests pass/8skip/0fail: verif-inv-17-3b-suite-completa.*.
- Director dos contextos/cuentas: conflicto50vs60/Seguir/Descartar/revisión explícita, B2 intacta, recarga15,123dobleclic1versión,360nooverflow/JS0 PASA.
- Low P-20261118-1917-1: entero12dígitos rechazado con texto poco preciso “ingresa un número entero”; no corrupción.
- OFF aún no ejecutado: ../_dt/qa/inv-17-3-off.casos.md.

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
Respaldo b: ../_dt/handoff-2026-11-19/17-3b-tracked.patch +2untracked +SHA256.txt. NO aplicar sobre árbol ya modificado.
Stash FREEZE80489094099d7b2a9e9fa841232c7d96cc45e79d YA reaplicado (anterior al ajusteGET); no aplicar otra vez.

## Arquitectura a conservar
Compras!=conteos. Append-only, última versión por posición; cero!=pendiente. Actor/fecha servidor, optimisticexpected+nonceidempotente+locksSQL. No escribir stocklegacy.
B1 A1–A4/FMP; B2 Arriba/Abajo+Izquierda/Derecha/FMP. MismoSKU múltiples posiciones/bodegas, manual.
Bodega por usuario/tab; borradores nonce/token; logout limpia. Async elimina solo nonceENVIADO, nunca borrador actual distinto. Key formulario usuario+SKU, no nonce/cantidad. Conflicto revisión explícita, noautosave; Descartar cierra panel.
DTO operador sin costos/nonce/ubicación librelegacy. Imagen no destruir antes de DB ni cloudVD externo.

## Backlog restante aprobado
-18.1 horaChile compartida/miles/listafecha+hora: prompt inv-18-1-BCD.md listo; decisiones inv-18-decisiones-director.md; A inv-18-historial-A.md.
-18.2 historial lazy con details nativo, cursor/mounted/error/retry, keyhistorial versiones sin cambiar keyform. Estimaciónoriginal205rechazada; simplificar estados, no quitar riesgos.
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
Últimoaudit inv-audit-17-3a1-A, decisiones inv-audit-17-3a1-decision.md. Contador4:70fd805,5988073,2626699,25262d0; trasb5->auditar.
**Sin deploy/push/reset ni escrituras de producción. Al reanudar verificar flagsfalse y puerto3123 libre.**
