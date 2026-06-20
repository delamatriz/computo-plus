import { NextRequest, NextResponse } from "next/server";
import { generarApuParaRubro } from "@/lib/apu";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rubroId } = await params;
    const body = await req.json();
    const { descripcion, unidad, capitulo, tipoObra } = body as {
      descripcion: string;
      unidad: string;
      capitulo: string;
      tipoObra: string;
    };

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    }

    const apu = await generarApuParaRubro(rubroId, { descripcion, unidad, capitulo, tipoObra });

    return NextResponse.json({
      materiales: apu.materiales,
      manoObra: apu.manoObra,
      precioUnitarioEstimado: apu.precioUnitarioEstimado,
    });
  } catch (err) {
    console.error("[sugerir-apu]", err);
    return NextResponse.json({ error: "Error al generar APU" }, { status: 500 });
  }
}
