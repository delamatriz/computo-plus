import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto } from "@/lib/sesion";
import { sumarAportesPatronalesPct } from "@/lib/apu-calc";
import { lunesDeSemana, esFechaISO } from "@/lib/jornalesPagados";

const INCLUDE_PERSONA = { personalObra: { select: { id: true, nombre: true, cuadrilla: true } } } as const;

// % de aportes patronales vigente del proyecto (Leyes Sociales), el mismo
// que entra al precio de los rubros. Sin LeyesSociales todavía → default legal.
async function pctAportesDelProyecto(proyectoId: string): Promise<number> {
  const leyes = await db.leyesSociales.findUnique({ where: { proyectoId } });
  return sumarAportesPatronalesPct(leyes);
}

// GET — registros de la planilla (más nuevos primero) y el % de aportes
// vigente, para mostrarlo antes de cargar una semana nueva.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const [registros, aportesPatronalesPct] = await Promise.all([
      db.jornalPagado.findMany({
        where: { proyectoId: id },
        include: INCLUDE_PERSONA,
        orderBy: [{ semana: "desc" }, { createdAt: "asc" }],
      }),
      pctAportesDelProyecto(id),
    ]);
    return NextResponse.json({ registros, aportesPatronalesPct });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/jornales]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST { semana, personalObraIds: string[] } — agrega a la planilla de esa
// semana a cada persona, con 0 días y el jornal de su categoría laboral
// (editables después, inline). Las que ya estaban en esa semana se saltean,
// así "Cargar semana" se puede repetir sin duplicar.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => ({}));
    const { semana, personalObraIds } = body as { semana?: unknown; personalObraIds?: unknown };

    if (!esFechaISO(semana)) {
      return NextResponse.json({ error: "Falta la semana" }, { status: 400 });
    }
    if (!Array.isArray(personalObraIds) || personalObraIds.length === 0 || personalObraIds.some((p) => typeof p !== "string")) {
      return NextResponse.json({ error: "Falta el personal" }, { status: 400 });
    }

    const personas = await db.personalObra.findMany({
      where: { id: { in: personalObraIds as string[] }, proyectoId: id },
      include: { categoriaLaboral: { select: { nombre: true, jornal: true } } },
    });
    if (personas.length !== personalObraIds.length) {
      return NextResponse.json({ error: "Personal no encontrado en este proyecto" }, { status: 404 });
    }

    const lunes = new Date(`${lunesDeSemana(semana)}T00:00:00Z`);
    const aportesPatronalesPct = await pctAportesDelProyecto(id);
    const { count } = await db.jornalPagado.createMany({
      data: personas.map((p) => ({
        proyectoId: id,
        personalObraId: p.id,
        semana: lunes,
        diasTrabajados: 0,
        jornal: p.categoriaLaboral.jornal,
        categoria: p.categoriaLaboral.nombre,
        aportesPatronalesPct,
      })),
      skipDuplicates: true,
    });

    const registros = await db.jornalPagado.findMany({
      where: { proyectoId: id, semana: lunes },
      include: INCLUDE_PERSONA,
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ creados: count, registros }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/jornales]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
