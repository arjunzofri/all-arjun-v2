/**
 * Fase B — Bug P-20261110-2352-1: el proxy interceptaba /manifest.json y los
 * iconos PWA (el navegador los pide sin cookies → 307 a /login).
 *
 * El matcher de Next se interpreta como `^<matcher>$` para rutas que empiezan
 * con "/". Es la equivalencia documentada de paths-to-regexp para strings
 * simples como este (sin grupos :param ni comodines).
 */

import { describe, it, expect } from "vitest";
import { config } from "@/proxy";

const matcher = config.matcher[0];
const coincide = (pathname: string) => new RegExp(`^${matcher}$`).test(pathname);

describe("proxy matcher — archivos públicos de la PWA", () => {
  it("NO protege manifest ni iconos", () => {
    for (const p of ["/manifest.json", "/icon-192.png", "/icon-512.png"]) {
      expect(coincide(p), `${p} no debe pasar por el proxy`).toBe(false);
    }
  });

  it("sigue protegiendo las rutas de la app", () => {
    for (const p of ["/", "/usuarios", "/api/productos", "/manifest.json.bak"]) {
      expect(coincide(p), `${p} debe seguir protegida`).toBe(true);
    }
  });
});
