import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Fase 2, Etapa 5 — filas de ParticionSubcapitulo, con el capituloCatalogoId
// del subcapítulo ya resuelto (join), para que el cliente pueda decidir sin
// otra ida y vuelta si un CapituloCatalogo tiene particiones y a cuál
// capítulo real le corresponde cada una. Ver abrirSubrubrosPanel en
// src/app/proyectos/[id]/page.tsx.
export async function GET() {
  try {
    const particiones = await db.particionSubcapitulo.findMany({
      include: { subcapitulo: { select: { capituloCatalogoId: true } } },
    });
    const resultado = particiones.map((p) => ({
      subcapituloId: p.subcapituloId,
      capituloRealDestino: p.capituloRealDestino,
      capituloCatalogoId: p.subcapitulo.capituloCatalogoId,
    }));
    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[GET /api/particion-subcapitulo]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
