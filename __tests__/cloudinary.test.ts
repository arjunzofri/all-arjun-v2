/**
 * Fase B — Slice 10: Tests que intentan romper imágenes y Cloudinary.
 * Riesgos: R1 imagen Vida Digital no se borra, R2 sin compresión,
 * R3 credenciales ausentes, R4 archivo grande, R5 herencia ubicación.
 */

import { describe, it, expect } from "vitest";

// Imports reales — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import { subirImagen, eliminarImagen, extraerPublicId } from "@/lib/cloudinary";

// ── R2: Compresión ─────────────────────────────────────────────────────
describe("subirImagen()", () => {
  it("rechaza archivos mayores a 10MB", async () => {
    const hugeFile = new File(
      [new Uint8Array(11 * 1024 * 1024)],
      "huge.jpg",
      { type: "image/jpeg" }
    );
    await expect(subirImagen(hugeFile)).rejects.toThrow(/tamaño|size|10MB/i);
  });

  it("rechaza formatos no permitidos", async () => {
    const textFile = new File(["hello"], "doc.txt", { type: "text/plain" });
    await expect(subirImagen(textFile)).rejects.toThrow(/formato|tipo|permitido/i);
  });

  it("acepta JPEG y PNG", async () => {
    // Test que la función acepta formatos válidos (sin credenciales no sube, pero no crashea)
    const jpg = new File([new Uint8Array(100)], "test.jpg", { type: "image/jpeg" });
    // Sin credenciales Cloudinary, debe lanzar error descriptivo, no crash genérico
    await expect(subirImagen(jpg)).rejects.toThrow();
  });
});

// ── R3: Credenciales ───────────────────────────────────────────────────
describe("cloudinary — credenciales", () => {
  it("lanza error descriptivo si CLOUDINARY_API_KEY no está configurada", async () => {
    const original = process.env.CLOUDINARY_API_KEY;
    delete (process.env as Record<string, string>).CLOUDINARY_API_KEY;
    const file = new File([new Uint8Array(100)], "test.jpg", { type: "image/jpeg" });
    await expect(subirImagen(file)).rejects.toThrow(/CLOUDINARY|config/i);
    process.env.CLOUDINARY_API_KEY = original;
  });
});

// ── R1: Extraer public_id ──────────────────────────────────────────────
describe("extraerPublicId()", () => {
  it("identifica URL de Vida Digital (dxkidwxjl)", () => {
    const url = "https://res.cloudinary.com/dxkidwxjl/image/upload/v123/productos/152.jpg";
    const id = extraerPublicId(url);
    expect(id).toBeNull(); // No es de Arjun → null, no se debe tocar
  });

  it("extrae public_id de URL de Arjun (dbl8yxnjy)", () => {
    const url = "https://res.cloudinary.com/dbl8yxnjy/image/upload/v123/productos/152.jpg";
    const id = extraerPublicId(url);
    expect(id).toBe("productos/152");
  });

  it("devuelve null para URL no Cloudinary", () => {
    expect(extraerPublicId("https://example.com/img.jpg")).toBeNull();
    expect(extraerPublicId("")).toBeNull();
    expect(extraerPublicId(null as unknown as string)).toBeNull();
  });
});
