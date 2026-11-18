-- inv-03: registrar_conteo atomico e idempotente. Aplicar solo en TEST por ahora.
CREATE OR REPLACE FUNCTION public.registrar_conteo(
    p_producto integer, p_bodega integer, p_planta text, p_pasillo text, p_posicion text,
    p_cantidad integer, p_usuario integer, p_idempotencia text, p_esperado bigint
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prev public.conteos_inventario%ROWTYPE;
    v_vig public.conteos_inventario%ROWTYPE;
BEGIN
    -- Inputs obligatorios: un NULL comparado por SQL daria unknown y podria tocar filas ajenas.
    IF p_producto IS NULL OR p_bodega IS NULL OR p_planta IS NULL OR p_pasillo IS NULL
       OR p_posicion IS NULL OR p_cantidad IS NULL OR p_usuario IS NULL OR p_idempotencia IS NULL THEN
        RAISE EXCEPTION 'payload invalido' USING ERRCODE = '22023';
    END IF;

    -- Mismo orden en todas las llamadas: idempotencia primero, posicion despues.
    PERFORM pg_advisory_xact_lock(hashtextextended('conteo-idem:' || p_idempotencia, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended(
        'conteo-pos:' || p_producto || ':' || p_bodega || ':' || p_planta || ':' || p_pasillo || ':' || p_posicion, 0));

    -- VOLATILE: cada consulta interna toma snapshot nuevo, posterior a los locks.
    SELECT * INTO v_prev FROM conteos_inventario WHERE idempotency_key = p_idempotencia;
    IF FOUND THEN
        IF v_prev.usuario_id = p_usuario AND v_prev.producto_id = p_producto
           AND v_prev.bodega = p_bodega AND v_prev.planta = p_planta AND v_prev.pasillo = p_pasillo
           AND v_prev.posicion = p_posicion AND v_prev.cantidad = p_cantidad THEN
            RETURN jsonb_build_object('ok', true, 'conteo', to_jsonb(v_prev), 'repetido', true);
        END IF;
        RAISE EXCEPTION 'idempotencia reutilizada con payload distinto' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_vig FROM conteos_inventario
     WHERE producto_id = p_producto AND bodega = p_bodega AND planta = p_planta
       AND pasillo = p_pasillo AND posicion = p_posicion
     ORDER BY id DESC LIMIT 1;

    IF p_esperado IS NULL THEN
        IF FOUND THEN
            RETURN jsonb_build_object('ok', false, 'conflicto', true, 'vigente', to_jsonb(v_vig));
        END IF;
    ELSIF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'conflicto', true, 'vigente', NULL);
    ELSIF v_vig.id <> p_esperado THEN
        RETURN jsonb_build_object('ok', false, 'conflicto', true, 'vigente', to_jsonb(v_vig));
    END IF;

    INSERT INTO conteos_inventario
        (producto_id, bodega, planta, pasillo, posicion, cantidad, usuario_id, idempotency_key)
    VALUES (p_producto, p_bodega, p_planta, p_pasillo, p_posicion, p_cantidad, p_usuario, p_idempotencia)
    RETURNING * INTO v_prev;
    RETURN jsonb_build_object('ok', true, 'conteo', to_jsonb(v_prev), 'repetido', false);
END;
$$;
