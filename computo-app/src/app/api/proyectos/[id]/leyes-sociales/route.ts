import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularMOTotal } from "@/lib/calculos";

// GET — retorna el registro LeyesSociales del proyecto; lo crea con defaults si no existe
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;

    let leyesSociales = await db.leyesSociales.findUnique({ where: { proyectoId } });

    if (!leyesSociales) {
      const montoImponibleMO = await calcularMOTotal(proyectoId);
      leyesSociales = await db.leyesSociales.create({
        data: { proyectoId, montoImponibleMO },
      });
    }

    return NextResponse.json(leyesSociales);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/leyes-sociales]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — recalcula el monto imponible de mano de obra desde los APUs y lo persiste
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const montoImponibleMO = await calcularMOTotal(proyectoId);

    const leyesSociales = await db.leyesSociales.upsert({
      where: { proyectoId },
      update: { montoImponibleMO },
      create: { proyectoId, montoImponibleMO },
    });

    return NextResponse.json(leyesSociales);
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/leyes-sociales]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT — upsert de la configuración de Leyes Sociales del proyecto
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const body = await req.json();

    const campos = {
      ...(body.tipoContratante   !== undefined && { tipoContratante:   body.tipoContratante }),
      ...(body.montoImponibleMO  !== undefined && { montoImponibleMO:  body.montoImponibleMO }),
      ...(body.aucPct            !== undefined && { aucPct:            body.aucPct }),
      ...(body.focerPatronalPct  !== undefined && { focerPatronalPct:  body.focerPatronalPct }),
      ...(body.fscFocapPct       !== undefined && { fscFocapPct:       body.fscFocapPct }),
      ...(body.fosvocPct         !== undefined && { fosvocPct:         body.fosvocPct }),
      ...(body.frlPct            !== undefined && { frlPct:            body.frlPct }),
      ...(body.fondoGarantiaPct  !== undefined && { fondoGarantiaPct:  body.fondoGarantiaPct }),
      ...(body.snisAdicionalPct  !== undefined && { snisAdicionalPct:  body.snisAdicionalPct }),
      ...(body.focerPersonalPct  !== undefined && { focerPersonalPct:  body.focerPersonalPct }),
    };

    const leyesSociales = await db.leyesSociales.upsert({
      where: { proyectoId },
      update: campos,
      create: { proyectoId, ...campos },
    });

    return NextResponse.json(leyesSociales);
  } catch (err) {
    console.error("[PUT /api/proyectos/[id]/leyes-sociales]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
