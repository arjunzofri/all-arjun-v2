/**
 * inv-22d-2 — logica pura del boton ACTUALIZAR (crearActualizador).
 */
import { describe, expect, it, vi } from "vitest";
import {
  crearActualizador, MAX_CORRIDAS, MSG_EN_CURSO, MSG_ERROR,
} from "@/components/inventario/ActualizarCompras";

const respuesta = (status: number, body: unknown) => ({
  status, ok: status >= 200 && status < 300, json: async () => body,
});

describe("crearActualizador (logica pura)", () => {
  it("pendientes encadena hasta false acumulando insertadas", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(respuesta(200, { pendientes: true, insertadas: 2 }))
      .mockResolvedValueOnce(respuesta(200, { pendientes: false, insertadas: 3 }));
    const r = await crearActualizador({ fetch })();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ estado: "ok", insertadas: 5, corridas: 2 });
  });

  it("respeta el tope MAX_CORRIDAS", async () => {
    const fetch = vi.fn(async () => respuesta(200, { pendientes: true, insertadas: 1 }));
    const r = await crearActualizador({ fetch })();
    expect(fetch).toHaveBeenCalledTimes(MAX_CORRIDAS);
    expect(r).toMatchObject({ estado: "ok", insertadas: MAX_CORRIDAS, corridas: MAX_CORRIDAS });
  });

  it("409 -> mensaje de sincronizacion en curso", async () => {
    const r = await crearActualizador({ fetch: vi.fn(async () => respuesta(409, {})) })();
    expect(r.estado).toBe("ocupado");
    expect(MSG_EN_CURSO).toBe("Sincronización en curso. Intenta en unos minutos.");
  });

  it("error -> mensaje fijo y el cerrojo se libera", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error("red"))
      .mockResolvedValueOnce(respuesta(200, { pendientes: false, insertadas: 0 }));
    const actualizar = crearActualizador({ fetch });
    expect(await actualizar()).toMatchObject({ estado: "error" });
    expect(MSG_ERROR).toBeTruthy();
    expect(await actualizar()).toMatchObject({ estado: "ok" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("doble clic dispara una sola cadena", async () => {
    let liberar!: (v: ReturnType<typeof respuesta>) => void;
    const fetch = vi.fn(() => new Promise<ReturnType<typeof respuesta>>((r) => { liberar = r; }));
    const actualizar = crearActualizador({ fetch });
    const p1 = actualizar(); const p2 = actualizar();
    expect(fetch).toHaveBeenCalledTimes(1);
    liberar(respuesta(200, { pendientes: false, insertadas: 0 }));
    expect(await p1).toEqual(await p2);
  });
});
