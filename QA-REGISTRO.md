# QA-REGISTRO

Registro automatico de la Fase E (Metodo pBravoT, ver ~/.claude/PBRAVOT-QA.md).
Cada pendiente se cierra cambiando `[ ]` por `[x]` y agregando la resolucion al final de la linea:
`-> ARREGLADO <commit>` / `-> BACKLOG <referencia>` / `-> DESCARTADO <motivo>`.
Con pendientes (alta) o (critica) abiertos, el hook pre-commit bloquea el commit. BACKLOG solo para media o baja.

## 2026-11-10 21:44 - arjun-barrido - commit 8c15d08 - INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\arjun-barrido
- [ ] P-20261110-2144-1 (media) FALTA: FALTA-1 — Fecha en la entrada manual
- [ ] P-20261110-2144-2 (baja) CONSOLA: Failed to load resource: the server responded with a status of 403 (Forbidden) (/usuarios)
- [ ] P-20261110-2144-3 (media) CONSOLA: Each child in a list should have a unique "key" prop. See https://react.dev/link/warning-keys for more information.

## 2026-11-10 21:58 - arjun-barrido-c1 - commit 8c15d08 - FALLA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\arjun-barrido-c1
- [x] P-20261110-2158-1 (media) FALLA: BAR-DEF-1 — Packing negativo se acepta y se guarda -> DESCARTADO duplicado de P-20261110-2158-5 (verificado por el Director: lib/actions/productos.ts no valida packing)
- [ ] P-20261110-2158-2 (alta) FALLA: BAR-DEF-2 — /movimientos "Cargar mas" repite filas
- [x] P-20261110-2158-3 (baja) FALLA: BAR-DEF-3 — /inversion-mercaderia: el código parece enlace y no hace nada -> DESCARTADO falso positivo (verificado por el Director: el clic en el codigo abre el modal)
- [x] P-20261110-2158-4 (alta) ROTO: /movimientos - button "Cargar mas": -> DESCARTADO duplicado de P-20261110-2158-2
- [ ] P-20261110-2158-5 (alta) ROTO: /productos/:id - spinbutton "Packing (unids/caja)" y button "Guardar cambios":
- [x] P-20261110-2158-6 (alta) ROTO: /inversion-mercaderia - button de fila (en filas): -> DESCARTADO falso positivo (verificado por el Director: el clic en el codigo abre el modal)
- [ ] P-20261110-2158-7 (baja) HALLAZGO: EXP-1 — Formato de miles inconsistente
- [ ] P-20261110-2158-8 (media) HALLAZGO: EXP-2 — Tipo "ajuste" ausente en el filtro de /movimientos
- [x] P-20261110-2158-9 (media) HALLAZGO: EXP-3 — Tras "Corregir", el detalle no coincide con el saldo -> BACKLOG UX: "Corregir" funciona segun diseno; mejorar como se muestra el detalle
- [ ] P-20261110-2158-10 (media) HALLAZGO: EXP-4 — Saldos de salida sin entrada en /bodegas/1
- [ ] P-20261110-2158-11 (baja) HALLAZGO: EXP-5 — Textos y avisos inconsistentes
- [ ] P-20261110-2158-12 (baja) HALLAZGO: EXP-6 — Búsquedas lentas y errores de consola
- [ ] P-20261110-2158-13 (baja) HALLAZGO: EXP-7 — Columna "Bodegas" sin nombres en /productos
- [ ] P-20261110-2158-14 (media) CONSOLA: Failed to load resource: the server responded with a status of 404 () (/dxkidwxjl/image/upload/productos/87086-5(ANIL))
- [ ] P-20261110-2158-15 (media) CONSOLA: [probable misma causa que P-20261110-2158-2, filas repetidas] Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. 7200
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
- [ ] P-20261110-2158-35 (media) CONSOLA: Failed to load resource: the server responded with a status of 404 () (/dxkidwxjl/image/upload/productos/1130-5)
- [ ] P-20261110-2158-36 (alta) CONSOLA: Failed to load resource: the server responded with a status of 500 (Internal Server Error) (/salidas)

## 2026-11-10 22:07 - arjun-barrido-c2 - commit 8c15d08 - INVALIDO
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\arjun-barrido-c2
- [ ] P-20261110-2207-1 (baja) HALLAZGO: EXP-1 — Sugerencias de producto no aparecen al rellenar el campo de golpe
- [x] P-20261110-2207-2 (baja) HALLAZGO: EXP-2 — Consola: error de React por claves duplicadas -> DESCARTADO duplicado de P-20261110-2158-15
- [ ] P-20261110-2207-3 (baja) HALLAZGO: EXP-3 — Cuadro de /modulos/1 para TEST-RET-001 no suma

## 2026-11-10 22:55 - prod-prueba1 - commit 1b99433 - PRODUCCION PASA
- Evidencia: C:\Users\pablo\Documents\app-arjun-v2\_dt\qa\prod-prueba1
- Sin pendientes nuevos.
