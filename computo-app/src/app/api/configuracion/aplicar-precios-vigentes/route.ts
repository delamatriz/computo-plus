import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aplicarPrecioVigenteRubro, calcularPrecioVigenteRubro } from "@/lib/recalcularPrecioRubro";
import { requerirSesion, requerirProyecto } from "@/lib/sesion";

interface RubroSinDesglose {
  rubroId: string;
  codigo: string;
  descripcion: string;
}

// Apply masivo — dos formas de invocarlo, mismo motor (aplicarPrecioVigenteRubro):
//
// 1. { rubroIds: string[] } — comportamiento ORIGINAL, sin cambios: la
//    selección tildada en la pantalla de revisión de Configuración (ver
//    dry-run/route.ts), típicamente rubros con precioCongelado.
//
// 2. { proyectoId: string, dryRun?: boolean } — "actualización paramétrica
//    de proyecto completo" (botón nuevo en la sección de Actualización de
//    Precios del proyecto, alternativa a ICCV): resuelve TODOS los rubros
//    del proyecto, sin filtrar por precioCongelado. dryRun=true solo
//    calcula (calcularPrecioVigenteRubro, sin escribir) para el preview
//    antes de confirmar — mismo patrón de dos pasos que ya usa ICCV
//    (POST calcula, el usuario confirma, PUT aplica).
//
// En ambos modos, un rubro sin APU ("sin descompuesto") NO es un error —
// es información esperada que se reporta aparte (sinDesglose), nunca se
// oculta ni bloquea el resto del lote. Un rubro individual que sí falle
// (ej. su proyecto volvió a FINALIZADO a mitad de camino) tampoco aborta
// el lote — mismo guard 403 que POST /api/rubros/[id]/actualizar-precio-vigente,
// reportado por rubro.
export async function POST(req: NextRequest) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const body = await req.json().catch(() => null);
    const proyectoId: string | undefined = typeof body?.proyectoId === "string" ? body.proyectoId : undefined;
    if (proyectoId) {
      const acceso = await requerirProyecto(proyectoId);
      if (acceso instanceof NextResponse) return acceso;
    }
    const dryRun = body?.dryRun === true;

    let rubroIds: string[];
    if (proyectoId) {
      const rubrosDelProyecto = await db.rubro.findMany({
        where: { capitulo: { proyectoId } },
        select: { id: true },
      });
      rubroIds = rubrosDelProyecto.map((r) => r.id);
    } else {
      rubroIds = Array.isArray(body?.rubroIds) ? body.rubroIds : [];
    }

    if (rubroIds.length === 0) {
      return NextResponse.json(
        { error: proyectoId ? "El proyecto no tiene rubros" : "Se esperaba { rubroIds: string[] } o { proyectoId: string }" },
        { status: 400 }
      );
    }

    const errores: { rubroId: string; motivo: string }[] = [];
    const sinDesglose: RubroSinDesglose[] = [];
    let actualizados = 0;
    let totalActualAntes = 0;
    let totalProyectadoDespues = 0;

    for (const rubroId of rubroIds) {
      try {
        // Solo rubros de la empresa del usuario: uno ajeno cae en "Rubro no encontrado".
        const rubro = await db.rubro.findFirst({
          where: { id: rubroId, capitulo: { proyecto: { empresaId: sesion.empresaId } } },
          select: {
            codigo: true,
            descripcion: true,
            cantidad: true,
            capitulo: { select: { proyecto: { select: { estado: true } } } },
          },
        });
        if (!rubro) {
          errores.push({ rubroId, motivo: "Rubro no encontrado" });
          continue;
        }
        if (rubro.capitulo.proyecto.estado === "FINALIZADO") {
          errores.push({ rubroId, motivo: "Proyecto entregado — habilitá edición para actualizarlo" });
          continue;
        }

        const resultado = dryRun
          ? await calcularPrecioVigenteRubro(rubroId)
          : await aplicarPrecioVigenteRubro(rubroId);

        if (!resultado) {
          sinDesglose.push({ rubroId, codigo: rubro.codigo, descripcion: rubro.descripcion });
          continue;
        }
        actualizados++;
        totalActualAntes += resultado.precioUnitAnterior * rubro.cantidad;
        totalProyectadoDespues += resultado.precioUnitVigente * rubro.cantidad;
      } catch (err) {
        console.error(`[POST /api/configuracion/aplicar-precios-vigentes] rubro ${rubroId}`, err);
        errores.push({ rubroId, motivo: "Error interno" });
      }
    }

    return NextResponse.json({
      total: rubroIds.length,
      actualizados,
      sinDesglose,
      errores,
      ...(proyectoId ? { totalActualAntes, totalProyectadoDespues } : {}),
    });
  } catch (err) {
    console.error("[POST /api/configuracion/aplicar-precios-vigentes]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
