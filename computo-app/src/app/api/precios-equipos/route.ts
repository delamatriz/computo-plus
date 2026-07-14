import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Normaliza tildes para que "hormigonera" también encuentre "Hormigonera" */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n");
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const qNorm = normalizar(q);

    const resultados = await db.precioEquipo.findMany({
      where: {
        OR: [
          { descripcion: { contains: qNorm, mode: "insensitive" } },
          { descripcion: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        unidad: true,
        precioHora: true,
      },
      orderBy: { descripcion: "asc" },
      take: 8,
    });

    return NextResponse.json(resultados);
  } catch (err) {
    console.error("[GET /api/precios-equipos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
