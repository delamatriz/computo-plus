import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unidadPorDimensiones, contarCargados, calcularDesvinculacion } from "@/lib/recalculoUnidadFila";
import { requerirProyecto, hijoNoEncontrado } from "@/lib/sesion";

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
//
// ?soloDibujo=1 — "Eliminar del dibujo" del Visor: borra SOLO el trazo del
// plano y deja intactas las filas de la Planilla que salieron de él. Antes
// de borrar se sueltan los vínculos (medicionId / medicionAnchoId a null),
// así el cascade no se lleva la fila y el ancho no se recalcula: la fila
// queda con sus valores, como una fila cargada a mano. Borrar el registro
// sigue siendo la X de la fila (DELETE .../filas-metraje/[filaId]).
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string; medicionId: string }> }
) {
  try {
    const { id: proyectoId, docId, medicionId } = await context.params;
    const acceso = await requerirProyecto(proyectoId);
    if (acceso instanceof NextResponse) return acceso;
    const docOk = await db.documentoMetraje.findFirst({ where: { id: docId, proyectoId: proyectoId }, select: { id: true } });
    if (!docOk) return hijoNoEncontrado("Documento no encontrado");

    const medicion = await db.medicionDocumento.findUnique({
      where: { id: medicionId },
      select: { documentoId: true },
    });
    if (!medicion || medicion.documentoId !== docId) {
      return NextResponse.json({ error: "Medición no encontrada" }, { status: 404 });
    }

    if (req.nextUrl.searchParams.get("soloDibujo") === "1") {
      const filasDesvinculadas = await db.$transaction(async (tx) => {
        const filas = await tx.filaMetraje.findMany({
          where: { OR: [{ medicionId }, { medicionAnchoId: medicionId }] },
          select: { id: true, medicionId: true, medicionAnchoId: true },
        });
        const actualizadas = [];
        for (const f of filas) {
          actualizadas.push(
            await tx.filaMetraje.update({
              where: { id: f.id },
              data: {
                ...(f.medicionId === medicionId ? { medicionId: null } : {}),
                ...(f.medicionAnchoId === medicionId ? { medicionAnchoId: null } : {}),
              },
            })
          );
        }
        await tx.medicionDocumento.delete({ where: { id: medicionId } });
        return actualizadas;
      });
      return NextResponse.json({ ok: true, filasDesvinculadas });
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
