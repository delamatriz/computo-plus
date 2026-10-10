import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularPrecioUnitario, sumarAportesPatronalesPct } from "@/lib/apu-calc";
import {
  calcularCostoDirectoAgregado,
  calcularCostosIndirectosAgregados,
  calcularCostosIndirectosExento,
  calcularUtilidadAgregada,
  costoDirectoUnitario,
  type ApuParaCosto,
} from "@/lib/costoAgregado";
import { requerirProyecto } from "@/lib/sesion";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

const EPS = 1e-9;
const redondear2 = (n: number) => Math.round(n * 100) / 100;

// Propaga los aportes patronales VIGENTES del proyecto (la suma de los cinco
// fondos de su LeyesSociales: FOCER, FSC/FOCAP, FOSVOC, FRL, Fondo de Garantía)
// a APU.aportesPatronalesPct de los rubros ya creados. Sin esto, cambiar el
// FOCER (5% ↔ 0,5%) u otro fondo en la tarjeta Leyes Sociales solo afecta a los
// rubros que se creen después: cada APU guarda su % congelado.
//
// Mismo patrón de dos pasos que propagar-utilidad: dryRun=true solo calcula la
// vista previa (nada se escribe); sin dryRun aplica. No toca proyectos
// FINALIZADO (mismo guard), ni rubros con precioCongelado (se listan como
// protegidos), y los rubros sin APU se saltean (no hay desglose del que
// partir). Si el proyecto ya tiene contrato, órdenes de compra, certificaciones
// o liquidación final, la vista previa lo avisa y aplicar exige
// `confirmarContrato: true` (cambiar precios altera lo contratado).
//
// precioUnit se recalcula con la fórmula canónica (calcularPrecioUnitario) a
// partir del costo directo real de cada rubro con el % nuevo — nunca se
// re-deriva del precio viejo — y se escribe como número directo vía Prisma
// (sin parsearDineroTipeado ni String()): mismo patrón que propagar-utilidad y
// recalcularPrecioRubro.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const acceso = await requerirProyecto(proyectoId);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => null);
    const dryRun = body?.dryRun === true;
    const confirmarContrato = body?.confirmarContrato === true;

    const proyecto = await db.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
        leyesSociales: true,
        contrato: { select: { id: true } },
        liquidacionFinal: { select: { id: true } },
        _count: { select: { certificaciones: true, ordenesCompra: true } },
        capitulos: {
          orderBy: { orden: "asc" },
          include: {
            rubros: {
              orderBy: { codigo: "asc" },
              include: { apu: { include: { materiales: true, manoObra: true, equipos: true } } },
            },
          },
        },
      },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    if (proyecto.estado === "FINALIZADO") {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    const pctNuevo = sumarAportesPatronalesPct(proyecto.leyesSociales);
    const rubros = proyecto.capitulos.flatMap((c) => c.rubros);

    const aActualizar: { rubroId: string; precioNuevo: number }[] = [];
    const protegidos: { rubroId: string; codigo: string; descripcion: string }[] = [];
    let sinApu = 0;
    let yaAlDia = 0;

    const apuAntes: Record<string, ApuParaCosto> = {};
    const apuDespues: Record<string, ApuParaCosto> = {};
    const rubrosAntes: { id: string; cantidad: number; precioUnit: number }[] = [];
    const rubrosDespues: { id: string; cantidad: number; precioUnit: number }[] = [];

    for (const r of rubros) {
      rubrosAntes.push({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit });
      if (!r.apu) {
        sinApu++;
        rubrosDespues.push({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit });
        continue;
      }
      const viejo: ApuParaCosto = {
        materiales: r.apu.materiales,
        manoObra: r.apu.manoObra,
        equipos: r.apu.equipos,
        aportesPatronalesPct: r.apu.aportesPatronalesPct,
        utilidadPct: r.apu.utilidadPct,
      };
      apuAntes[r.id] = viejo;
      if (Math.abs(r.apu.aportesPatronalesPct - pctNuevo) < EPS) {
        yaAlDia++;
        apuDespues[r.id] = viejo;
        rubrosDespues.push({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit });
        continue;
      }
      if (r.precioCongelado != null) {
        protegidos.push({ rubroId: r.id, codigo: r.codigo, descripcion: r.descripcion });
        apuDespues[r.id] = viejo;
        rubrosDespues.push({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit });
        continue;
      }
      const nuevo: ApuParaCosto = { ...viejo, aportesPatronalesPct: pctNuevo };
      const precioNuevo = redondear2(calcularPrecioUnitario(costoDirectoUnitario(nuevo), r.apu.utilidadPct));
      aActualizar.push({ rubroId: r.id, precioNuevo });
      apuDespues[r.id] = nuevo;
      rubrosDespues.push({ id: r.id, cantidad: r.cantidad, precioUnit: precioNuevo });
    }

    // Costo Total y Precio Final con las mismas funciones que la pantalla, el
    // PDF, el contrato y la liquidación (costoAgregado.ts).
    const totales = (rs: typeof rubrosAntes, d: Record<string, ApuParaCosto>) => {
      const caps = [{ rubros: rs }];
      const cd = calcularCostoDirectoAgregado(caps, d).total;
      const ci = calcularCostosIndirectosAgregados(
        proyecto.modoGastosGenerales, proyecto.gastosGeneralesDetallado, proyecto.gastosGeneralesPctDefault, cd, proyecto.gastosGeneralesItems, proyecto.imprevistosPct
      );
      const exento = calcularCostosIndirectosExento(proyecto.modoGastosGenerales, proyecto.gastosGeneralesDetallado);
      const ut = calcularUtilidadAgregada(caps, d);
      const costoTotal = cd + ci + ut;
      return { costoTotal, precioFinal: costoTotal + (costoTotal - exento) * 0.22 };
    };
    const antes = totales(rubrosAntes, apuAntes);
    const despues = totales(rubrosDespues, apuDespues);

    const contratado = {
      contrato: !!proyecto.contrato,
      certificaciones: proyecto._count.certificaciones,
      ordenesCompra: proyecto._count.ordenesCompra,
      liquidacionFinal: !!proyecto.liquidacionFinal,
    };
    const requiereConfirmacion =
      contratado.contrato || contratado.certificaciones > 0 || contratado.ordenesCompra > 0 || contratado.liquidacionFinal;

    if (dryRun) {
      return NextResponse.json({
        actualizarian: aActualizar.length,
        protegidos,
        sinApu,
        yaAlDia,
        pctNuevo,
        antes,
        despues,
        contratado,
        requiereConfirmacion,
      });
    }

    if (requiereConfirmacion && !confirmarContrato) {
      return NextResponse.json(
        {
          error: "requiere_confirmacion_contrato",
          mensaje:
            "Este proyecto ya tiene contrato, órdenes de compra, certificaciones o liquidación: cambiar precios altera lo contratado. Confirmá explícitamente para continuar.",
          contratado,
        },
        { status: 409 }
      );
    }

    // Una sola transacción: o se actualizan todos los rubros o ninguno. El
    // timeout por defecto de Prisma (5 s) no alcanza con la base remota y ~20
    // rubros (2 escrituras c/u).
    await db.$transaction(
      async (tx) => {
        for (const a of aActualizar) {
          await tx.aPU.update({ where: { rubroId: a.rubroId }, data: { aportesPatronalesPct: pctNuevo } });
          await tx.rubro.update({ where: { id: a.rubroId }, data: { precioUnit: a.precioNuevo } });
        }
      },
      { timeout: 120_000, maxWait: 20_000 }
    );

    return NextResponse.json({ actualizados: aActualizar.length, protegidos, sinApu, yaAlDia, pctNuevo, antes, despues });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/propagar-aportes-patronales]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
