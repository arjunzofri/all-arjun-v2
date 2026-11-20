/** Fase B — INV-27: subida de imágenes bajo el límite de body de Vercel (4.5 MB). */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import * as c from "@/lib/utils/comprimir-imagen";

const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

it("constantes: 2000 px de lado mayor y 3.5 MB de tope", () => {
  expect(c.MAX_LADO_SUBIDA).toBe(2000);
  expect(c.MAX_PESO_SUBIDA).toBe(3.5 * 1024 * 1024);
  expect(typeof c.reducirImagenParaSubir).toBe("function");
});

it("reducer: no agranda, fondo blanco, calidades y reintento a 1600", () => {
  const s = src("lib/utils/comprimir-imagen.ts");
  expect(s).toContain("MAX_LADO_SUBIDA");
  expect(s).toContain('fillStyle = "#fff"');
  expect(s).toMatch(/0\.85[\s\S]*0\.7[\s\S]*0\.55/);
  expect(s).toContain("1600");
  expect(s).toContain("No se pudo reducir la imagen. Intente con otra foto.");
  expect(s).toContain("No se pudo leer la imagen. Intente con una foto JPG, PNG o WebP.");
  expect(s).not.toContain("Probá");
});

it("los errores de reducción se distinguen de los de red (clase propia)", () => {
  expect(typeof c.ErrorImagen).toBe("function");
  const ficha = src("app/(dashboard)/productos/[id]/imagen.tsx");
  expect(ficha).toContain("instanceof ErrorImagen");
  expect(ficha).toContain('"La imagen es muy grande. Intente con otra foto."');
  expect(ficha).toContain("No se pudo subir la imagen. Intente nuevamente.");
});

it("las 3 rutas de subida reducen antes de enviar (nunca el File crudo)", () => {
  const ficha = src("app/(dashboard)/productos/[id]/imagen.tsx");
  expect(ficha).toContain("reducirImagenParaSubir");
  expect(ficha).toMatch(/reducirImagenParaSubir\(file\)[\s\S]*formData\.append\("imagen"/);
  expect(ficha).toContain("res.status === 413");
  const entradas = src("app/(dashboard)/entradas/page.tsx");
  expect(entradas).toContain("reducirImagenParaSubir");
  expect(entradas).toMatch(/reducirImagenParaSubir\(/);
  const ident = src("components/identificacion/IdentificarProducto.tsx");
  expect(ident).toContain("comprimirImagen(file)");
  expect(ident).not.toMatch(/data:\s*await\s+\w+\.text|leerArchivo\(file\)/);
});
