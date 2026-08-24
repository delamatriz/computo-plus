import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aplicarPrecioVigenteRubro } from "@/lib/recalcularPrecioRubro";

// Apply masivo — recibe la selección de rubros que quedaron tildados en la
// pantalla de revisión (ver dry-run/route.ts) y aplica cada uno con el
// mismo motor que el modal rubro-por-rubro. Un rubro individual que falle
// (ej. su proyecto volvió a FINALIZADO entre el dry-run y el apply) no
// aborta el lote — mismo guard 403 que POST /api/rubros/[id]/actualizar-precio-vigente,
// pero reportado por rubro en vez de cortar toda la corrida.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const rubroIds: string[] = Array.isArray(body?.rubroIds) ? body.rubroIds : [];

    if (rubroIds.length === 0) {
      return NextResponse.json({ error: "Se esperaba { rubroIds: string[] }" }, { status: 400 });
    }

    const errores: { rubroId: string; motivo: string }[] = [];
    let actualizados = 0;

    for (const rubroId of rubroIds) {
      try {
        const rubro = await db.rubro.findUnique({
          where: { id: rubroId },
          select: { capitulo: { select: { proyecto: { select: { estado: true } } } } },
        });
        if (!rubro) {
          errores.push({ rubroId, motivo: "Rubro no encontrado" });
          continue;
        }
        if (rubro.capitulo.proyecto.estado === "FINALIZADO") {
          errores.push({ rubroId, motivo: "Proyecto entregado — habilitá edición para actualizarlo" });
          continue;
        }

        const resultado = await aplicarPrecioVigenteRubro(rubroId);
        if (!resultado) {
          errores.push({ rubroId, motivo: "Rubro sin descompuesto" });
          continue;
        }
        actualizados++;
      } catch (err) {
        console.error(`[POST /api/configuracion/aplicar-precios-vigentes] rubro ${rubroId}`, err);
        errores.push({ rubroId, motivo: "Error interno" });
      }
    }

    return NextResponse.json({ actualizados, errores });
  } catch (err) {
    console.error("[POST /api/configuracion/aplicar-precios-vigentes]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
