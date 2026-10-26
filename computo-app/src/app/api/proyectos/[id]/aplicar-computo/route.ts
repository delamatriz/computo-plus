import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  subtotalFila,
  type ActualizacionComputo,
  type DesgloseDocumento,
  type ResultadoAplicarComputo,
} from "@/components/metrajes/metrajeFila";
import { requerirProyecto } from "@/lib/sesion";

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
// Igual que propagar-aportes-patronales: si el proyecto ya tiene contrato,
// certificaciones o liquidación final, la preview lo avisa y aplicar exige
// `confirmarContrato: true` (cambiar cantidades altera lo contratado).
// Además se informan los rubros cuya cantidad vino del cómputo y ya no
// tienen ninguna fila vinculada: no se tocan (conservan la cantidad).
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

async function calcularResultado(proyectoId: string): Promise<ResultadoAplicarComputo> {
  const [actualizaciones, proyecto, rubrosDeComputo] = await Promise.all([
    calcularActualizaciones(proyectoId),
    db.proyecto.findUnique({
      where: { id: proyectoId },
      select: {
        contrato: { select: { id: true } },
        liquidacionFinal: { select: { id: true } },
        _count: { select: { certificaciones: true } },
      },
    }),
    db.rubro.findMany({
      where: { capitulo: { proyectoId }, cantidadOrigen: "COMPUTO", cantidad: { not: 0 } },
      select: { id: true, descripcion: true, capituloId: true },
    }),
  ]);
  const conFilas = new Set(actualizaciones.map((a) => a.rubroId));
  const sinFilas = rubrosDeComputo.filter((r) => !conFilas.has(r.id));
  const etiquetaCapitulo = sinFilas.length > 0 ? await etiquetasDeCapitulo(proyectoId) : new Map<string, string>();
  return {
    actualizaciones,
    tieneContratoOCertificaciones:
      !!proyecto?.contrato || !!proyecto?.liquidacionFinal || (proyecto?._count.certificaciones ?? 0) > 0,
    rubrosSinFilas: sinFilas
      .map((r) => ({
        rubroId: r.id,
        nombre: r.descripcion || "Rubro sin nombre",
        capitulo: etiquetaCapitulo.get(r.capituloId) ?? "",
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.capitulo.localeCompare(b.capitulo, "es")),
  };
}

// "Cap. 03 Albañilería" — misma numeración que muestra el presupuesto
// (proyectos/[id]/page.tsx): con 2+ títulos "título.capítulo" (1.2), si no
// correlativa con dos dígitos (01, 02…), siempre por `orden`.
async function etiquetasDeCapitulo(proyectoId: string): Promise<Map<string, string>> {
  const [titulos, capitulos] = await Promise.all([
    db.titulo.findMany({ where: { proyectoId }, orderBy: { orden: "asc" }, select: { id: true } }),
    db.capitulo.findMany({
      where: { proyectoId },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, tituloId: true },
    }),
  ]);
  const etiquetas = new Map<string, string>();
  if (titulos.length >= 2) {
    titulos.forEach((t, tIdx) => {
      capitulos
        .filter((c) => c.tituloId === t.id)
        .forEach((c, i) => etiquetas.set(c.id, `Cap. ${tIdx + 1}.${i + 1} ${c.nombre}`));
    });
  } else {
    capitulos.forEach((c, i) => etiquetas.set(c.id, `Cap. ${String(i + 1).padStart(2, "0")} ${c.nombre}`));
  }
  return etiquetas;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => ({}));
    const confirmar = body?.confirmar === true;
    const confirmarContrato = body?.confirmarContrato === true;

    // El preview (confirmar:false) no escribe nada — se deja pasar
    // siempre. El bloqueo real es solo sobre la escritura de verdad.
    if (confirmar) {
      const proyecto = await db.proyecto.findUnique({ where: { id }, select: { estado: true } });
      if (proyecto?.estado === "FINALIZADO") {
        return NextResponse.json(
          {
            error: "proyecto_finalizado",
            mensaje: "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.",
          },
          { status: 403 }
        );
      }
    }

    const resultado = await calcularResultado(id);
    const { actualizaciones } = resultado;

    if (!confirmar) {
      return NextResponse.json(resultado);
    }

    if (resultado.tieneContratoOCertificaciones && !confirmarContrato) {
      return NextResponse.json(
        {
          error: "requiere_confirmacion_contrato",
          mensaje:
            "Este proyecto tiene certificaciones o contratos: cambiar las cantidades puede afectar los totales. Confirmá explícitamente para continuar.",
        },
        { status: 409 }
      );
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

    return NextResponse.json({ aplicado: true, ...resultado });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/aplicar-computo]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
