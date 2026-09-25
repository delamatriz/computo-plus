import { NextRequest, NextResponse } from "next/server";
import { clonarApuAlRubro, ProyectoFinalizadoError } from "@/lib/clonarApu";

// POST — clona el APUEstandar de un subrubro de biblioteca al APU real de un rubro
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subrubroId } = await params;
    const { rubroId } = await req.json();

    if (!rubroId) {
      return NextResponse.json({ error: "Falta rubroId" }, { status: 400 });
    }

    const resultado = await clonarApuAlRubro(subrubroId, rubroId);
    return NextResponse.json(resultado);
  } catch (err) {
    if (err instanceof ProyectoFinalizadoError) {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: err.message }, { status: 403 });
    }
    console.error("[POST /api/subrubros-estandar/[id]/clonar-apu]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
