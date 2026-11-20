# AUTO-LOG — app-arjun-v2

## 2026-11-18 — inv-13.1 ficha nueva de lectura cerrada
- Commit b9bd56e, 192 lineas de codigo/pruebas. Rama ON en /productos/[id] usa DTO seguro, muestra posiciones B1/B2 con cantidad/fecha/hora/usuario, datos y foto readonly; OFF conserva ficha anterior. No se conectan editores hasta endurecer escritura e imagen.
- Director verifico ROJO4/1 y agrego condicion de fallo DB: ROJO1/5, corregida con aviso recuperable y enlace al inventario, sin capturar notFound ni filtrar SQL. VERDE propio40/40, typecheck/lint0, build0 (aviso root baseline). Fuente y DTO revisados.
- QA DeepSeek inv-13-on PASA3/3; hallazgo bajo guia cortada corregido y reprueba inv-13-fix PASA1/1; inv-13-off PASA1/1. Director reprodujo datos/fecha23:30/autor y estados dual-pendiente-cero a1280/360, overflow0 y erroresJS0. Herramienta propia ajustada a etiquetas CSS en mayusculas; datos y asserts de privacidad conservados.
- Hallazgo 404 ingles BACKLOG en BUGS (variante preexistente); consola404 por ID deliberadamente invalido DESCARTADO como respuesta correcta. QA-REGISTRO/BUGS se versionan en este cierre documental para conservar toda evidencia sin superar presupuesto de codigo.
- TEST detenido, flagsfalse, sin reset/push/deploy. Siguiente inv14 guard lectura vieja+GET API seguro; primero ramaUI ya lista para no romper caller. Contador2 desde auditoria11.

## 2026-11-18 — inv-12 inicio y encabezado cerrado
- Commit acd1ba7, 200 lineas totales con QA on/off. Inicio centrado en busqueda, encabezado sin sidebar legacy, buscador permanente en interiores, selector de bodega por usuario y logout con limpieza. Enter/Buscar navegan sin recargar documento; clic fuera cierra coincidencias.
- Director reviso diff, ejecuto 33 pruebas dirigidas y suite completa. Primera suite: cinco fallos por mocks antiguos que activaban todos los flags. Causa comprobada, dos mocks delimitados al flag correspondiente sin debilitar permisos: 31/31 propias y suite final 849 pass, 8 omitidas, 0 fallos. Typecheck/build correctos (aviso root baseline), lint tocados0 sin nuevas supresiones.
- QA DeepSeek inv-12-on PASA4/4, inv-12-off PASA1/1; sin hallazgos/errores de consola. Confirmados busqueda ficha->ficha, Enter/Buscar, bodega persistente, logout limpia seleccion, Usuarios admin y modo anterior.
- Director reprodujo en build local con DB TEST y sessionStorage global bloqueado: mismo documento y Bodega2 durante enlaces/Enter/Buscar, blur cierra y movil360 sin overflow; 0 errores. En dev se identifico por trazas un fallo de Next persistDebugChannelToSessionStorage; no se cambio producto ni dependencia, se verifico la compilacion que no incluye ese canal de depuracion.
- Harness temporal qa-compilado-local.ps1 conserva guardas, restaura bytes de qa-entorno.json y entorno; sin cambio persistente de config. TEST detenido, flagsfalse. Sin reset/push/deploy.
- Siguiente inv13.1 ficha nueva solo lectura primero, despues guard/API lecturas y authWRITE. Director rechazo diferir caller roto: getProducto guard NO se agrega antes de bifurcar la ficha. Borradores inv09 pendientes antes de formulario de conteo. Contador auditoria1.

## 2026-11-18 — inv-11 listado responsive cerrado
- Commit c1f57a3, 192 lineas incluyendo QA on/off. Lista con imagen, codigo, ubicacion y stock; tarjetas verticales en movil, fechas Chile, cero distinto de pendiente y paginacion validada.
- Director comprobo ROJO y corrigio expectativas de fixture UTC y escape HTML antes de implementar. Revision posterior detecto estado vacio y filtro activo ausentes: ROJO propio 2/8, correccion y VERDE propio 14/14. ESLint0, typecheck0, build0 (aviso root baseline).
- QA DeepSeek inv-11-on PASA 3/3, inv-11-off PASA 1/1, sin hallazgos ni consola. Director reprodujo 5+3=8, cero y pendiente a 1280/360 px; scrollWidth coincide con ancho, cursor invalido rechazado, sin errores de pagina. Capturas revisadas. TEST detenido y flags restaurados a false.
- Siguiente inv-12 shell/inicio con buscador permanente. Sin reset, push ni deploy.

## 2026-11-18 — Auditoria post cinco slices (inv-06/07/08/10/11)
- inv-audit-11-A completada, sin bloqueantes para integrar shell/inicio. Director reviso hallazgos y fuente.
- Antes de UAT: medir consulta con volumen representativo en TEST y corregir formato de miles es-CL en stock. No crear indices sin evidencia. Fecha: cachear Intl es opcional y no se prioriza.
- Buscador: cierre por clic fuera se integra con shell; flechas/combo completo queda para revision UX posterior si procede. No quitar packing/observaciones del DTO compartido que necesita ficha.
- Contador reiniciado a 0. Los riesgos legacy de auth/editor/foto/costos siguen registrados para antes de integrar ficha nueva; no se activa el modo global hasta terminar backlog/UAT.

## 2026-11-18 — inv-10 buscador reutilizable cerrado
- Commit c5b746c; 196 lineas totales con tests y registro QA. Buscador por codigo, alias y descripcion, resultados directos, estados de error/vacio/cero, debounce y proteccion ante respuestas antiguas. Componente preparado para integrar en lista e inicio.
- Director verifico ROJO 9 fallos/3 verdes, reviso diff y ejecuto 21/21 pruebas propias. ESLint y typecheck sin errores; build correcto con aviso root ya registrado. Exigio reducir boilerplate del test sin quitar casos, mostrar cero explicitamente y usar Next Link para conservar navegacion interna.
- QA DeepSeek inv-10 PASA 1/1, sin hallazgos ni errores de consola. Director repitio acceso de operador y ficha QA-INV-DIRECTOR-CERO, sin guardar datos. Entorno TEST detenido y restaurado.
- Siguiente inv-11 lista responsive, contrato y QA on/off preparados. Inv-12 integrara shell e inicio; agregar submit interno del buscador en ese contrato. Inv-09 borradores pendiente tras primer UI visible. Contador de auditoria: 4. Sin reset, push ni deploy.

## 2026-11-17 — inv-08 bodega de trabajo cerrado
- Commit076f772, 194lineas incluidoQA. Store sessionStorage/memoria por usuario, snapshotSSRnull, API de seleccion/limpieza compartida, storage denegado sin perder seleccion en memoria.
- Director reprodujo ROJO inicial y dos desvios del contrato (API incompleta y limpieza que no borraba clave remanente con snapshotnull); pruebas adicionales ROJO2/7 y correccion minima. Rechazo supresion nueva de ESLint y pidio prueba SSR sin mutacion global, conservando cobertura.
- VERDE propio9/9, eslint0 sin supresiones, tsc0/build0 (aviso root baseline); diff revisado. QA DeepSeek inv08 PASA1/1 sin hallazgos/consola. Director repitio operador->ficha TEST-UPD-001 y403Usuarios; entornoTEST detenido/restaurado.
- Siguiente inv10 buscador, contrato A aprobado con ajustes B; inv09 borradores puro tiene propuesta A lista, pospuesta hasta primer UI visible. inv11 A propone lista y despues shell/inicio con integracion. Sin reset/push/deploy. Auditcontador3.

## 2026-11-17 — inv-07 ficha e historial cerrado
- Commit d344898, 138 lineas incluyendo QA. Ficha por ID exacto, historial de todas las versiones paginado por ID, autor/fecha y DTO sin importes/nonce. Fixtures independientes del orden de tests.
- Director verifico ROJO inicial y detecto undefined admitido por filtro opcional; test adicional ROJO propio y correccion minima antes de cerrar. VERDE propio 26/26, eslint0, tsc0, build0 (aviso root previo). Revision completa del diff.
- QA DeepSeek inv-07 PASA1/1, sin hallazgos ni consola; Director reprodujo operador->Productos->ficha TEST-UPD-001 y403Usuarios. Entorno TEST detenido/restaurado. Sin reset/push/deploy.
- Siguiente inv-08 bodega de trabajo, contrato A aprobado con ajustes en prompt B. Contador audit2.

## 2026-11-17 — inv-06 listado seguro cerrado
- Commit8acd059, 199lineas incluyendoQA. Programador DeepSeek low. Lista por productoantesdejoin; arrayposicionesvigentes y stocknullpendiente/0contado, fecha/autorISO, cursorporIDestable; escape literal%/_/backslash y alias/descripcion; sin costos/nonce ni stocklegado.
- Director reviso ROJO moduloausente; pidio corregir determinismo IDs en fixtures concurrentes, TS/warning del testnuevo y erroressegurosespañol antescerrarD; agrego pruebasROJAS de parametros/SQLerror y limitecursorint4. No se eliminaron riesgos/casos.
- Evidencia propia 38/38 dirigidas consultas/action/modo, tsc0/lint0/build0 (aviso baseline root). Snapshot amplio previo inv-05 suite800/0+8skips. Diff/DTO revisados.
- QA DeepSeek inv-06 PASA1/1, auditoria0, 3imagenesvistas, USD0.5829, sinpendientes; Director repitio operador->ficha TEST-UPD-001 y403Usuarios, entornoTEST detenido/restaurado.
- Sin reset/push/deploy. Siguiente inv-07 ficha exacta porID e historialpaginado, contrato preparado.

## 2026-11-17 — Senal2 auditoria post inv-05
- inv-audit-05-A (DeepSeek solo lectura): sin bloqueantes ni error de locks/concurrencia. Director reviso hallazgos.
- Helper de fixtures y simplificacion de catalogo son opcionales; no se hacen antes de UI. No eliminar checks Drizzle: espejo intencional para impedir drift. No renombrar guard de cinco callers por preferencia estetica.
- Riesgo de SELECT* en vista se evita en consultas/DTO nuevos con proyeccion explicita (sin idempotency_key). No hace falta modificar DDL ni aplicar migracion por eso.
- Contador reiniciado0. Siguiente contrato inv-06 listado SQL real TEST; ficha/historial/costos se agregan por contratos separados para presupuesto200.

## 2026-11-17 — inv-05 apagado reversible cerrado
- Commit920a5a6, 142 lineas incluyendo QA/tests. Programador DeepSeek low, contrato inv-05-B; sin desvios. Solo import+guarda antesDB y despuesauth en crearEntrada/Salida/Retorno/transferirEntreBodegas/crearAjuste; CTE y fixes fragiles imagen/packing/ajustes1punta intactos.
- FlagActivo acepta override server-only de claves conocidas exact true/false; unknown/prototype nunca enciende. FlagsJSONfalse intactos. Nuevo helper exige modo operativo anterior, no bloquea lecturas ni productos/fotos/usuarios/sync.
- Director ROJO9fallos/7pass antescodigo, VERDE suitecompleta800/0+8skips; eslint8archivos0, tsc0, build0 (aviso baseline root). Diff comprobado lineaalinea.
- QA DeepSeek inv-05 PASA1/1, auditoria0, 4 imagenes vistas, USD0.5962, sin hallazgos; reproduccion propia operador->Productos->ficha TEST-UPD-001 y403Usuarios. Entorno detenido/restaurado, sin reset/push/deploy.
- Senal2: auditoria inv-audit-05-A en curso (sololectura) antes de siguiente slice; contador5. Contrato de consultas se decide con resultado.

## 2026-11-17 — inv-04 action autentica cerrada
- Commit 6ed7981, 186 lineas total incluyendo QA. Programador DeepSeek low, contrato inv-04-B; sin desvios salvo quitar 2 warnings unused del test sin cambiar casos (autorizado Director).
- registrarConteoSchema estricto y action auth->flag->validacion->una sentencia SQL; user de sesion, timestamp DB, nonce prefijado por usuario; DTO seguro; conflicto no reintenta automaticamente; errores fijos en español sin URL/credenciales.
- Director verifico ROJO moduloausente y VERDE38/38 pruebas dirigidas; tsc0, lintarchivostocados0, build0 (aviso baseline root). Revision propia del diff y guardas/payloads.
- QA DeepSeek inv-04 PASA1/1, auditoria0, 2 imagenes vistas, USD0.5354, sin hallazgos. Director repitio operador->ficha TEST-UPD-001 y403Usuarios en navegador TEST; entorno detenido/restaurado.
- Sin reset/push/deploy. Siguiente inv-05 guardas de mutaciones anteriores y overrides seguros de flags. Al conectar UI agregar invalidacion/refresco de listado/ficha/historial segun decisionesDirector.

## 2026-11-17 — inv-03 guardado atomico cerrado
- Commit aef0817, 179 lineas totales incluido test y QA-REGISTRO. Programador DeepSeek low, sin desvios.
- Funcion PG VOLATILE/security invoker con locks de idempotencia y posicion; valida replay/usuario/payload, devuelve conflicto para version vieja y conserva historial; no toca stock/movimientos. SQL aplicado solo TEST.
- Director reviso diff y ROJO real; suite completa 768 passed, 8 skipped, 0 fallos; lint test0, tsc0, build0 (aviso baseline root). Pruebas nuevas incluyen dos carreras reales simultaneas.
- QA DeepSeek inv-03 PASA1/1, auditoria0, 2 imagenes vistas, USD0.5242; Director repitio operador->Productos->ficha TEST-UPD-001 y bloqueo403Usuarios; captura work/arjun-inv03-director.png inspeccionable. Hallazgo bajo wildcard de buscador viejo queda BACKLOG para nuevo buscador.
- Entorno QA detenido/restaurado, sin reset/push/deploy. Siguiente inv-04 action autenticada y DTO. Sonnet sin cuota; se mantiene DeepSeek disponible para poder continuar tambien al entrar en horario peak.

## 2026-11-17 — inv-02 persistencia de conteos cerrada
- Commit: a9c38e3.
- Programador DeepSeek low. Contrato inv-02-B y revision Director. Tabla/view append-only, CHECK/FK/unique y catalogo previo coherentes; codigo de producto en db/schema.ts y migration0001.
- Director verifico ROJO por archivo ausente, reviso y pidio corregir aislamiento de fixtures y guardia antesDDL; alineo NOT NULL y nombre constraint SQL/Drizzle con prueba ROJA de metadata antes del ajuste. Ajustes puntuales SOLO en TEST, sin DROP ni tablas antiguas modificadas.
- Evidencia propia: 14/14 inventario, 10/10 schema anterior; tsc0, eslint tocados0, build0 (solo aviso baseline turbopack.root). Diff revisado, ~188lineas incluido registro QA.
- QA DeepSeek inv-02 PASA 3/3, auditoria0, 8 imagenes vistas, USD1.0199; Director reprodujo permisos de operador y Productos en navegador TEST. EXP-5 baja 404ingles preexistente queda BACKLOG; sin pendientes altos.
- Sin reset de datos reales, sin push/deploy. Entorno QA apagado. Siguiente inv-03 guardado atomico/idempotencia/conflictos.

## 2026-11-17 — inv-01 cerrado con QA DeepSeek autorizada
- Pablo autorizo DeepSeek como QA independiente con acceso solo al navegador. Wrapper externo ../_dt/qa-ciclo-deep.ps1; copia de qa-ciclo mantiene guardas/auditoria/repruebas y pasa -Programador deep al subproceso. Primer intento de wrapper no propago parametro; corregido sin tocar herramientas globales.
- Commit: 61d5929. 166 lineas totales incluyendo QA-REGISTRO, tests y contrato/flags. Programador deepseek-flash low, QA deepseek-flash medium en sesion nueva sin herramientas de codigo/archivos/terminal/JS.
- Verificacion Director: 6/6, tsc/lint tocados/build OK; regresion operador en navegador TEST confirmada y captura inspeccionada.
- QA inv-01-deep2: PASA 3/3, auditoria 0 problemas, 11 imagenes vistas, costo USD0.9249. EXP-1 baja preexistente BACKLOG; /inversion 404 DESCARTADO (ruta inventada por QA). Sin pendientes altos. Sin desvio del Programador.
- Sin push/deploy/reset. Entorno detenido y next-env.d.ts restaurado. Siguiente inv-02 persistencia de conteos.

## 2026-11-17 — GO inventario, inv-01 pendiente de QA externa
- Rama: feat/inventario-bodega. Commit de alcance/documentacion: f0a5c37.
- Programador DeepSeek deepseek-flash low; contrato del Director en ../_dt/prompts/inv-01-B.md.
- inv-01: contrato Zod de las 24 posiciones, etiquetas y claves; flags inventario_bodega y asignacion_bodega_compra false. Sin UI, DB ni produccion modificadas.
- Evidencia propia ROJO por modulo inexistente y VERDE 6/6; eslint de ambos archivos 0, tsc 0, build 0. ~154 lineas totales; diff revisado. Baseline previo 746 passed, 8 skipped; lint global 45 errores y advertencia turbopack.root preexistentes, pendientes antes release.
- QA Fase E: dos intentos INVALIDO, costo 0; causa externa verificada en qa-inv-01.json: API 429, limite semanal de Claude, reinicia Nov21 01:00 America/Santiago. No se ejecutaron casos, NO es PASA ni defecto demostrado de app.
- Comprobacion adicional del Director con navegador aislado TEST: operador entra a Dashboard, no ve Usuarios/Inversion, /usuarios responde 403 y Productos carga. Captura fuera del repo en chat work/arjun-inv01-director.png. No sustituye QA de Sonnet requerida.
- Gate: requiere disponibilidad de Sonnet o autorizacion de Pablo para proveedor alternativo de QA. No commit del codigo inv-01, no push/deploy, no iniciar slice siguiente hasta cerrar Fase E. No se llamaron servicios de pago ni se resetearon datos reales.
- Auditoria inicial inv-plan-A completada: hallazgos de limpieza opcional, ninguno obliga a refactor previo. Decisiones tecnicas en ../_dt/prompts/inv-decisiones-director.md. Prompt inv-02-B preparado, NO lanzado.

## 2026-11-11 (noche) — Cierre de QA: 19 defectos + humo de produccion sin IA
- Commits locales SIN push (8): 1b99433..e0c1f73. El push a main despliega en Vercel: espera Senal 3 (UAT de Pablo).
- e0c1f73: 19 defectos de la Fase E corregidos con causa raiz (detalle en el mensaje del commit y en QA-REGISTRO.md).
- Verificacion: tsc OK, lint 45 errores = baseline, build OK, suite completa 733/0, QA desde afuera fix-noche2 8/8 y fix-noche3 2/2.
- QA-REGISTRO.md: 0 pendientes abiertos. BACKLOG: imagenes faltantes en Cloudinary (datos), lentitud de busqueda
  (diagnosticada, medir en prod), columnas Entro/Salida/Saldo sin ajustes ni transferencias (decision de Pablo).
- Humo en produccion: humoProd cubre las 12 pantallas (incluida /entradas/identificar); permitirPost incluye /usuarios.
  Hoy en produccion falla solo por lo que arregla e0c1f73 (menu Usuarios, manifest): pasara despues del deploy.
## 2026-11-11 - Slice: animacion mientras se identifica el producto por foto
- Programador: deep (deepseek-flash, effort low), 106 s, 0,80 USD
- Contrato: rayo laser verde (#39ff14) sobre la foto + spinner + contador "Llevamos N s · puede tardar hasta 45 s"; respeta prefers-reduced-motion. Archivos: IdentificarProducto.tsx, globals.css, identificacion-ui.test.ts
- Tests: 4 nuevos (rojo 4/23 -> verde 23/23); tsc 0; eslint de archivos tocados sin errores; build 0
- Commit: e7cb99b
- Gates disparados: ninguno (falta UAT de Pablo antes del push que despliega)
- QA (Fase E): PASA, 2/2 (animacion-identificar-3); verificacion propia del Director con Playwright: laser se mueve, contador avanza, todo desaparece al terminar
- Desvios del Programador: ninguno
- QA métricas: FP 0, ESC 0, ACIERTOS 0, costo 0,21 USD (+2 corridas fallidas por QA: sesion de Claude vencida y subida de archivos); mejoras de QA aplicadas: semilla 9d86792

## 2026-11-18 — inv-14 lectura segura cerrada
- Commit892f7e1,156lineas incluido tests/QA. Programador DeepSeek: getProducto corta antesSQL si modoON; GET auth->IDvalidado->DTO inventario sin costos ni estructuraslegacy. OFF conserva fuente anterior; PATCH intacto para contrato authWRITE.
- Director verifico ROJO4fallos/2pass, VERDE26/26 en5archivos, eslint3archivos0, tsc0/build0 (advertencia baseline root pendiente). Revision propia completa del diff sin desvios.
- QA DeepSeek ON2/2 y OFF1/1 PASA, auditorias0,7imagenes vistas; Director reprodujo API200stock8/ID400/ausente404, ficha1280/360 sin overflow, bodega2 persistente, dual/pendiente/cero, erroresJS0. Foto movil revisada.
- EXP BOM descartado tras bytes404 reales comienzan123(llave), sin prefijo; HTTP400/404 de IDs invalidos esperados no son erroresJS. Tres pendientes QA cerrados con evidencia.
- Flags false restaurados, TEST detenido, sin reset/push/deploy. Siguiente inv09 helperborradores con noncecondicional para evitar respuesta antigua borre intencion nueva. Auditcontador3 desdeinv11.

## 2026-11-18 — inv09.1 validacion borradores cerrada
- Commit0bfe23e,132lineas incluidos QA/tests. Contrato09-A se partio tecnicamente para cumplir200 sin recortar riesgos (B completo proyectaba245-255).09.1 tipos/schema/cantidad/clave;09.2 operaciones; alcance aprobado intacto.
- Programador DeepSeek, diffpropio sin desvios. Director ROJO moduloausente; VERDE32/32 ubicaciones+validacion, eslint2archivos0, tsc0/build0 (rootwarning baseline). Cero no equivale a vacio; rechaza decimal/signo/miles/exponente/overflow y JSONfueraformato; catalogocerrado.
- QA DeepSeek inv09-1 PASA1/1, auditoria0,3imagenesvistas, sin hallazgos. Director reprodujo fichaUNO->buscarDOS->Sincontar sinrecarga, B2preservada,1280/360sin overflow, erroresJS0. Solo lectura, helpers sincaller todavia.
- TESTdetenido/flagsfalse restaurados. Sin reset/push/deploy. Contadoraudit4. Siguiente09.2; tras cerrar auditar antes16store. Contrato16A listo ../_dt/logs/inv-16-A.md: store, luego hook/logout. QA no puede DevTools: alintegrarlogout preparacioncorresponde Director y agente solo observa UI.

## 2026-11-18 — inv09.2 operaciones borradores cerradas
- Commit63e65fe,194lineas incluyendoQA, source90/test100. Programador DeepSeek, helper inmutable sinIO/caller: mismotexto conserva referencia/nonce/expected/tiempo; editarrotaUUID sinreemplazarexpected; descarte selectivo con nonceopcional evita respuestaantigua borrenuevaintencion. ConsultasporSKU ybodega manual ordenfechaDESC/claveASC.
- Director detecto ycorrigio viaProgramador contradiccion deltest noUUID: mismo textono llamafactory, caso pasa a texto2nuevo antesC. ROJOpropio6/6 funcionesausentes; VERDE38/38 en3archivos; eslint2archivos0, tsc0/build0 (rootwarning baseline), diffpropio completo. Validacion09.1 preservada.
- QADeepSeek inv09-2 PASA1/1, auditoria0,3imagenesvistas; observacionretornocorrecto marcadaEXP fue DESCARTADA por no describirdefecto. Director reprodujo buscarUNO->DOS sinrecarga, bodega2,1280/360sin overflow, dual/pendiente/cero yJS0.
- TESTdetenido/nextenvrestaurado/flagsfalse. Sinreset/push/deploy. Auditcontador5: inv-audit-09-2-A en curso (sololectura) antes16. Contrato16-A store y16-B hook/logout aprobado en principio, pendienteaudit; prompt16-1-B preparado, aunNOlanzado. Sin UI de captura todavia.

## 2026-11-18 — Auditoria Senal2 inv-audit-09-2-A
- Sin mustfixantes16. Director valido codigo/callers; contadorreiniciado0 tras5slices (12,13.1,14,09.1,09.2).
- Hallazgo1 confirmado BuscadorInventario Link Ver todas sin onElegir: registrar BUGS para fixpequeno antescerrarUIconteo. RutaslegacyON pendiente conocido seapaga en contratoantesrelease, no regresionnueva.
- Hallazgo2 DESCARTADO en su premisa: SI existe proxy.ts Next16, todasrutas no publicas sin sesion redirigen/login antespage. Director leyo proxy/matcher ycorrio pruebasproxy9/9. El guardconsulta sigueprotegido; no afirmar ausencia middleware ni dataleaklegacy por esa observacion. Sesionexpiradaentrechecks puede ofrecererrorrecuperable sin datos; no requiere cambio parasiguiente16.
- Hallazgo4 catchfactorySTORE yaexigidoenprompt16-1-B (null/noefecto, testthrows). Hallazgo5: todo descarte por exitoasync DEBE nonceenviado; parametroomitido solo descarteexplicito usuario, no limpieza porrespuesta. Cubrir enstore/UI.
- refQarrays sevalidaran junto rutas/listadoantesUAT. CacheIntl opcional. Baseline lint45/rootwarning y rendimiento/formatomiles/fechahora enlista siguenpendientesantesrelease. Auditoria no ejecuto DB ni QA; sololectura. Director no adopta estimacion de usuarios como dato verificado.
- Proximo16.1 store sinReact, luego16.2hook/logout. B16.1 autorizado seguncontratoA y prompt16-1-B. Sinreset/push/deploy.

## 2026-11-18 — inv16.1 store borradores cerrado
- Commit1a3d1dc,199lineas incluidoQA: source73/test122. Programador DeepSeek, soloajuste tipadofixtures deltest; sourcehelperprevio intacto. Store porUIDtrim/tab, saneoJSON/clavesexactas/proto/extra, memoriaautoritaria con persistenciabestEffort, tokensgeneracionlimpieza y suscripcionaislada.
- Director ROJO moduloausente, VERDE50/50 en4archivos, eslint2archivos0, tsc0/build0(rootwarningbaseline). Diff/test completos revisados. Mismotextonopersistenonotify; factorythrowsretornanull; tokenviejo nopersiste/notifica/borra ni resucita despueslimpieza. Nonceviejonoborranuevaintencion; mapaactualusado sin snapshotcapturado.
- QADeepSeek PASA1/1, auditoria0,3imagenesvistas,sin hallazgos. Director repitio fichaUNO->buscarDOS sinrecarga, bodega2,1280/360sin overflow, dual/pendiente/cero,JS0. Aun sincallerform; limpieza real viaUI llega16.2.
- Flagsfalse/TESTdetenido/nextenvrestaurado, sinreset/push/deploy. Contadoraudit1. Siguiente16.2hook/logout, Bpromptlisto ycasos QA16-2onpreparados. Luego17.1 logicaformulario: A17completo con ajustesDirector guardados inv-17-decisiones-director.md, no crear wrappersduplicados ni validar ubicacionestricta sobre DTOcompleto.

## 2026-11-18 — inv16.2 hook y cierre de sesion cerrados
- Commit ef5c2b5, 154 lineas incluyendo tests y QA. Hook reactivo por usuario, callbacks con token capturado y limpieza de borradores/bodega antes de salir; claves ajenas intactas. Sin formulario de conteo conectado todavia.
- Director verifico ROJO modulo ausente y borrador retenido; VERDE30/30 dirigidas +4/4 LogoutButton; tras ajuste de tipado/testlint repitio4/4 nuevos. Diff completo, eslint4archivos0, tsc0/build0 (warning root preexistente).
- QA DeepSeek inv-16-2-on PASA2/2, auditoria0,7imagenes revisadas,sin hallazgos. Director reprodujo logout/login y verifico claves borrador/bodega eliminadas, clave ajena intacta, reingreso sin bodega, stock8 sin cambios, movil360/JS0. Evidencia externa work/arjun-logout-borradores-movil.png.
- TEST detenido, flagsfalse/nextenv restaurados. Sin reset/push/deploy. Contadoraudit2. Sigue inv17.1 logica de formulario segun contrato A y ajustes Director; B preparado.

## 2026-11-18 16:56 — inv17.1 implementado, cierre pendiente por conectividad
- B inv-17-1-B completado; Director reprodujo ROJO16:44:46 modulo ausente. C/D inv-17-1-CD completo, contrato cuatro helpers sin callers. Codigo57+test122=179 lineas; ambos archivos nuevos SIN COMMIT hasta completar verificacion/QA.
- Director reviso codigo/test reales: proyeccion de4campos para posiciones, expected original del borrador, payload estricto, vacio!=0. VERDE49/49 en4archivos; eslint2archivos0; tsc0.
- Build inv-17-1 e inv-17-1-reintento FALLAN por next/font: Failed to fetch Inter from Google Fonts, no errorTS. Diagnostico propio: curl fonts.googleapis.com no resuelve host; Resolve-DnsName fonts.googleapis.com timeout con DNSnormal y1.1.1.1; hostname TESTNeon tambien timeout. No modificar red ni omitir guardas ni presentar buildverde.
- QA17.1 aunNOejecutada, casos preparados ../_dt/qa/inv-17-1-on.casos.md. No levantar TEST hasta resolver conectividad; entorno no iniciado, flagsfalse. No commit producto/push/deploy/reset.
- Proximo: recuperar conexion y repetir verificar17.1 (nombre nuevo), luegoQA y reproduccion propia verificar-busqueda-ficha-arjun.cjs; cerrar179+QAlineas<=200 ycontadoraudit3. Prompt17.2-B ya preparado pero NOlanzado. Contadoraudit sigue2 porque17.1 pendiente.

## 2026-11-18 17:12 — inv17.1 cerrado tras recuperar conexion
- Commit53fc2de,183lineas incluyendoQA/source57/test122. Sin desvio de contrato, cuatro helpers puros, sin callers todavia.
- DNS recuperado comprobado. Verificacion independiente inv-17-1-red-restablecida: tsc0/build0 (rootwarningbaseline). Director49/49 yeslint0 previos siguen validos, codigo sin cambios. Causa de dos builds previos fallidos confirmada conectividad externa, no codigo.
- QA DeepSeek inv17-1-on PASA1/1, auditoria0,7imagenesvistas, sin pendientes. Exploracion alias encontro producto correctamente, no defecto. Director reprodujo fichaUNO->buscarDOS sinrecarga, B2preservada, dual/pendiente/cero,1280/360sin overflow,JS0; captura movil inspeccionada.
- TEST detenido/flagsfalse/nextenvrestaurado. Sin reset/push/deploy. Contadoraudit3. Siguiente17.2 vista, B aprobado. RevisionA17.3 en curso readonly para presupuesto/callers/cache/tests.
- Fixtures propios nuevos SOLOTEST: QA-CONTEO-BASE5179 B1A1F80; QA-CONTEO-PEND5180 sinconteos; QA-CONTEO-CERO5181 B1A2P0. Preparador externo work/preparar-conteo-qa.cjs validaTEST!=prod y solo limpia estos3; ejemplosQA-INV-DIRECTOR intactos.

## 2026-11-18 17:30 — inv17.2 vista de formulario cerrada
- Commit8067ead,198 lineas totales: vista126/test64/QA4/BUGS4. Vista controlada, aun sin caller. Bodega manual, catalogo cerrado, ubicacion antes de cantidad, cero/ausencia distintos, comparacion con signo, borrador, pending, conflicto y mensajes accesibles; sin costos.
- Director reprodujo ROJO inicial modulo ausente17:15:17. Revision propia descubrio hora faltante, pattern nativo incompatible con espacios validos, signo positivo y cantidad habilitada sin posicion: contrato adicional aprobado, Programador ejecuto ROJO3fallos/4pasan antes C. Ajustes minimos con evidencia en inv-17-2-ajustes-BCD. Sin cambios fuera scope.
- Verificacion Director final18/18 dosarchivos, eslint2archivos0, tsc0/build0(rootwarningbaseline). Diff completo revisado. Verificacion visual externa SSR aislada PASA8 combinaciones (4estados x360/1280), sin desbordes; inspeccionadas capturas conflicto360/B11280. No se afirma interaccion ni guardado en esa vista aislada.
- QA DeepSeek inv17-2-on PASA1/1, auditoria0,7imagenesvistas; EXP1 baja a BACKLOG(BUGS): campo se limpia al enviar busqueda aunque filtro permanece correcto. Director confirma causa enviar->elegir->setQ; revisar junto retorno/filtros antes UAT. Sin pendientes altos. Director reprodujo busquedaUNO->DOS sinrecarga,B2,dual/pendiente/cero,360/1280JS0.
- TEST detenido/flagsfalse/nextenv restaurado. Sin reset/push/deploy. Contador audit4. Siguiente17.3a contenedor: B preparado y ajustes Director frente A revisado; no deferir riesgos lifecycle a tests posteriores. Integracion17.3b y QA8casos preparados. Fuente nueva solo Claude Code.

## 2026-11-18 17:50 — Reparticion de conexion 17.3 antes de implementar
- B17.3a produjo test296 y presupuesto431-446, Director rechazo C. Ademas detecto pruebas contradictorias: recuperarB1 tras editarB2 con unmanual; exigir no reguardarcanonico en submitconflicto; expectednull no montaba server9 real; mockeffect en cada render. No producto implementado ni commit de ese test.
- Copia externa ../_dt/prompts/inv-17-3a-B-prueba-no-aprobada.ts, A revisado logs/inv-17-3-particion-A.md. Particion natural aprobada: a1 hookedicion, a2 factoryenvioasync sinReact, a3 hookpuente lifecycle/conflicto, b contenedor/integracion. Cadauno<=200 incltests/QA, sin UI parcial ni callbacks dummy.
- Ajustes Director vinculantes prompts/inv-17-3-particion-ajustes-director.md: cambiarTexto guarda argumento t directo (evitar closurevieja); descartarEn3args estable/token para factory no funcion1arg; onstorefail preservartextolocalinclusotrasdescartede restaurado; controlador estableuseMemo para lock real, no crearporenvio/refduplicada; mensajeexito incluye ubicacion; lifecycle async no setState/refresh desmontado.
- Inv17-3a1-BCD lanzado, aun sin cierre. Programador autorizado a limpiar SOLOtest296untracked trascompararhashbackup y reemplazar por tests apropiados, no dejar importausente rompiendo tsc. Auditcontador4 sigue; audit despuesa1 preparado inv-audit-17-3a1-A.
- QA datos actualizados doccommitf7d6a9f para permitir SOLO fixtures5179/80/81 enconteosTEST; sin imagen/identificador ni otros productos. Planintegracion8casos yregresionOFF listos; Director script externo work/verificar-conteos-arjun.cjs preparado NOejecutado (UIaun sin integrar). No afirmar conteocompleto probado.

## 2026-11-18 17:58 — inv17.3a1 hook de edicion cerrado
- Hook80/test108/QA4 =192 lineas. Programador DeepSeek implemento sin caller/action/async/useEffect, usando3useState y hooks existentes. B ROJO modulo ausente con evidencia real; test296 rechazado eliminado tras verificarhash contra backup externo (ambos296lineas); no se commiteo ese borrador.
- Director reviso source/test completos: cambiarTexto guarda argumento t directo, expected draftnull se conserva con vigente9real, guardarBorrador retorna canonico ypreserva textolocal alfallar, descartarEn es bindingestable3args/token, bodegaunmanual sin defaults porSKU. ReporteProgramador escribe formula?? porerror, sourceREAL usa ternario draft?draft.expected:vigente?.id??null correcto; no aceptar prose sobre source.
- Director VERDE35/35 en4archivos, finalnuevo9/9 tras ajuste de formato/testcombinado, eslint2archivos0, tsc0/build0(rootwarningbaseline). No supresiones. Fuente compacta tipada legible consistente con repo, sin quitar riesgos. Uso maxWorkers2 para no multiplicar procesos al verificar.
- QA DeepSeek inv17-3a1-on PASA1/1, auditoria0,9imagenesvistas, sin hallazgos nuevos. Director reprodujo buscarUNO->DOS sinrecarga, B2preservada, dual/pendiente/cero,360/1280sin overflow/JS0; captura movil inspeccionada. No afirmar interfaz de edicion/conteo probada: hook aun sincaller.
- TEST detenido/flagsfalse/nextenvrestaurado. Sin reset/push/deploy. Contador audit5: ejecutar inv-audit-17-3a1-A antes a2. Prompt a2-BCD preparado, no lanzar hasta decidir audit. Sigue factoryasync/a3hookpuente/bintegracion, plan yajustes vigentes. QA8casos+OFF yscriptDirectorintegracion aun pendientes ejecutar.

## 2026-11-18 18:19 — Auditoria17.3a1 decidida y correccion cerrada
- Audit logs/inv-audit-17-3a1-A.md; decision vinculante ../_dt/prompts/inv-audit-17-3a1-decision.md. Mustfix de contrato futuro: revision manual descarta DRAFTACTUAL.nonce, successasync sigue soloSENTnonce; no modificarstore paraoverrideexpected. Inputs/selectores congelados durante panel, SeguirRevisando habilitaedicion; descartar delpanel deberacerrarconflicto en futurohook. Guardrevision cantidadnull ytest realstore exigidos.
- Fix commit70fd805,64lineas changed inclQA:3lineas funcionalesVista, prueba con STORE REAL ymodeloEdicion, retiroaridad/CSSmirror. B ROJO1falla/27pasan porinputhabilitado enconflicto; backboneSTORE yaVERDE antesC (correcto). Director comprobo diff/source y VERDE43/43 en5archivos, eslint4archivos0/tsc0/build0(rootwarningbaseline).
- QA inv17-3a1-audit-fix-on finalPASA1/1, auditoria0,6imagenesvistas. Primer arranque fallo por ConnectTimeoutNeon, wrapper repitio entorno+agent yse recupero; no confundir conregresion. Director verifico DNS/HTTPNeon yfontsrespondian; ownbusquedaUNO->DOS,B2,360/1280,JS0 PASA conentornorecuperado.
- Vista aislada Director PASA8estadosxanchos360/1280 sinoverflow; captura conflictomovil inspeccionada, unDescartar. No afirmar conexionUI deconteos aun.
- Audit4 hidratacion real se cubriraen17.3b con navegacioncompleta/restaurardraft, no mockSSRcomo cliente;5 keyfila.id obligatorio;6mirrorlimpio;8hora consolidarantesUAT;9colorinfo baja;10handlerdescartar seraen a3. Suposicionde carga deauditor NOadoptada comohecho; perfrepresentativo siguependiente.
- TEST detenido/flagsfalse/nextenvrestaurado, sinreset/push/deploy. Auditcontador reiniciado yfixcuenta1. A2-BCD listo para lanzar, sinmustfixque lo bloquee. A3promptyaajustado, bintegracionQA8casos+OFFyDirector pendientes.

## 2026-11-18 18:33 — inv17.3a2 envio seguro cerrado
- Commit5988073,144lineas incluidoQA: factory53/test87. SinReact/IOdirecto/caller. Lock sincrono ocupado antesawait, prepararConteo real, erroresfijos, conflicto seguro3campos, replay ylimpieza3args exactos. No cambia DB/flags/env.
- Director detecto lectura de borrador.nonce mutable despuesawait; contrato snapshot adicional, ROJO1falla/9pasan realantesfix. C usa payload.idempotencyKey enTODASramas ycleanup, no borradorref despuesasync. Testmutacionpending asegura soloSENTnonce. Source/test completos revisados.
- Director27/27 con guardas reales desde shellfresh, eslint2archivos0/tsc0/build0(rootwarningbaseline). Programador admitio usarhostficticio paraevitarconflictoenvheredado: practicaRECHAZADA porDirector, no se acepta esa verificacion deentorno. Own27/27 tambien con helper externo ../_dt/pruebas-inventario.ps1: elimina delPROCESOsolo3variablesheredadas ysetup cargalosDOSvaloresreales de.env.local yvalida separacion; no modifica envarchivos/guardas ni usa hostficticio. Obligatorio futuroProgramador. Testsdeestefactorysonpuros sinSQL.
- QA inv17-3a2-on PASA1/1/auditoria0/5imagenesvistas, sin pendientes. Primera reproduccionDirector coincidio conapagadoautomaticoQA ydio ERR_CONNECTION_REFUSED (nofalloapp). Director repitio conentornoPROPIOgestionado: PASA busquedaUNO->DOS sinrecarga,B2,dual/pendiente/cero,360/1280sin overflow/JS0; luego TESTdetenido/nextenvrestaurado.
- Flagsfalse, sinreset/push/deploy. Contadoraudit2. Sigue17.3a3-BCD hookpuente (promptconenvhelper ycurrentnonce/review yaajustado); despues b integracion. Scripts Director conteocompleto/respuestastardias preparados NOejecutados mientrasUI nointegrada.
- ContratoUsuariosAuthA revisado readonly; ajustes en ../_dt/prompts/inv-usuarios-auth-ajustes-director.md (SafeInteger, solofixturespropiosno %test-% global, DTOsinhash yQA sinDevTools). PendienteimplementarantesUAT, no tocarahora.

## 2026-11-18 18:52 — inv17.3a3 puente de envio cerrado
- Source69/test124/QA4=197lineas. Hook cliente enlaza Edicion/Factory con estado ycleanupmontado; controlador estableuseMemo descartarEn, sin refduplicado/readrefenrender. Reviewmanual descarta DRAFTACTUAL.nonce, crea esperado vigente conUUIDnuevo, noautosave; error/timeoutconserva; successasync cleanupSENTnonce incluso trasunmount y sin React/refresh desmontado. Descartarmanualcierra panel.
- B ROJO moduloausente; Director detecto replay sinmensaje diferenciado: testexistente repetidoTRUEsoloassertqty. AjusteB ROJO1falla/5pasan real, C una linea distingue ya registrado/guardado manteniendoubicacion. Testfalsereplay tambiencomprueba texto correcto. No recortar riesgos;6casosagrupados cubren guards/doubleclick/mounted/StrictMode/review/factoryreal.
- Director26/26 hook+factory+edicion, eslint2archivos0/tsc0/build0(rootwarningbaseline). Lectura propia completa source/tests. Helperestricto pruebas-inventario.ps1 usado porProgramador, sinURLficticia ni envmodificaciones.
- QA inv17-3a3-on PASA1/1/auditoria0/9imagenesvistas,sin pendientes. Director espero cierreQA yuso helperpropio verificar-director.ps1 (rechaza puertoocupado, levantaTESTconguardas/overrideenvlocal ysiempreapaga): busquedaUNO->DOSsinrecarga,B2,dual/pendiente/cero,360/1280/JS0 PASA. No seafirma flujo conteoUI integrado aun.
- TESTdetenido/nextenvrestaurado/flagsfalse, sinreset/push/deploy. Contadoraudit3. Sigue17.3b-BCD integracionfinal, prompt9archivos<=200 con identidadFormusuario+producto (nunca nonce/cantidad). Plan8casos+OFF yscriptsDirector completos/respuestastardias listos. Historial18Areadonly lanzado enparalelo para contratosposteriores; no mezclarlo con17.3b.

## 2026-11-19 — Continuidad y API de búsqueda cerrada
- Commit25262d0 API42+test136+QA/BUGS16=194. Director52/52, eslint0, tsc/build0; QA inv-17-search-api-on PASA1/1 auditoría0; reproducciónHTTP autenticado/query400/DTOstock8/no-store/anonbloqueado yOFF404. Sin caller durante eseQA.
- D-20261118-SEARCH-PENDING: búsquedaServerAction espera cola de guardado, causaNext16confirmada. AjusteProgramador inv-17-3b-search-BCD exit0; b180líneas SINcommit, faltan reproducción tardía/verificación propia/QAafectada.
- Traspaso docs/TRASPASO-IA.md y prioridad en CONTEXT. Patch+untracked+SHA256 ../_dt/handoff-2026-11-19. Contadoraudit4; flagsfalse/puerto3123libre al inspeccionar. Sinprod/push/deploy/reset.

## 2026-11-19 — Verificacion propia del ajuste de busqueda
- Director59/59 en5archivos + eslintBuscador/test0. Lectura real diff:9archivos180add+del, no motorcompartido.
- Director verificar-conteo-respuestas-arjun.cjs PASA: respuesta perdida tras commit -> replay sin duplicado; mientras respuesta retenida busqueda GET encuentra siguienteSKU, cambiaficha y nuevo borrador99; liberar anterior elimina solo nonce enviado y conserva99/nonce nuevo. JS0. TEST apagado/nextenv restaurado.
- Tsc/build propios inv-17-3b-search-director lanzados; falta QA afectadaON yOFF antes cerrarcommitb. Registro de traspaso no implica fin del backlog.

## 2026-11-19 — Cierre17.3b c51cff5 y auditoría
- 193added+deleted conQA;9archivosproducto/tests180. Director59/59/lint0/tsc0/build0, warningrootbaseline.
- Respuesta perdida tras servidorrecibió -> retry sin duplicado; respuesta retenida -> GETbusca/abre siguienteSKU/borrador99 -> liberarviejo conserva99/nonce y limpia solo enviado, JS0 PASA.
- QA searchON1/1 yOFF1/1, ambas auditoría0/5imágenes/sinpendientes. DirectorOFFPASApersonal redirección/ficha/ausenciaform/JS0. ScriptOFF inicial comparación case-sensitive ignoró CSSuppercase; corregido en script externo y repetido, no appbug.
- D-SEARCH ARREGLADO y lowcantidad BACKLOG. Flagsfalse/nextenvrestaurado/puerto3123libre comprobados antescommit, stageexplícito; nuncaadd-A.
- Auditoría inv-audit-17-3b-A sin bloqueantes; decisión vinculante ../_dt/prompts/inv-audit-17-3b-decision.md. Snapshot flagtrue era QAON temporal; descartar refactor genérico de storage, motor sin AbortSignal no afecta latestId probado. Hora duplicada se absorbe18.1. Contador0.
- TRASPASO actualizado al cierre. Siguiente18.1 preparado; sinpush/deploy/reset/prod.

## 2026-11-19 — Cierre18.1 e09a114 y traspaso definitivo
- Fuente/tests65add+del +QA8=73. Director34/34, lint6/tsc/build0; warningrootpreexistente sin ocultar. B5rojos reales antesC (horaausente, fecha/horalista, miles);0/nullintactos.
- HoraChile h23 compartida elimina2duplicados; lista fecha+hora+autor porposición y milesreadonlylista/ficha. Inputs/preview/costos/packing/keys intactos.
- QA inv-18-1-on PASA1/1/auditoría0/7imágenes yOFF PASA1/1/auditoría0/3imágenes, sin hallazgos/JS0. Director navegadorpropio verificar-formato-conteos-arjun.cjs PASA1280/360fecha-hora-lista/ficha/autor/0vsnull/nooverflow/JS0. Miles porunit nofixturevisualgrande.
- TESTapagado/nextenvrestaurado/flagsfalse. Código e09a114 cerrado; contador1 desdeaudit17.3b.
- Traspaso canónico docs/TRASPASO-IA.md actualizado: ningúntrabajoactivo; siguiente18.2 prompt ../_dt/prompts/inv-18-2-BCD.md preparado NOlanzado. Director siguiente prepara planQA/fixtures12versiones solosintéticos antesB.
- Backlogrestante explicado y contratos/rutas/evidencias/localizadores exactos. Respaldos17.3b y18.1 en ../_dt/handoff-2026-11-19 ya incorporados, NO reaplicar. Sinpush/deploy/resetreal/prod.

## 2026-11-19 — Cierre18.2 69a9e05 historial de conteos a demanda
- Programador deepseek BCD 268s. 5archivos196add+0del codigo+tests; QA-REGISTRO8 (ON+OFF) va en commit docs para no exceder200. Borrador inicial205 compactado en harness de hooks: mismo estilo denso ya commiteado en inventario-envio-hook.test.ts (proyecto sin prettier); 7casos de riesgo completos. Aceptado por Director, anotado.
- Log BCD sin evidencia explicita de rojo; Director hizo mutacion propia (quitar lock enCurso y guard montado): 2rojos exactos, archivo restaurado hash identico.
- Director48/48 dirigidos (historial/ficha/consultas/fecha/lista/envio), eslint5=0, tsc0, build0 (warningroot preexistente).
- Fixtures Director preparar-historial-qa.cjs SOLO TEST: 5179 13versiones B1A1F vigente80 (incluye0 y148163), 5180 sinconteos, 5181 cero. Sin reset global.
- QA inv-18-2-on PASA6/6 auditoria0/17imagenes consola0; inv-18-2-off PASA1/1 auditoria0/5imagenes. Sin defectos ni pendientes.
- Director navegador verificar-historial-arjun.cjs PASA: 0 server actions al montar, Cargando visible con respuesta demorada, 1consulta, reabrir sin refetch, Enter abre, offline->mensaje fijo->Reintentar, respuesta tardia con cambio a5181 no contamina, 360 sin desborde, JS0.
- Flagsfalse, nextenv restaurado, puerto3123 libre. Contador2 desde audit17.3b. Sin push/deploy/reset/prod.

## 2026-11-19 — Cierre UsuariosR8 c6878dc
- Programador deepseek BCD 164s, rojo B real 10 fallos. 3archivos180 add+del + QA-REGISTRO9 = 189.
- Director: revision diff (guarda antes de SQL, sin requestUserId, DTO sin hash, limpieza solo ids propios), 29/29 dirigidos, eslint3=0, tsc0, build0.
- Director verificar-usuarios-r8-arjun.cjs PASA: replay de next-action listar/crear como operador y anonimo sin lista ni usuario forjado, control positivo admin, sin hash en respuestas. Dos intentos iniciales fallaron por el script (cabecera sin interceptacion; selector tomaba buscador global), corregidos en script externo, no app.
- QA inv-usuarios-r8-on PASA4/4 auditoria0; off PASA1/1. P-2256-2 alta (500 consola) DESCARTADO duplicado de P-2256-1; P-2256-1 BACKLOG media errores esperados como valor (BUGS). 403 operador esperado.
- TEST: borrado solo qa-r8-2253 (id881) y qa-r8d-* propios. Flagsfalse, puerto libre. Contador3 desde audit17.3b. Sin push/deploy/reset/prod.
