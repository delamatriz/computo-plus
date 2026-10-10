import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto } from "@/lib/sesion";

// Secciones opcionales de la Planilla de cómputo — a nivel de PROYECTO,
// igual que el listado de filas (ver GET /api/proyectos/[id]/filas-metraje
// y SeccionPlanilla en prisma/schema.prisma). La pertenencia de cada fila
// vive en FilaMetraje.seccionId (se cambia por el PATCH de la fila).

// GET — secciones del proyecto, en el orden en que se muestran.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const secciones = await db.seccionPlanilla.findMany({
      where: { proyectoId: id },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ secciones });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/secciones-planilla]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea una sección al final. El nombre puede venir vacío: la
// Planilla la crea con "Nueva sección" y el usuario lo edita inline.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => ({}));
    const nombre = typeof body?.nombre === "string" && body.nombre.trim() ? body.nombre.trim() : "Nueva sección";

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const ultima = await db.seccionPlanilla.findFirst({
      where: { proyectoId: id },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });
    const seccion = await db.seccionPlanilla.create({
      data: { proyectoId: id, nombre, orden: (ultima?.orden ?? -1) + 1 },
    });
    return NextResponse.json({ seccion });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/secciones-planilla]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
