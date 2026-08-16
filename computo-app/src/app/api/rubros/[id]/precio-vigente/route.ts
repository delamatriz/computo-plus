import { NextRequest, NextResponse } from "next/server";
import { calcularPrecioVigenteRubro } from "@/lib/recalcularPrecioRubro";

// Solo lectura — precio pactado (guardado) vs. precio vigente (recomputado
// contra PrecioMTOP/CategoriaLaboral), para el modal de "actualizar vs.
// mantener" de un rubro con precio congelado.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const resultado = await calcularPrecioVigenteRubro(id);
    if (!resultado) {
      return NextResponse.json({ error: "Rubro sin descompuesto" }, { status: 404 });
    }
    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[GET /api/rubros/[id]/precio-vigente]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
