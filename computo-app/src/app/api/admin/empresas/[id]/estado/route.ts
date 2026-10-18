import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DIAS_PRUEBA } from "@/lib/config-prueba";
import { requerirSuperadmin } from "@/lib/sesion";

// Panel /admin — cambia el estado de una empresa (solo SUPERADMIN). VENCIDA no
// se elige a mano: es automático (PRUEBA con la fecha pasada, ver lib/acceso.ts).
//   - ACTIVA: cliente pago. Pasa a usar la clave principal de Anthropic en la
//     siguiente llamada (lib/anthropic-client.ts lee el estado cada vez).
//   - PRUEBA: si la prueba ya había vencido (o no tenía fecha), arranca una
//     nueva de DIAS_PRUEBA días; si seguía vigente, conserva su fecha.
//   - DESACTIVADA: sin acceso (ni lectura).
const ESTADOS_ELEGIBLES = ["ACTIVA", "PRUEBA", "DESACTIVADA"] as const;
type EstadoElegible = (typeof ESTADOS_ELEGIBLES)[number];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const acceso = await requerirSuperadmin();
  if (acceso instanceof NextResponse) return acceso;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const estado = body?.estado as EstadoElegible;
    if (!(ESTADOS_ELEGIBLES as readonly string[]).includes(estado)) {
      return NextResponse.json({ error: "Estado inválido (ACTIVA, PRUEBA o DESACTIVADA)" }, { status: 400 });
    }

    const empresa = await db.empresa.findUnique({ where: { id }, select: { id: true, fechaVencimientoPrueba: true } });
    if (!empresa) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

    // La empresa del propio SUPERADMIN no puede salir de ACTIVA: se quedaría sin acceso al panel.
    if (empresa.id === acceso.empresaId && estado !== "ACTIVA") {
      return NextResponse.json({ error: "No podés pasar tu propia empresa a prueba ni desactivarla." }, { status: 400 });
    }

    const ahora = Date.now();
    const pruebaVigente = !!empresa.fechaVencimientoPrueba && empresa.fechaVencimientoPrueba.getTime() > ahora;
    const actualizada = await db.empresa.update({
      where: { id },
      data: {
        estado,
        ...(estado === "PRUEBA" && !pruebaVigente
          ? {
              fechaVencimientoPrueba: new Date(ahora + DIAS_PRUEBA * 24 * 60 * 60_000),
              // Prueba nueva: los avisos de vencimiento vuelven a corresponder (ver lib/vencimientosPrueba.ts).
              mailAviso11Enviado: false,
              mailAviso13Enviado: false,
              mailAviso14Enviado: false,
            }
          : {}),
      },
      select: { id: true, estado: true, fechaVencimientoPrueba: true },
    });
    return NextResponse.json({ empresa: actualizada });
  } catch (err) {
    console.error("[PATCH /api/admin/empresas/[id]/estado]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
