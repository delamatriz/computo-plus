import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unidadPorDimensiones, contarCargados, calcularDesvinculacion } from "@/lib/recalculoUnidadFila";

// DELETE — borra una marca de medición (corrección de un trazo mal hecho,
// ver /mediciones/route.ts para GET+POST). Valida que la medición
// pertenezca al documento de la URL antes de borrar, para no depender
// únicamente del id.
//
// Si esta medición es el LARGO de una fila (FilaMetraje.medicionId), esa
// fila se borra sola en cascada (onDelete: Cascade) — no hace falta
// tocar nada más acá. Si es el ANCHO de una fila (medicionAnchoId,
// onDelete: SetNull a propósito — ver comentario en el schema), el FK
// se limpia solo, pero `ancho` y `unidad` no: si no se recalculan acá
// también, la fila queda con un número que ya no tiene ningún trazo
// detrás. Misma lógica de recálculo que el PATCH de filas-metraje (ver
// src/lib/recalculoUnidadFila.ts) para que no queden dos criterios
// distintos.
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; docId: string; medicionId: string }> }
) {
  try {
    const { docId, medicionId } = await context.params;

    const medicion = await db.medicionDocumento.findUnique({
      where: { id: medicionId },
      select: { documentoId: true },
    });
    if (!medicion || medicion.documentoId !== docId) {
      return NextResponse.json({ error: "Medición no encontrada" }, { status: 404 });
    }

    const filaComoAncho = await db.filaMetraje.findFirst({
      where: { medicionAnchoId: medicionId },
      select: { id: true, alto: true, rubroId: true, medicion: { select: { tipo: true } } },
    });

    await db.medicionDocumento.delete({ where: { id: medicionId } });

    let filaActualizada = null;
    let desvinculado: { nombre: string; unidadNueva: string } | null = null;

    if (filaComoAncho && filaComoAncho.medicion) {
      const n = contarCargados(null, filaComoAncho.alto);
      const unidadNueva = unidadPorDimensiones(filaComoAncho.medicion.tipo === "AREA" ? "AREA" : "LINEA", n);
      const data: { ancho: null; medicionAnchoId: null; unidad: string; rubroId?: null } = {
        ancho: null,
        medicionAnchoId: null,
        unidad: unidadNueva,
      };
      if (filaComoAncho.rubroId) {
        const d = await calcularDesvinculacion(filaComoAncho.rubroId, unidadNueva);
        if (d) {
          data.rubroId = null;
          desvinculado = d;
        }
      }
      filaActualizada = await db.filaMetraje.update({ where: { id: filaComoAncho.id }, data });
    }

    return NextResponse.json({ ok: true, filaActualizada, desvinculado });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/documentos-metraje/[docId]/mediciones/[medicionId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
