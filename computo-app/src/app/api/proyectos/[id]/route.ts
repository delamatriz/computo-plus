import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob } from "@/lib/blob";

// Incluye todas las relaciones necesarias para la página del proyecto
const PROYECTO_INCLUDE = {
  titulos: {
    orderBy: { orden: "asc" as const },
  },
  capitulos: {
    orderBy: { orden: "asc" as const },
    include: {
      rubros: {
        orderBy: { createdAt: "asc" as const },
        include: {
          _count: { select: { cotizaciones: true } },
          apu: {
            include: {
              materiales: {
                orderBy: { orden: "asc" as const },
                include: {
                  componentes: { orderBy: { orden: "asc" as const } },
                },
              },
              manoObra: { orderBy: { orden: "asc" as const } },
              equipos:  { orderBy: { orden: "asc" as const } },
            },
          },
        },
      },
    },
  },
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Poll liviano: solo el estado de generación de rubros, sin capítulos/rubros/APUs
    if (req.nextUrl.searchParams.get("light") === "1") {
      const proyecto = await db.proyecto.findUnique({
        where: { id },
        select: { generandoRubros: true },
      });
      if (!proyecto) {
        return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
      }
      return NextResponse.json(proyecto);
    }

    const proyecto = await db.proyecto.findUnique({
      where: { id },
      include: PROYECTO_INCLUDE,
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    return NextResponse.json(proyecto);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// Los 4 modelos que suben archivos a Vercel Blob para este proyecto
// (ver lib/blob.ts) — DocumentoMetraje y DocumentoPostObra cuelgan
// directo de proyectoId, DocumentoContrato/DocumentoActaCierre cuelgan
// de ContratoObra/ActaCierre (1:1 con Proyecto). Todos tienen
// onDelete: Cascade hacia Proyecto, así que db.proyecto.delete() ya
// limpia estas filas solo — lo que NUNCA limpiaba solo es el archivo
// físico en Blob (confirmado: 13 huérfanos reales, 84MB, en producción
// antes de este fix). Por eso hay que leer las URLs y borrarlas de Blob
// ACÁ, antes del delete — nunca después: si el borrado de Blob fallara
// después de borrar la fila, ya no quedaría ningún registro desde el
// que reintentar, volviendo exactamente al bug que esto corrige.
async function urlsBlobDelProyecto(proyectoId: string): Promise<string[]> {
  const [metraje, contrato, cierre, postObra] = await Promise.all([
    db.documentoMetraje.findMany({ where: { proyectoId }, select: { archivo: true } }),
    db.documentoContrato.findMany({ where: { contratoObra: { proyectoId } }, select: { urlBlob: true } }),
    db.documentoActaCierre.findMany({ where: { actaCierre: { proyectoId } }, select: { urlBlob: true } }),
    db.documentoPostObra.findMany({ where: { proyectoId }, select: { urlBlob: true } }),
  ]);
  return [
    ...metraje.map((d) => d.archivo),
    ...contrato.map((d) => d.urlBlob),
    ...cierre.map((d) => d.urlBlob),
    ...postObra.map((d) => d.urlBlob),
  ];
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const urls = await urlsBlobDelProyecto(id);
    await eliminarArchivosDeBlob(urls);
    await db.proyecto.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const proyecto = await db.proyecto.update({
      where: { id },
      data: {
        ...(body.nombre     !== undefined && { nombre:     body.nombre }),
        ...(body.subtitulo  !== undefined && { subtitulo:  body.subtitulo }),
        ...(body.cliente    !== undefined && { cliente:    body.cliente }),
        ...(body.clienteRut         !== undefined && { clienteRut:         body.clienteRut }),
        ...(body.clienteRazonSocial !== undefined && { clienteRazonSocial: body.clienteRazonSocial }),
        ...(body.clienteTelefono    !== undefined && { clienteTelefono:    body.clienteTelefono }),
        ...(body.clienteEmail       !== undefined && { clienteEmail:       body.clienteEmail }),
        ...(body.tipo       !== undefined && { tipo:       body.tipo }),
        ...(body.tipoContratacion !== undefined && { tipoContratacion: body.tipoContratacion }),
        ...(body.estado     !== undefined && { estado:     body.estado }),
        ...(body.moneda     !== undefined && { moneda:     body.moneda }),
        ...(body.area       !== undefined && { area:       body.area }),
        ...(body.direccion  !== undefined && { direccion:  body.direccion }),
        ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
        ...(body.notas       !== undefined && { notas:       body.notas }),
        ...(body.trabajos    !== undefined && { trabajos:    body.trabajos }),
        ...(body.fechaInicio !== undefined && { fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null }),
        ...(body.fechaPresupuesto !== undefined && { fechaPresupuesto: body.fechaPresupuesto ? new Date(body.fechaPresupuesto) : null }),
        ...(body.plazoObra   !== undefined && { plazoObra:   body.plazoObra }),
        ...(body.diasLaborales !== undefined && { diasLaborales: body.diasLaborales }),
        ...(body.garantiaFielCumplimiento !== undefined && { garantiaFielCumplimiento: body.garantiaFielCumplimiento }),
        ...(body.garantiaViciosOcultos !== undefined && { garantiaViciosOcultos: body.garantiaViciosOcultos }),
        ...(body.garantiaResponsabilidad !== undefined && { garantiaResponsabilidad: body.garantiaResponsabilidad }),
        ...(body.modalidadEjecucion !== undefined && { modalidadEjecucion: body.modalidadEjecucion }),
        ...(body.generandoRubros !== undefined && { generandoRubros: body.generandoRubros }),
        ...(body.incluyeIVA  !== undefined && { incluyeIVA: !!body.incluyeIVA }),
        ...(body.gastosGeneralesItems !== undefined && { gastosGeneralesItems: body.gastosGeneralesItems }),
        ...(body.gastosGeneralesPctDefault !== undefined && { gastosGeneralesPctDefault: body.gastosGeneralesPctDefault }),
        ...(body.utilidadPctDefault !== undefined && { utilidadPctDefault: body.utilidadPctDefault }),
        ...(body.modoGastosGenerales !== undefined && { modoGastosGenerales: body.modoGastosGenerales }),
        ...(body.gastosGeneralesDetallado !== undefined && { gastosGeneralesDetallado: body.gastosGeneralesDetallado }),
      },
    });
    return NextResponse.json(proyecto);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
