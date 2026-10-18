import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSesion, esSuperadmin } from "@/lib/sesion";

// Marca como leídos (para toda la empresa) los avisos que la campanita mostró. El cliente manda
// los ids que recibió en GET /api/notificaciones: así un aviso creado entre el GET y el click
// no queda leído sin haberse visto. skipDuplicates: abrir el panel dos veces (o desde dos
// pestañas / dos usuarios de la empresa) no falla por el @@unique([avisoId, empresaId]).
export async function POST(req: NextRequest) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    if (await esSuperadmin(sesion)) return NextResponse.json({ marcados: 0 });
    const body = await req.json().catch(() => null);
    const ids: string[] = Array.isArray(body?.avisoIds) ? body.avisoIds.filter((x: unknown): x is string => typeof x === "string") : [];
    if (ids.length === 0) return NextResponse.json({ marcados: 0 });

    const existentes = await db.aviso.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const { count } = await db.avisoLeido.createMany({
      data: existentes.map((a) => ({ avisoId: a.id, empresaId: sesion.empresaId })),
      skipDuplicates: true,
    });
    return NextResponse.json({ marcados: count });
  } catch (err) {
    console.error("[POST /api/notificaciones/marcar-leido]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
