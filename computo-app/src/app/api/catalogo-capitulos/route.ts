import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Fase 2 — catálogo canónico de capítulo/subcapítulo (CapituloCatalogo/
// SubcapituloCatalogo). Lo consume el cliente para resolver nombre → id
// y pedirle a /api/subrubros-estandar que filtre por capituloId/
// subcapituloId en vez de por string. Ver
// FASE2-DISENO-UNIFICACION-TAXONOMIAS.md, Etapa 3.
export async function GET() {
  try {
    const capitulos = await db.capituloCatalogo.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      include: { subcapitulos: { orderBy: { orden: "asc" } } },
    });
    return NextResponse.json(capitulos);
  } catch (err) {
    console.error("[GET /api/catalogo-capitulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
