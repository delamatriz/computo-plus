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

    // ?modo=nombres: solo id y nombre de cada rubro, sin el APU ni los insumos — lo usa el
    // presupuesto para saber qué rubros ya están en la biblioteca (comparar duplicados).
    if (req.nextUrl.searchParams.get("modo") === "nombres") {
      const nombres = await db.subrubroEmpresa.findMany({
        where: { empresaId: sesion.empresaId },
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      });
      return NextResponse.json(nombres);
    }

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
