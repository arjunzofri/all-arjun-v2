"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEdicionConteo, type EdicionConteo } from "@/components/inventario/useEdicionConteo";
import type { ConflictoVista } from "@/components/inventario/FormularioConteoVista";
import { registrarConteo } from "@/lib/inventario/conteos";
import type { BorradorConteo } from "@/lib/inventario/borradores-conteo";
import type { FilaInventario } from "@/lib/inventario/consultas";
import { crearEnvioConteo } from "@/lib/inventario/envio-conteo";
import { etiquetaUbicacion } from "@/lib/inventario/ubicaciones";

type ConflictoInterno = ConflictoVista & { clave: string; nonce: string };
export type EnvioConteo = {
  edicion: EdicionConteo; estado: "listo" | "guardando"; conflicto: ConflictoVista | null;
  guardar(): void; reintentar(): void; volverAContar(): void; seguirRevisando(): void; descartar(): void;
};

export function useEnvioConteo(fila: FilaInventario, usuarioId: string): EnvioConteo {
  const [estado, setEstado] = useState<"listo" | "guardando">("listo");
  const [conflicto, setConflicto] = useState<ConflictoInterno | null>(null);
  const edicion = useEdicionConteo(fila, usuarioId, estado === "guardando");
  const router = useRouter();
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const ctrl = useMemo(
    () => crearEnvioConteo({ accion: registrarConteo, descartar: edicion.descartarEn }),
    [edicion.descartarEn],
  );
  const visible = conflicto && conflicto.clave === edicion.clave ? conflicto : null;

  const enviar = async () => {
    if (ctrl.ocupado || estado !== "listo" || visible || !edicion.clave || !edicion.ubicacion || edicion.cantidad === null) return;
    const b: BorradorConteo | null = edicion.guardarBorrador();
    if (!b) return;
    const clave = edicion.clave;
    setEstado("guardando");
    const r = await ctrl.enviar(b);
    if (!montado.current || r.tipo === "ocupado") return;
    setEstado("listo");
    if (r.tipo === "exito") {
      edicion.limpiarEdicion(); setConflicto(null);
      edicion.avisar({ tono: "exito", texto: `${r.repetido ? "Conteo ya registrado" : "Conteo guardado"}: ${r.cantidad} unidades en ${etiquetaUbicacion(b.ubicacion)}.` });
      router.refresh();
    } else if (r.tipo === "conflicto") {
      setConflicto({ clave, nonce: r.nonce, vigente: r.vigente, propuesta: r.propuesta });
    } else {
      edicion.avisar({ tono: "error", texto: r.mensaje });
    }
  };

  const volverAContar = () => {
    if (ctrl.ocupado || !edicion.ubicacion || edicion.cantidad === null || !edicion.draft || !visible) return;
    edicion.descartarEn(fila.id, edicion.ubicacion, edicion.draft.nonce);
    const b = edicion.guardarBorrador({ expectedConteoId: visible.vigente?.id ?? null });
    if (!b) return;
    edicion.limpiarEdicion(); setConflicto(null);
    edicion.avisar({ tono: "info", texto: "Puedes volver a contar y guardar una nueva cantidad." });
    router.refresh();
  };

  return {
    edicion, estado,
    conflicto: visible ? { vigente: visible.vigente, propuesta: visible.propuesta } : null,
    guardar: () => void enviar(), reintentar: () => void enviar(),
    volverAContar, seguirRevisando: () => setConflicto(null),
    descartar: () => { if (ctrl.ocupado) return; edicion.descartarActual(); setConflicto(null); },
  };
}
