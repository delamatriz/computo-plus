import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSesion } from "@/lib/sesion";

// Biblioteca personal de rubros de la empresa del usuario (SubrubroEmpresa),
// con sus APUs completos. ?q= filtra por nombre: tienen que aparecer todas
// las palabras, en cualquier orden, sin distinguir mayúsculas ni tildes
// ("picado revoques" encuentra "Picado de revoques"). Se filtra en memoria:
// Postgres no ignora tildes sin la extensión unaccent, y la biblioteca de
// una empresa es chica.
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

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
      where: { empresaId: sesion.empresaId },
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
    const palabras = q ? norm(q).split(/\s+/).filter(Boolean) : [];
    const filtrados = palabras.length
      ? subrubros.filter((s) => {
          const nombre = norm(s.nombre);
          return palabras.every((p) => nombre.includes(p));
        })
      : subrubros;
    return NextResponse.json(filtrados);
  } catch (err) {
    console.error("[GET /api/mi-biblioteca]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
