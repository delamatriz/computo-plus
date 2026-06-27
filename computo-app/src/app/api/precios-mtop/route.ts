import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Normaliza tildes para que "hormigon" también encuentre "Hormigón" */
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
  const codigosParam = req.nextUrl.searchParams.get("codigos")?.trim() ?? "";

  // Búsqueda exacta por lista de códigos — usada para cargar precios de
  // referencia de materiales que no son resultado de búsqueda libre.
  if (codigosParam) {
    try {
      const codigos = codigosParam.split(",").map((c) => c.trim()).filter(Boolean);
      const resultados = await db.precioMTOP.findMany({
        where: { codigo: { in: codigos } },
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          unidad: true,
          precioUnitario: true,
          precioConIva: true,
          cantidadUnidad: true,
          numeroLista: true,
        },
        orderBy: { descripcion: "asc" },
      });
      return NextResponse.json(resultados);
    } catch (err) {
      console.error("[GET /api/precios-mtop?codigos]", err);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  }

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const qNorm = normalizar(q);

    const resultados = await db.precioMTOP.findMany({
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
        precioUnitario: true,
        precioConIva: true,
        cantidadUnidad: true,
        numeroLista: true,
      },
      orderBy: { descripcion: "asc" },
      take: 8,
    });

    return NextResponse.json(resultados);
  } catch (err) {
    console.error("[GET /api/precios-mtop]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — actualiza precioUnitario (y precioConIva) de materiales existentes
// por código. Usado por la sección "Precios de Referencia de Materiales" en
// Configuración para materiales que no están en la Lista MTOP N°599.
export async function PATCH(req: NextRequest) {
  try {
    const { materiales } = await req.json();

    if (!Array.isArray(materiales)) {
      return NextResponse.json({ error: "Falta el array de materiales" }, { status: 400 });
    }

    await Promise.all(
      materiales
        .filter((m) => m?.codigo && Number.isFinite(m.precioUnitario))
        .map((m: { codigo: string; precioUnitario: number }) =>
          db.precioMTOP.update({
            where: { codigo: m.codigo },
            data: { precioUnitario: m.precioUnitario, precioConIva: m.precioUnitario },
          })
        )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/precios-mtop]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
