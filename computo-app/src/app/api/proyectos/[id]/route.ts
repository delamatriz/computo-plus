import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob } from "@/lib/blob";
import { requerirProyecto, soloAdministrador } from "@/lib/sesion";
import { emailValido } from "@/lib/registro";
import {
  booleano,
  categoriasGastosGenerales,
  enumeracion,
  fecha,
  itemsGastosGenerales,
  numero,
  texto,
  validarCampos,
} from "@/lib/validacionDatos";
import { TIPOS_OBRA } from "@/lib/tiposObra";

// Valores que la app conoce (ver ESTADOS en proyectos/[id]/page.tsx,
// MODALIDADES_EJECUCION en /editar y ModoGastosGenerales).
const REGLAS_PATCH_PROYECTO = {
  nombre: texto({ max: 200, nulo: false, vacio: false }),
  subtitulo: texto({ max: 300 }),
  cliente: texto({ max: 300 }),
  clienteRut: texto({ max: 30 }),
  clienteRazonSocial: texto({ max: 300 }),
  clienteTelefono: texto({ max: 50 }),
  clienteEmail: texto({ max: 254 }),
  direccion: texto({ max: 500 }),
  descripcion: texto({ max: 20_000 }),
  notas: texto({ max: 20_000 }),
  trabajos: texto({ max: 20_000 }),
  garantiaFielCumplimiento: texto({ max: 5_000 }),
  garantiaViciosOcultos: texto({ max: 5_000 }),
  garantiaResponsabilidad: texto({ max: 5_000 }),
  estado: enumeracion(["ANTEPROYECTO", "EN_CURSO", "FINALIZADO", "PAUSADO"]),
  tipo: enumeracion(TIPOS_OBRA.map((t) => t.id)),
  tipoContratacion: enumeracion(["PRIVADA", "PUBLICA"]),
  moneda: enumeracion(["UYU", "USD"]),
  modalidadEjecucion: enumeracion(["POR_CONTRATO", "POR_ADMINISTRACION", "PARTE_Y_PARTE"], { nulo: true }),
  modoGastosGenerales: enumeracion(["PORCENTAJE", "DETALLADO"]),
  area: numero({ min: 0, max: 10_000_000, nulo: true }),
  plazoObra: numero({ min: 0, max: 100_000, entero: true, nulo: true }),
  diasLaborales: numero({ min: 0, max: 100_000, entero: true, nulo: true }),
  gastosGeneralesPctDefault: numero({ min: 0, max: 100, nulo: true }),
  utilidadPctDefault: numero({ min: 0, max: 100, nulo: true }),
  fechaInicio: fecha,
  fechaPresupuesto: fecha,
  fechaValorUR: fecha,
  garantiaFielCumplimientoVence: fecha,
  garantiaViciosOcultosVence: fecha,
  garantiaResponsabilidadVence: fecha,
  generandoRubros: booleano,
  gastosGeneralesItems: itemsGastosGenerales,
  gastosGeneralesDetallado: categoriasGastosGenerales,
};

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
                  // Fila del catálogo vinculada: solo lo que hace falta para mostrar la
                  // fuente del precio en el APU (lib/fuentePrecio.ts). No se guarda de vuelta.
                  precioMTOP: {
                    select: {
                      codigo: true,
                      numeroLista: true,
                      proveedor: true,
                      notaProcedencia: true,
                      // Estado vivo de verificación — el badge del APU lo usa en vez de las
                      // copias del material, que quedan viejas desde el clonado.
                      requiereVerificacion: true,
                      motivoVerificacion: true,
                      fechaUltimaVerificacion: true,
                    },
                  },
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
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    // Solo el nombre, para rotular el botón "Volver al proyecto" de las
    // pantallas de referencia (Materiales, Cola de revisión, etc.). El control
    // de empresa ya lo hizo requerirProyecto: un proyecto ajeno da 404 igual.
    if (req.nextUrl.searchParams.get("resumen") === "1") {
      const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true, nombre: true } });
      if (!proyecto) {
        return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
      }
      return NextResponse.json(proyecto);
    }

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
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    // Borrar no se puede deshacer (también borra los archivos): solo ADMIN o SUPERADMIN.
    const sinPermiso = await soloAdministrador(acceso, "Solo el administrador de la empresa puede eliminar un proyecto.");
    if (sinPermiso) return sinPermiso;
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
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json();

    // Tipos y rangos de cada campo que se puede editar (lib/validacionDatos.ts).
    // Los porcentajes del proyecto van de 0 a 100 (ej. 10 = 10%).
    const errorCampos = validarCampos(body, REGLAS_PATCH_PROYECTO);
    if (errorCampos) return NextResponse.json({ error: errorCampos }, { status: 400 });

    // Pasar a FINALIZADO es entregar (ver /entregar): solo ADMIN o SUPERADMIN.
    // Volver a EN_CURSO ("Habilitar edición") sigue abierto para todos.
    if (body.estado === "FINALIZADO") {
      const sinPermiso = await soloAdministrador(acceso, "Solo el administrador de la empresa puede entregar un presupuesto.");
      if (sinPermiso) return sinPermiso;
    }

    // Imprevistos %: null (= 0%) o un número finito entre 0 y 100. Cualquier
    // otra cosa se rechaza en vez de guardarse — un valor corrupto acá
    // movería el Costo Total de todo el presupuesto.
    if (body.imprevistosPct !== undefined && body.imprevistosPct !== null) {
      const v = body.imprevistosPct;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) {
        return NextResponse.json({ error: "imprevistosPct debe ser un número entre 0 y 100" }, { status: 400 });
      }
    }

    // Email del cliente: opcional; si viene, con formato válido. (El RUT del
    // cliente no se valida: en obra particular ahí va la cédula.)
    if (typeof body.clienteEmail === "string" && body.clienteEmail.trim() && !emailValido(body.clienteEmail.trim())) {
      return NextResponse.json(
        { error: "email_invalido", mensaje: "El email del cliente no parece válido." },
        { status: 400 }
      );
    }

    // Moneda del contrato (obra pública): "PESOS" | "UR", y el valor de la UR
    // null o un número positivo — un valor raro dividiría el Precio Final.
    if (body.monedaContrato !== undefined && body.monedaContrato !== "PESOS" && body.monedaContrato !== "UR") {
      return NextResponse.json({ error: "monedaContrato debe ser PESOS o UR" }, { status: 400 });
    }
    if (body.valorUR !== undefined && body.valorUR !== null) {
      const v = body.valorUR;
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        return NextResponse.json({ error: "valorUR debe ser un número mayor que 0" }, { status: 400 });
      }
    }

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
        ...(body.monedaContrato !== undefined && { monedaContrato: body.monedaContrato }),
        ...(body.valorUR !== undefined && { valorUR: body.valorUR }),
        ...(body.fechaValorUR !== undefined && { fechaValorUR: body.fechaValorUR ? new Date(body.fechaValorUR) : null }),
        ...(body.plazoObra   !== undefined && { plazoObra:   body.plazoObra }),
        ...(body.diasLaborales !== undefined && { diasLaborales: body.diasLaborales }),
        ...(body.garantiaFielCumplimiento !== undefined && { garantiaFielCumplimiento: body.garantiaFielCumplimiento }),
        ...(body.garantiaViciosOcultos !== undefined && { garantiaViciosOcultos: body.garantiaViciosOcultos }),
        ...(body.garantiaResponsabilidad !== undefined && { garantiaResponsabilidad: body.garantiaResponsabilidad }),
        ...(body.garantiaFielCumplimientoVence !== undefined && { garantiaFielCumplimientoVence: body.garantiaFielCumplimientoVence ? new Date(`${String(body.garantiaFielCumplimientoVence).slice(0, 10)}T00:00:00Z`) : null }),
        ...(body.garantiaViciosOcultosVence !== undefined && { garantiaViciosOcultosVence: body.garantiaViciosOcultosVence ? new Date(`${String(body.garantiaViciosOcultosVence).slice(0, 10)}T00:00:00Z`) : null }),
        ...(body.garantiaResponsabilidadVence !== undefined && { garantiaResponsabilidadVence: body.garantiaResponsabilidadVence ? new Date(`${String(body.garantiaResponsabilidadVence).slice(0, 10)}T00:00:00Z`) : null }),
        ...(body.modalidadEjecucion !== undefined && { modalidadEjecucion: body.modalidadEjecucion }),
        ...(body.generandoRubros !== undefined && { generandoRubros: body.generandoRubros }),
        ...(body.incluyeIVA  !== undefined && { incluyeIVA: !!body.incluyeIVA }),
        ...(body.gastosGeneralesItems !== undefined && { gastosGeneralesItems: body.gastosGeneralesItems }),
        ...(body.gastosGeneralesPctDefault !== undefined && { gastosGeneralesPctDefault: body.gastosGeneralesPctDefault }),
        ...(body.utilidadPctDefault !== undefined && { utilidadPctDefault: body.utilidadPctDefault }),
        ...(body.imprevistosPct !== undefined && { imprevistosPct: body.imprevistosPct }),
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
