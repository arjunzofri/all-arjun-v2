/**
 * Fase B — Bug P-20261111-0039-1: el menú mostraba "Usuarios" al operador.
 * La lista del menú es una función pura para poder probarla sin render.
 */

import { describe, it, expect } from "vitest";
import { itemsMenu } from "@/components/DashboardShell";

const hrefs = (opts: { showUsuarios: boolean; showInversion: boolean; showIdentificacion: boolean }) =>
  itemsMenu(opts).map((i) => i.href);

describe("itemsMenu() — visibilidad por rol", () => {
  it("operador NO ve /usuarios", () => {
    expect(hrefs({ showUsuarios: false, showInversion: false, showIdentificacion: true })).not.toContain("/usuarios");
  });

  it("admin SÍ ve /usuarios", () => {
    expect(hrefs({ showUsuarios: true, showInversion: false, showIdentificacion: true })).toContain("/usuarios");
  });

  it("mostrar Inversión no revela /usuarios si showUsuarios es false", () => {
    expect(hrefs({ showUsuarios: false, showInversion: true, showIdentificacion: false })).not.toContain("/usuarios");
  });

  it("el resto de la navegación base sigue presente", () => {
    const items = hrefs({ showUsuarios: false, showInversion: false, showIdentificacion: false });
    for (const href of ["/", "/productos", "/entradas", "/salidas", "/retornos", "/transferencias", "/bodegas", "/modulos", "/movimientos"]) {
      expect(items).toContain(href);
    }
  });
});
