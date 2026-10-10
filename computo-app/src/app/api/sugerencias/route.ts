import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { esSuperadmin, requerirSesion } from "@/lib/sesion";

// Buzón de Sugerencias (/sugerencias) — texto libre, sin categorías.
// Orden por más reciente primero: es un buzón, no un historial cronológico.
// Cada empresa ve solo las suyas; SUPERADMIN ve todas, con el nombre de la
// empresa que la mandó.
export async function GET() {
  try {
    const sesion = await requerirSesion();
    if (sesion instanceof NextResponse) return sesion;

    if (await esSuperadmin(sesion)) {
      const sugerencias = await db.sugerencia.findMany({
        orderBy: { createdAt: "desc" },
        include: { empresa: { select: { nombre: true } } },
      });
      return NextResponse.json(
        sugerencias.map((s: typeof sugerencias[number]) => ({
          id: s.id,
          mensaje: s.mensaje,
          resuelta: s.resuelta,
          createdAt: s.createdAt,
          empresaId: s.empresaId,
          empresaNombre: s.empresa?.nombre ?? null,
        }))
      );
    }

    const sugerencias = await db.sugerencia.findMany({
      where: { empresaId: sesion.empresaId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sugerencias);
  } catch (err) {
    console.error("[GET /api/sugerencias]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sesion = await requerirSesion();
    if (sesion instanceof NextResponse) return sesion;
    const { mensaje } = await req.json();
    if (!mensaje || !String(mensaje).trim()) {
      return NextResponse.json({ error: "El mensaje es obligatorio" }, { status: 400 });
    }
    const sugerencia = await db.sugerencia.create({
      data: { mensaje: String(mensaje).trim(), empresaId: sesion.empresaId },
    });
    return NextResponse.json(sugerencia, { status: 201 });
  } catch (err) {
    console.error("[POST /api/sugerencias]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
