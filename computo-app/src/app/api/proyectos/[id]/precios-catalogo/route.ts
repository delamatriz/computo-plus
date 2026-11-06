import { NextRequest, NextResponse } from "next/server";
import { requerirProyecto } from "@/lib/sesion";
import { preciosCatalogoParaProyecto } from "@/lib/preciosCatalogoProyecto";

// GET ?capituloId=<CapituloCatalogo.id> → { [subrubroId]: precio en pesos }:
// el precio con que entraría cada rubro del catálogo a este proyecto (ver
// lib/preciosCatalogoProyecto.ts). Lo usa el panel de rubros del capítulo
// para mostrar el mismo precio que después queda en el proyecto.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: proyectoId } = await params;
    const acceso = await requerirProyecto(proyectoId);
    if (acceso instanceof NextResponse) return acceso;

    const capituloId = req.nextUrl.searchParams.get("capituloId")?.trim();
    if (!capituloId) return NextResponse.json({ error: "Falta capituloId" }, { status: 400 });

    const precios = await preciosCatalogoParaProyecto(proyectoId, capituloId);
    if (!precios) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    return NextResponse.json(precios);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/precios-catalogo]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
