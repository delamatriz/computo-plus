import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subtotalFila, type ActualizacionComputo, type DesgloseDocumento } from "@/components/metrajes/metrajeFila";

// "Aplicar al presupuesto" — botón único en la cabecera de la Planilla de
// cómputo (ver diseño confirmado). Alcance a nivel de PROYECTO, no de
// documento: un mismo Rubro puede medirse repartido en varios planos
// (planta baja en un PDF, planta alta en otro), así que la suma cruza
// documentos. Mismo endpoint para las dos etapas del flujo:
//   - body sin confirmar (o confirmar:false) → preview, no toca la base.
//   - body { confirmar: true } → recalcula (no confía en números que
//     mande el cliente) y aplica de verdad en una transacción.
// cantidadActual en la respuesta siempre es el valor de Rubro.cantidad
// ANTES de este request — en el modo aplicar, eso es justo el "antes"
// que necesita el modal de resultado para el antes/después.
async function calcularActualizaciones(proyectoId: string): Promise<ActualizacionComputo[]> {
  const filas = await db.filaMetraje.findMany({
    where: { documento: { proyectoId }, rubroId: { not: null } },
    select: {
      largo: true,
      ancho: true,
      alto: true,
      cantidad: true,
      rubroId: true,
      documentoId: true,
      documento: { select: { nombre: true, paginaPDF: true } },
      rubro: {
        select: {
          descripcion: true,
          unidad: true,
          cantidad: true,
          cantidadOrigen: true,
          capitulo: { select: { nombre: true } },
        },
      },
    },
  });

  const porRubro = new Map<
    string,
    { rubro: NonNullable<(typeof filas)[number]["rubro"]>; porDoc: Map<string, DesgloseDocumento> }
  >();

  for (const f of filas) {
    if (!f.rubro || !f.rubroId) continue;
    const subtotal = subtotalFila({ largo: f.largo, ancho: f.ancho, alto: f.alto, cantidad: f.cantidad });

    let entry = porRubro.get(f.rubroId);
    if (!entry) {
      entry = { rubro: f.rubro, porDoc: new Map() };
      porRubro.set(f.rubroId, entry);
    }

    const actual = entry.porDoc.get(f.documentoId) ?? {
      documentoNombre: f.documento.nombre,
      paginaPDF: f.documento.paginaPDF,
      cantidad: 0,
    };
    actual.cantidad += subtotal;
    entry.porDoc.set(f.documentoId, actual);
  }

  const actualizaciones: ActualizacionComputo[] = [];
  for (const [rubroId, entry] of porRubro) {
    const desglosePorDocumento = [...entry.porDoc.values()];
    const cantidadNueva = desglosePorDocumento.reduce((s, d) => s + d.cantidad, 0);
    actualizaciones.push({
      rubroId,
      nombre: entry.rubro.descripcion || "Rubro sin nombre",
      capituloNombre: entry.rubro.capitulo.nombre,
      unidad: entry.rubro.unidad,
      cantidadActual: entry.rubro.cantidad,
      cantidadNueva,
      requiereConfirmacion: entry.rubro.cantidadOrigen === "MANUAL" && entry.rubro.cantidad !== 0,
      desglosePorDocumento,
    });
  }

  return actualizaciones.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const confirmar = body?.confirmar === true;

    const actualizaciones = await calcularActualizaciones(id);

    if (!confirmar) {
      return NextResponse.json({ actualizaciones });
    }

    if (actualizaciones.length > 0) {
      await db.$transaction(
        actualizaciones.map((a) =>
          db.rubro.update({
            where: { id: a.rubroId },
            data: { cantidad: a.cantidadNueva, cantidadOrigen: "COMPUTO" },
          })
        )
      );
    }

    return NextResponse.json({ aplicado: true, actualizaciones });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/aplicar-computo]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
