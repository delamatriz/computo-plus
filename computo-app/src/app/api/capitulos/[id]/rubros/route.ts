import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: capituloId } = await params;

    const capitulo = await db.capitulo.findUnique({
      where: { id: capituloId },
      select: { proyecto: { select: { estado: true } } },
    });
    if (capitulo?.proyecto.estado === "FINALIZADO") {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    const ultimo = await db.rubro.findFirst({
      where: { capituloId },
      orderBy: { createdAt: "desc" },
      select: { codigo: true },
    });

    const n = ultimo ? parseInt(ultimo.codigo.replace(/\D/g, "") || "0") + 1 : 1;

    const rubro = await db.rubro.create({
      data: {
        capituloId,
        codigo:      `R${String(n).padStart(3, "0")}`,
        descripcion: "",
        unidad:      "",
        cantidad:    0,
        precioUnit:  0,
      },
    });

    return NextResponse.json(rubro, { status: 201 });
  } catch (err) {
    console.error("[POST /api/capitulos/[id]/rubros]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
