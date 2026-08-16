import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aplicarPrecioVigenteRubro } from "@/lib/recalcularPrecioRubro";

// "Actualizar al precio vigente" — elegido en el modal de un rubro con
// precio pactado. Mismo guard que el resto de las escrituras de rubro: un
// presupuesto FINALIZADO ya está de solo lectura (para eso está "Habilitar
// edición" primero).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rubro = await db.rubro.findUnique({
      where: { id },
      select: { capitulo: { select: { proyecto: { select: { estado: true } } } } },
    });
    if (!rubro) {
      return NextResponse.json({ error: "Rubro no encontrado" }, { status: 404 });
    }
    if (rubro.capitulo.proyecto.estado === "FINALIZADO") {
      return NextResponse.json(
        {
          error: "proyecto_finalizado",
          mensaje: "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.",
        },
        { status: 403 }
      );
    }

    const resultado = await aplicarPrecioVigenteRubro(id);
    if (!resultado) {
      return NextResponse.json({ error: "Rubro sin descompuesto" }, { status: 404 });
    }
    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[POST /api/rubros/[id]/actualizar-precio-vigente]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
