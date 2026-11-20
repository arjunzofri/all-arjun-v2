/** Fase B — INV-19.2: cambio de foto ON (upload -> CAS -> cleanup). DB TEST real; Cloudinary mockeado. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { productos } from "@/db/schema";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const cl = vi.hoisted(() => ({ subir: vi.fn(), eliminar: vi.fn() }));
vi.mock("@/lib/cloudinary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cloudinary")>();
  return { ...actual, subirImagen: cl.subir, eliminarImagen: cl.eliminar };
});
import { POST } from "@/app/api/productos/[id]/imagen/route";

const tag = `IMG${Date.now().toString(36)}`;
const flagPrevio = process.env.FEATURE_INVENTARIO_BODEGA;
const ARJUN = "https://res.cloudinary.com/dbl8yxnjy/image/upload";
const VD = "https://res.cloudinary.com/dxkidwxjl/image/upload/v1/p/vd.jpg";
const vieja = `${ARJUN}/v1/arjun/vieja.jpg`, nueva = `${ARJUN}/v2/arjun/nueva.jpg`, ganadora = `${ARJUN}/v3/arjun/ganadora.jpg`;
let pid = 0;
const post = (id: string | number, file?: File) => {
  const fd = new FormData();
  if (file) fd.append("imagen", file);
  return POST(new NextRequest(`http://localhost/api/productos/${id}/imagen`, { method: "POST", body: fd }),
    { params: Promise.resolve({ id: String(id) }) });
};
const jpg = () => new File([new Uint8Array(8)], "f.jpg", { type: "image/jpeg" });
const urlEnDb = async () => (await db.select({ u: productos.imagenUrl }).from(productos).where(eq(productos.id, pid)))[0].u;
const anterior = (u: string | null) => db.update(productos).set({ imagenUrl: u }).where(eq(productos.id, pid));

beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).host === process.env.PROD_DATABASE_URL_HOST) throw new Error("DATABASE_URL apunta a producción: se aborta antes de SQL");
  [pid] = (await db.insert(productos).values({ codigo: `${tag}P`, imagenUrl: vieja }).returning({ id: productos.id })).map((p) => p.id);
});
afterAll(async () => {
  try { if (pid) await db.delete(productos).where(inArray(productos.id, [pid])); } finally {
    if (flagPrevio === undefined) delete process.env.FEATURE_INVENTARIO_BODEGA; else process.env.FEATURE_INVENTARIO_BODEGA = flagPrevio;
  }
});
beforeEach(async () => {
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
  vi.mocked(auth).mockResolvedValue({ user: { id: "1" } } as never);
  cl.subir.mockReset().mockResolvedValue(nueva);
  cl.eliminar.mockReset().mockResolvedValue(undefined);
  await anterior(vieja);
});

it("ON propia: sube, CAS y borra la vieja una sola vez", async () => {
  const r = await post(pid, jpg());
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ imagenUrl: nueva });
  expect(await urlEnDb()).toBe(nueva);
  expect(cl.eliminar.mock.calls).toEqual([[vieja]]);
});

it("ON anterior de Vida Digital: nunca se borra", async () => {
  await anterior(VD);
  expect((await post(pid, jpg())).status).toBe(200);
  expect(await urlEnDb()).toBe(nueva);
  expect(cl.eliminar).not.toHaveBeenCalled();
});

it("ON subida falla: DB intacta y la vieja no se toca", async () => {
  cl.subir.mockRejectedValueOnce(new Error("CLOUDINARY_API_SECRET=secreto"));
  const r = await post(pid, jpg());
  expect(r.status).toBe(502);
  expect(await r.json()).toEqual({ error: "No se pudo subir la imagen. Intente nuevamente." });
  expect(await urlEnDb()).toBe(vieja);
  expect(cl.eliminar).not.toHaveBeenCalled();
});

it("ON conflicto: 409 borra solo la nueva y conserva la ganadora", async () => {
  cl.subir.mockImplementationOnce(async () => { await anterior(ganadora); return nueva; });
  const r = await post(pid, jpg());
  expect(r.status).toBe(409);
  expect((await r.json()).error).toMatch(/cambió/);
  expect(await urlEnDb()).toBe(ganadora);
  expect(cl.eliminar.mock.calls).toEqual([[nueva]]);
});

it("ON anterior null: isNull actualiza; conflicto concurrente da 409", async () => {
  await anterior(null);
  expect((await post(pid, jpg())).status).toBe(200);
  await anterior(null);
  cl.subir.mockImplementationOnce(async () => { await anterior(ganadora); return nueva; });
  expect((await post(pid, jpg())).status).toBe(409);
  expect(await urlEnDb()).toBe(ganadora);
});

it("ON 401 sin sesión, 400 de id inválido y 404: no sube", async () => {
  vi.mocked(auth).mockResolvedValueOnce(null as never);
  expect((await post(pid, jpg())).status).toBe(401);
  expect((await post("abc", jpg())).status).toBe(400);
  expect((await post(0, jpg())).status).toBe(400);
  const [x] = await db.insert(productos).values({ codigo: `${tag}X` }).returning({ id: productos.id });
  await db.delete(productos).where(eq(productos.id, x.id));
  expect((await post(x.id, jpg())).status).toBe(404);
  expect(cl.subir).not.toHaveBeenCalled();
});

it("ON tipo y tamaño inválidos: 400 sin subir", async () => {
  const txt = new File(["hola"], "a.txt", { type: "text/plain" });
  const grande = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "g.jpg", { type: "image/jpeg" });
  expect((await post(pid, txt)).status).toBe(400);
  expect((await post(pid, grande)).status).toBe(400);
  expect(cl.subir).not.toHaveBeenCalled();
  expect(await urlEnDb()).toBe(vieja);
});

it("ON cleanup de la vieja que lanza no rompe el 200", async () => {
  cl.eliminar.mockRejectedValueOnce(new Error("boom"));
  expect((await post(pid, jpg())).status).toBe(200);
  expect(await urlEnDb()).toBe(nueva);
});

it("ON SELECT que lanza: 500 JSON fijo, no sube y no escribe", async () => {
  const spy = vi.spyOn(db, "select").mockImplementationOnce(() => { throw new Error("postgres://u:p@host/db"); });
  try {
    const r = await post(pid, jpg());
    expect(r.status).toBe(500);
    const j = await r.json();
    expect(j).toEqual({ error: "No se pudo actualizar la imagen. Intente nuevamente." });
    expect(JSON.stringify(j)).not.toContain("postgres");
    expect(cl.subir).not.toHaveBeenCalled();
    expect(await urlEnDb()).toBe(vieja);
  } finally { spy.mockRestore(); }
});

it("imagen.tsx: respuesta no-JSON o !ok muestra mensaje fijo sin lanzar", () => {
  const src = readFileSync(resolve(__dirname, "..", "app/(dashboard)/productos/[id]/imagen.tsx"), "utf8");
  expect(src).toContain("No se pudo subir la imagen. Intente nuevamente.");
  expect(src).not.toContain("throw new Error");
});

it("OFF: borra la vieja antes de subir y no usa CAS (sin 409)", async () => {
  process.env.FEATURE_INVENTARIO_BODEGA = "false";
  cl.eliminar.mockImplementationOnce(async () => { await anterior(ganadora); });
  const r = await post(pid, jpg());
  expect(r.status).toBe(200);
  expect(cl.eliminar.mock.calls).toEqual([[vieja]]);
  expect(cl.eliminar.mock.invocationCallOrder[0]).toBeLessThan(cl.subir.mock.invocationCallOrder[0]);
  expect(await urlEnDb()).toBe(nueva);
});
