import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSesion } from "@/lib/sesion";

// Biblioteca personal de rubros de la empresa del usuario (SubrubroEmpresa),
// con sus APUs completos. ?q= filtra por nombre (contiene, sin distinguir
// mayúsculas).
export async function GET(req: NextRequest) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;

  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const subrubros = await db.subrubroEmpresa.findMany({
      where: {
        empresaId: sesion.empresaId,
        ...(q ? { nombre: { contains: q, mode: "insensitive" as const } } : {}),
      },
      orderBy: { nombre: "asc" },
      include: {
        apus: {
          include: {
            materiales: true,
            equipos: true,
            manoObra: true,
          },
        },
      },
    });
    return NextResponse.json(subrubros);
  } catch (err) {
    console.error("[GET /api/mi-biblioteca]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
