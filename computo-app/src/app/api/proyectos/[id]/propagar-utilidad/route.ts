import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { costoDirectoUnitario } from "@/lib/costoAgregado";
import { calcularPrecioUnitario } from "@/lib/apu-calc";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

interface RubroAfectado {
  rubroId: string;
  codigo: string;
  descripcion: string;
}

// Propaga un % de Utilidad a TODOS los rubros existentes del proyecto que
// tengan APU y no estén protegidos con el candado (APU.utilidadFija) —
// distinto de Proyecto.utilidadPctDefault, que solo pre-carga rubros
// NUEVOS y nunca toca los existentes (ver comentario en schema.prisma).
//
// dryRun=true: solo calcula y devuelve el preview (cuántos se
// actualizarían, cuáles quedan protegidos) — nada se escribe, mismo
// patrón de dos pasos que ya usa /api/configuracion/aplicar-precios-vigentes
// y la actualización por ICCV.
//
// precioUnit se recalcula con la fórmula canónica (calcularPrecioUnitario,
// apu-calc.ts) a partir del costoDirecto real de cada rubro — nunca se
// re-deriva del precioUnit viejo, así que no hereda ningún arrastre de
// redondeo previo. Escritura numérica directa vía Prisma (sin pasar por
// parsearDineroTipeado/String()) — mismo patrón ya usado en
// recalcularPrecioRubro.ts, evita el bug de inflación ~100x corregido hoy
// mismo en aplicarPrecioAPU (page.tsx).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const body = await req.json().catch(() => null);
    const utilidadPct = typeof body?.utilidadPct === "number" ? body.utilidadPct : null;
    const dryRun = body?.dryRun === true;

    if (utilidadPct === null) {
      return NextResponse.json({ error: "Se esperaba { utilidadPct: number }" }, { status: 400 });
    }

    const proyecto = await db.proyecto.findUnique({ where: { id: proyectoId }, select: { estado: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    if (proyecto.estado === "FINALIZADO") {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    const rubros = await db.rubro.findMany({
      where: { capitulo: { proyectoId } },
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        apu: { include: { materiales: true, manoObra: true, equipos: true } },
      },
    });

    const aActualizar: { rubroId: string; precioUnitNuevo: number }[] = [];
    const protegidos: RubroAfectado[] = [];

    for (const rubro of rubros) {
      // Sin APU propio — no hay costoDirecto del que partir, igual que el
      // resto de los flujos de recálculo masivo (ver
      // aplicar-precios-vigentes/route.ts, sinDesglose).
      if (!rubro.apu) continue;
      if (rubro.apu.utilidadFija) {
        protegidos.push({ rubroId: rubro.id, codigo: rubro.codigo, descripcion: rubro.descripcion });
        continue;
      }
      const costoDirecto = costoDirectoUnitario(rubro.apu);
      const precioUnitNuevo = Math.round(calcularPrecioUnitario(costoDirecto, utilidadPct) * 100) / 100;
      aActualizar.push({ rubroId: rubro.id, precioUnitNuevo });
    }

    if (dryRun) {
      return NextResponse.json({
        actualizarian: aActualizar.length,
        protegidos,
        nuevoPct: utilidadPct,
      });
    }

    await db.$transaction(async (tx) => {
      for (const r of aActualizar) {
        await tx.aPU.update({ where: { rubroId: r.rubroId }, data: { utilidadPct } });
        await tx.rubro.update({ where: { id: r.rubroId }, data: { precioUnit: r.precioUnitNuevo } });
      }
    });

    return NextResponse.json({ actualizados: aActualizar.length, protegidos, nuevoPct: utilidadPct });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/propagar-utilidad]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
