import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [estandar, manuales] = await Promise.all([
      db.capituloEstandar.findMany({
        where: { origen: "estandar" },
        orderBy: { orden: "asc" },
      }),
      db.capituloEstandar.findMany({
        where: { origen: "manual" },
        orderBy: { vecesUsado: "desc" },
      }),
    ]);

    return NextResponse.json([...estandar, ...manuales]);
  } catch (err) {
    console.error("[GET /api/capitulos-estandar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre } = await req.json();

    if (!nombre?.trim()) {
      return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
    }

    const nombreLimpio = nombre.trim();
    const existente = await db.capituloEstandar.findUnique({ where: { nombre: nombreLimpio } });

    const capitulo = existente
      ? await db.capituloEstandar.update({
          where: { nombre: nombreLimpio },
          data: { vecesUsado: existente.vecesUsado + 1 },
        })
      : await db.capituloEstandar.create({
          data: {
            nombre: nombreLimpio,
            origen: "manual",
            orden: 999 + (await db.capituloEstandar.count({ where: { origen: "manual" } })),
          },
        });

    return NextResponse.json(capitulo);
  } catch (err) {
    console.error("[POST /api/capitulos-estandar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
