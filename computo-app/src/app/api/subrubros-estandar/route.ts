import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const capitulo = req.nextUrl.searchParams.get("capitulo")?.trim();

  try {
    const subrubros = await db.subrubroEstandar.findMany({
      where: {
        activo: true,
        ...(capitulo ? { capitulo } : {}),
      },
      orderBy: { codigo: "asc" },
    });

    return NextResponse.json(subrubros);
  } catch (err) {
    console.error("[GET /api/subrubros-estandar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
