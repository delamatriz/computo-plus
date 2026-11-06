import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularPrecioUnitario } from "@/lib/apu-calc";
import {
  calcularCostoDirectoAgregado,
  calcularCostosIndirectosAgregados,
  calcularCostosIndirectosExento,
  calcularUtilidadAgregada,
  costoDirectoUnitario,
  calcularMontoIva,
  type ApuParaCosto,
} from "@/lib/costoAgregado";
import { requerirProyecto } from "@/lib/sesion";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

const redondear2 = (n: number) => Math.round(n * 100) / 100;

// Activa o desactiva el descuento del IVA de compras de materiales en un
// proyecto (Proyecto.descuentaIvaCompras) y lo aplica a los rubros ya
// creados (APU.descuentaIvaMateriales + precioUnit recalculado). Ver
// sumMateriales en apu-calc.ts.
//
// Mismo patrón de dos pasos que propagar-aportes-patronales: dryRun=true
// solo calcula la vista previa (nada se escribe); sin dryRun aplica. No toca
// proyectos FINALIZADO, ni rubros con precio pactado (precioCongelado: se
// listan como protegidos y su APU queda como estaba, así su precio sigue
// coherente con su desglose), y los rubros sin APU se saltean (su precio se
// cargó a mano, no hay materiales que descontar). Si el proyecto ya tiene
// contrato, órdenes de compra, certificaciones o liquidación final, aplicar
// exige `confirmarContrato: true` (cambiar precios altera lo contratado).
//
// Body: { activar: boolean, dryRun?: boolean, confirmarContrato?: boolean }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const acceso = await requerirProyecto(proyectoId);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => null);
    if (typeof body?.activar !== "boolean") {
      return NextResponse.json({ error: "activar_invalido", mensaje: "Falta indicar si se activa o no." }, { status: 400 });
    }
    const activar: boolean = body.activar;
    const dryRun = body.dryRun === true;
    const confirmarContrato = body.confirmarContrato === true;

    const proyecto = await db.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
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
        descuentaIvaMateriales: r.apu.descuentaIvaMateriales,
      };
      apuAntes[r.id] = viejo;
      if (r.apu.descuentaIvaMateriales === activar) {
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
      const nuevo: ApuParaCosto = { ...viejo, descuentaIvaMateriales: activar };
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
      return { costoTotal, precioFinal: costoTotal + calcularMontoIva(costoTotal, exento, proyecto.facturaConIva) };
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
      aActualizar.length > 0 &&
      (contratado.contrato || contratado.certificaciones > 0 || contratado.ordenesCompra > 0 || contratado.liquidacionFinal);

    const resumen = { actualizarian: aActualizar.length, protegidos, sinApu, yaAlDia, antes, despues, contratado, requiereConfirmacion };
    if (dryRun) return NextResponse.json(resumen);

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

    // Una sola transacción: o queda todo aplicado o nada. Timeout amplio,
    // mismo criterio que propagar-aportes-patronales (base remota).
    await db.$transaction(
      async (tx) => {
        await tx.proyecto.update({ where: { id: proyectoId }, data: { descuentaIvaCompras: activar } });
        for (const a of aActualizar) {
          await tx.aPU.update({ where: { rubroId: a.rubroId }, data: { descuentaIvaMateriales: activar } });
          await tx.rubro.update({ where: { id: a.rubroId }, data: { precioUnit: a.precioNuevo } });
        }
      },
      { timeout: 120_000, maxWait: 20_000 }
    );

    return NextResponse.json({ ...resumen, actualizados: aActualizar.length, descuentaIvaCompras: activar });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/descuento-iva]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
