/**
 * Generador LOCAL de fichas visuales. Nunca se ejecuta en Vercel.
 * npx tsx scripts/generar-fichas-visuales.ts [--limite N] [--dry-run]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function cargarEnvLocal(): void {
  for (const linea of readFileSync(".env.local", "utf-8").split("\n")) {
    const t = linea.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    let valor = t.slice(eq + 1);
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = valor;
  }
}

interface Item {
  codigo: string;
  imagenUrl: string;
}

async function main(): Promise<void> {
  cargarEnvLocal();

  // Imports dinámicos: db/index.ts exige DATABASE_URL al cargarse.
  const { getCatalogoVidaDigital } = await import("@/db/vidadigital/queries");
  const { generarFichasLote, getFichasVisuales, hashFicha, upsertFichas } =
    await import("@/lib/identificacion/fichas");
  const { MODELO_GEMINI } = await import("@/lib/identificacion/gemini");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const iLimite = args.indexOf("--limite");
  const limite = iLimite >= 0 ? Number(args[iLimite + 1]) : Infinity;
  const TAMANO = 16;
  const CONCURRENCIA = 2;

  const catalogo = await getCatalogoVidaDigital();
  const existentes = await getFichasVisuales();
  const pendientes: Item[] = catalogo
    .filter((p) => {
      const guardada = existentes.get(p.codigo);
      return !guardada || guardada.imagenHash !== hashFicha(p.imagenUrl);
    })
    .slice(0, limite);

  if (dryRun) {
    console.log(`pendientes ${pendientes.length}`);
    process.exit(0);
  }

  const inicio = Date.now();
  const ok: string[] = [];
  const fallidos: { codigo: string; motivo: string }[] = [];

  async function correr(items: Item[]): Promise<void> {
    const cola = [...items];

    async function worker(): Promise<void> {
      while (cola.length) {
        const lote = cola.splice(0, TAMANO);
        try {
          const mapa = await generarFichasLote(lote);
          const filas = lote
            .filter((item) => mapa.has(item.codigo))
            .map((item) => ({
              codigo: item.codigo,
              ficha: mapa.get(item.codigo)!,
              imagenHash: hashFicha(item.imagenUrl),
              modelo: MODELO_GEMINI,
            }));
          if (filas.length) await upsertFichas(filas);
          ok.push(...filas.map((f) => f.codigo));
          for (const item of lote) {
            if (!mapa.has(item.codigo)) {
              fallidos.push({ codigo: item.codigo, motivo: "sin ficha en la respuesta" });
            }
          }
        } catch (e) {
          const motivo = e instanceof Error ? e.message : String(e);
          for (const item of lote) fallidos.push({ codigo: item.codigo, motivo });
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCIA }, () => worker()));
  }

  await correr(pendientes);

  // Un reintento de los lotes fallidos, agrupados de nuevo de a 16.
  const porCodigo = new Map(pendientes.map((item) => [item.codigo, item]));
  const reintento = fallidos
    .map((f) => porCodigo.get(f.codigo))
    .filter((item): item is Item => Boolean(item));
  if (reintento.length) {
    fallidos.length = 0;
    await correr(reintento);
  }

  const reporte = {
    procesados: pendientes.length,
    ok: ok.length,
    fallidos,
    duracionMs: Date.now() - inicio,
    modelo: MODELO_GEMINI,
    fecha: new Date().toISOString(),
  };
  const destino = resolve("..", "_poc_tmp", "reporte-fichas.json");
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(reporte, null, 2));

  console.log(
    `procesados ${reporte.procesados} ok ${reporte.ok} fallidos ${fallidos.length} en ${Math.round(reporte.duracionMs / 1000)}s`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
