import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

/** Normaliza tildes y convierte a minúsculas para búsqueda en SQLite */
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

type FilaMTOP = {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number;
  precioConIva: number;
  cantidadUnidad: string;
  numeroLista: number;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    // SQLite no soporta mode:'insensitive' de Prisma (solo PostgreSQL).
    // Usamos $queryRaw con LOWER() en ambos lados para case-insensitive.
    // El término se normaliza (sin tildes) para cubrir "hormigon" → "Hormigón".
    const qNorm = normalizar(q);
    const patron = `%${qNorm}%`;

    const resultados = await db.$queryRaw<FilaMTOP[]>(
      Prisma.sql`
        SELECT id, codigo, descripcion, unidad,
               precioUnitario, precioConIva, cantidadUnidad, numeroLista
        FROM   PrecioMTOP
        WHERE  LOWER(descripcion) LIKE ${patron}
            OR LOWER(descripcion) LIKE ${"%" + q.toLowerCase() + "%"}
        ORDER BY descripcion ASC
        LIMIT 8
      `
    );

    return NextResponse.json(resultados);
  } catch (err) {
    console.error("[GET /api/precios-mtop]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
