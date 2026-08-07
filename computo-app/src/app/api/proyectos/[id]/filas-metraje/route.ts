import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Filas de la Planilla de cómputo — a diferencia de mediciones/anotaciones
// (que se listan por documento, porque se dibujan sobre UN plano puntual),
// acá el listado es a nivel de PROYECTO: la Planilla del Visor acumula
// filas de todos los documentos abiertos en la sesión (comportamiento ya
// existente antes de persistir esto, ver page.tsx), y "Aplicar al
// presupuesto" suma por rubro cruzando documentos (una misma partida
// puede medirse repartida en varios planos). Ver prisma/schema.prisma
// — FilaMetraje.

// GET — lista todas las filas de metraje del proyecto (todos los documentos).
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const filas = await db.filaMetraje.findMany({
      where: { documento: { proyectoId: id } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ filas });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/filas-metraje]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
