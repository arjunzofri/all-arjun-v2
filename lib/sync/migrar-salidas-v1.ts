import { neon } from "@neondatabase/serverless";

export async function migrarSalidasV1(): Promise<{
  totalV1: number;
  procesadas: number;
  sinMatchProducto: { codigo_v1: string; salidas: number }[];
  sinMatchModulo: { modulo_v1: string; salidas: number }[];
  sinMatchUsuario: { username_v1: string; salidas: number }[];
  filasInsertadas: number;
}> {
  if (!process.env.DATABASE_URL_V1) {
    throw new Error("DATABASE_URL_V1 no está definida. Agregala a .env.local");
  }

  const sqlV1 = neon(process.env.DATABASE_URL_V1);
  const sqlV2 = neon(process.env.DATABASE_URL!);

  // ── 1. Índices en memoria desde v2 ────────────────────────────────
  const prodRows = await sqlV2`SELECT id, codigo FROM productos` as unknown as { id: number; codigo: string }[];
  const productosV2 = new Map<string, number>();
  for (const p of prodRows) productosV2.set(p.codigo, p.id);

  const modRows = await sqlV2`SELECT id, nombre FROM modulos` as unknown as { id: number; nombre: string }[];
  const modulosV2 = new Map<string, number>();
  for (const m of modRows) modulosV2.set(m.nombre, m.id);

  const userRows = await sqlV2`SELECT id, username FROM users` as unknown as { id: number; username: string }[];
  const usuariosV2 = new Map<string, number>();
  for (const u of userRows) usuariosV2.set(u.username, u.id);

  // ── 2. Leer salidas de v1 ─────────────────────────────────────────
  const salidas = await sqlV1`
    SELECT s.id AS v1_id, s.cantidad, s.timestamp_salida, s.observaciones,
           p.codigo AS codigo_v1, m.nombre AS modulo_nombre,
           u.username AS usuario_v1
    FROM salidas s
    JOIN productos p ON p.id = s.producto_id
    JOIN modulos_destino m ON m.id = s.modulo_destino_id
    JOIN usuarios u ON u.id = s.usuario_id
  ` as unknown as {
    v1_id: string; cantidad: number; timestamp_salida: string;
    observaciones: string | null; codigo_v1: string;
    modulo_nombre: string; usuario_v1: string;
  }[];

  const sinMatchProducto: { codigo_v1: string; salidas: number }[] = [];
  const sinMatchModulo: { modulo_v1: string; salidas: number }[] = [];
  const sinMatchUsuario: { username_v1: string; salidas: number }[] = [];
  let procesadas = 0;
  let filasInsertadas = 0;

  // ── 3. Procesar cada salida ───────────────────────────────────────
  for (const s of salidas) {
    // Matching de producto
    let productoId = productosV2.get(s.codigo_v1);
    if (productoId === undefined) {
      for (const [cod, id] of productosV2) {
        if (s.codigo_v1.startsWith(cod + " ")) {
          productoId = id;
          break;
        }
      }
    }
    if (productoId === undefined) {
      const entry = sinMatchProducto.find((e) => e.codigo_v1 === s.codigo_v1);
      if (entry) entry.salidas++; else sinMatchProducto.push({ codigo_v1: s.codigo_v1, salidas: 1 });
      continue;
    }

    // Matching de módulo
    const moduloId = modulosV2.get(s.modulo_nombre);
    if (moduloId === undefined) {
      const entry = sinMatchModulo.find((e) => e.modulo_v1 === s.modulo_nombre);
      if (entry) entry.salidas++; else sinMatchModulo.push({ modulo_v1: s.modulo_nombre, salidas: 1 });
      continue;
    }

    // Matching de usuario
    let usuarioId = usuariosV2.get(s.usuario_v1);
    if (usuarioId === undefined) {
      usuarioId = 62; // fallback: admin
      const entry = sinMatchUsuario.find((e) => e.username_v1 === s.usuario_v1);
      if (entry) entry.salidas++; else sinMatchUsuario.push({ username_v1: s.usuario_v1, salidas: 1 });
    }

    const folio = `V1-SAL-${s.v1_id}`;

    const movRes = await sqlV2`
      INSERT INTO movimientos (folio, producto_id, tipo, cantidad,
        bodega_origen_id, modulo_destino_id, usuario_id, created_at, observaciones)
      VALUES (${folio}, ${productoId}, 'salida', ${s.cantidad},
        1, ${moduloId}, ${usuarioId}, ${s.timestamp_salida}::timestamp, ${s.observaciones ?? null})
      ON CONFLICT (folio, producto_id) DO NOTHING
      RETURNING id
    ` as unknown as { id: number }[];

    if (movRes[0]?.id) {
      await sqlV2`
        INSERT INTO stock (producto_id, modulo_id, cantidad)
        VALUES (${productoId}, ${moduloId}, ${s.cantidad})
        ON CONFLICT (producto_id, modulo_id)
        DO UPDATE SET cantidad = stock.cantidad + ${s.cantidad}
      `;
      filasInsertadas++;
    }

    procesadas++;
  }

  return {
    totalV1: salidas.length,
    procesadas,
    sinMatchProducto,
    sinMatchModulo,
    sinMatchUsuario,
    filasInsertadas,
  };
}
