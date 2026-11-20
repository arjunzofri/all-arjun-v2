"use client";
import type { ReactElement } from "react";
import { useEnvioConteo } from "@/components/inventario/useEnvioConteo";
import { FormularioConteoVista } from "@/components/inventario/FormularioConteoVista";
import type { FilaInventario } from "@/lib/inventario/consultas";

/** Contenedor fino: conecta el hook de envío con la vista, sin lógica propia. */
export function FormularioConteo({ fila, usuarioId }: { fila: FilaInventario; usuarioId: string }): ReactElement {
  const envio = useEnvioConteo(fila, usuarioId);
  const e = envio.edicion;
  return (
    <FormularioConteoVista
      bodega={{ trabajo: e.bodegaTrabajo, sugerencia: e.bodegaTrabajo === null ? fila.sugerenciaBodega ?? null : null, onElegir: e.elegirBodega }}
      ubicacion={{ seleccion: e.seleccion, vigente: e.vigente, onCambiar: e.cambiarCampo }}
      cantidad={{ texto: e.texto, valor: e.cantidad, diferencia: e.diferencia, invalido: e.invalido, onCambiar: e.cambiarTexto }}
      borrador={{ actual: e.draft !== null, restaurable: e.restaurable, onRestaurar: e.restaurar, onDescartar: envio.descartar }}
      envio={{ estado: envio.estado, mensaje: e.mensaje, conflicto: envio.conflicto, onGuardar: envio.guardar, onReintentar: envio.reintentar, onVolverAContar: envio.volverAContar, onCancelarRevision: envio.seguirRevisando }}
    />
  );
}
