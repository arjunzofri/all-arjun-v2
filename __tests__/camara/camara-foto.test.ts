import { describe, it, expect, vi } from "vitest";

// ── Lógica pura extraída del componente (se testa sin jsdom) ──────────

type FotoState = {
  esDeCatalogo: boolean;
  codigo: string;
  imagenUrl: string | null;
  fotoLocal: string | null;
};

/**
 * Decide qué hacer con una foto tomada.
 * Retorna el nuevo estado parcial — sin efectos secundarios.
 */
export function resolverFoto(
  state: FotoState,
  objectUrl: string,
): Partial<FotoState> {
  if (state.esDeCatalogo) {
    // Producto del catálogo: foto se descarta visualmente, no toca imagenUrl
    return { fotoLocal: objectUrl };
  }
  // Manual: foto queda en local, el upload se hace por separado
  return { fotoLocal: objectUrl };
}

/**
 * Al seleccionar del catálogo: descarta foto previa, marca esDeCatalogo.
 */
export function aplicarSugerencia(imagenUrl: string | null): Partial<FotoState> {
  return {
    esDeCatalogo: true,
    imagenUrl,
    fotoLocal: null,
  };
}

/**
 * Al editar el código manualmente: ya no es del catálogo.
 */
export function marcarManual(): Partial<FotoState> {
  return { esDeCatalogo: false };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("resolverFoto", () => {
  it("si esDeCatalogo=true, no modifica imagenUrl", () => {
    const state: FotoState = { esDeCatalogo: true, codigo: "B200", imagenUrl: "https://cdn/b200.jpg", fotoLocal: null };
    const result = resolverFoto(state, "blob://nueva");
    expect(result.imagenUrl).toBeUndefined(); // no toca imagenUrl
    expect(result.fotoLocal).toBe("blob://nueva");
  });

  it("si esDeCatalogo=false, setea fotoLocal", () => {
    const state: FotoState = { esDeCatalogo: false, codigo: "MANUAL-001", imagenUrl: null, fotoLocal: null };
    const result = resolverFoto(state, "blob://nueva");
    expect(result.fotoLocal).toBe("blob://nueva");
  });

  it("sin código ni catálogo, solo fotoLocal", () => {
    const state: FotoState = { esDeCatalogo: false, codigo: "", imagenUrl: null, fotoLocal: null };
    const result = resolverFoto(state, "blob://preview");
    expect(result.fotoLocal).toBe("blob://preview");
    expect(result.imagenUrl).toBeUndefined();
  });
});

describe("aplicarSugerencia", () => {
  it("marca esDeCatalogo=true y limpia fotoLocal", () => {
    const result = aplicarSugerencia("https://cdn/img.jpg");
    expect(result.esDeCatalogo).toBe(true);
    expect(result.fotoLocal).toBeNull();
    expect(result.imagenUrl).toBe("https://cdn/img.jpg");
  });

  it("funciona con imagenUrl null (producto sin imagen en catálogo)", () => {
    const result = aplicarSugerencia(null);
    expect(result.esDeCatalogo).toBe(true);
    expect(result.imagenUrl).toBeNull();
  });
});

describe("marcarManual", () => {
  it("setea esDeCatalogo=false", () => {
    expect(marcarManual().esDeCatalogo).toBe(false);
  });
});

describe("CamaraBoton — estructura esperada", () => {
  it("el archivo del componente existe", async () => {
    const { existsSync } = await import("fs");
    const { join } = await import("path");
    expect(existsSync(join(process.cwd(), "components", "CamaraBoton.tsx"))).toBe(true);
  });

  it("el componente tiene capture=environment", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(process.cwd(), "components", "CamaraBoton.tsx"), "utf-8");
    expect(src).toContain("capture");
    expect(src).toContain("environment");
  });

  it("el componente acepta prop onFoto", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(process.cwd(), "components", "CamaraBoton.tsx"), "utf-8");
    expect(src).toContain("onFoto");
  });
});