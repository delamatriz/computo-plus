import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datosCorreccionPrecio } from "@/lib/resolverPrecioMTOP";

/** Normaliza tildes para que "hormigon" también encuentre "Hormigón" */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n");
}

// Select completo — para /materiales (catálogo) y para la vista previa de
// importación (candidatos de un proveedor puntual), que necesitan mostrar
// el badge de verificación completo (BadgeVerificacion), no solo
// proveedor/notaProcedencia como el buscador chico de un APU.
const SELECT_CATALOGO_COMPLETO = {
  id: true,
  codigo: true,
  descripcion: true,
  unidad: true,
  precioUnitario: true,
  precioConIva: true,
  cantidadUnidad: true,
  numeroLista: true,
  proveedor: true,
  notaProcedencia: true,
  fechaUltimaVerificacion: true,
  requiereVerificacion: true,
  motivoVerificacion: true,
  // Para la fecha general "Catálogo actualizado al" de /materiales —
  // @updatedAt, se toca en CUALQUIER escritura (corrección de precio,
  // importación, etc.), así que es la señal más completa de "última vez
  // que se tocó el catálogo" — más completa que fechaUltimaVerificacion
  // sola, que queda null en materiales nunca verificados.
  actualizadoEn: true,
} as const;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const codigosParam = req.nextUrl.searchParams.get("codigos")?.trim() ?? "";
  // Presente (aunque sea "") cuando el caller pide TODOS los materiales de
  // un proveedor exacto — usado por la vista previa de importación para
  // traer los candidatos contra los que comparar por similitud. Distinto
  // de "q" (contains, libre): acá es igualdad exacta de proveedor.
  const proveedorExactoParam = req.nextUrl.searchParams.get("proveedorExacto");

  // Búsqueda exacta por lista de códigos — usada para cargar precios de
  // referencia de materiales que no son resultado de búsqueda libre.
  if (codigosParam) {
    try {
      const codigos = codigosParam.split(",").map((c) => c.trim()).filter(Boolean);
      const resultados = await db.precioMTOP.findMany({
        where: { codigo: { in: codigos } },
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          unidad: true,
          precioUnitario: true,
          precioConIva: true,
          cantidadUnidad: true,
          actualizadoEn: true,
          numeroLista: true,
          proveedor: true,
          notaProcedencia: true,
        },
        orderBy: { descripcion: "asc" },
      });
      return NextResponse.json(resultados);
    } catch (err) {
      console.error("[GET /api/precios-mtop?codigos]", err);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  }

  if (proveedorExactoParam !== null) {
    try {
      const resultados = await db.precioMTOP.findMany({
        where: { proveedor: proveedorExactoParam },
        select: SELECT_CATALOGO_COMPLETO,
        orderBy: { descripcion: "asc" },
      });
      return NextResponse.json(resultados);
    } catch (err) {
      console.error("[GET /api/precios-mtop?proveedorExacto]", err);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  }

  // Sin q ni codigos ni proveedorExacto — catálogo completo, para
  // /materiales. Ningún caller existente llama a este endpoint sin
  // ninguno de los 3 params (BuscadorCatalogo siempre manda q con 2+
  // caracteres), así que esta rama es nueva sin pisar ningún contrato.
  if (!q) {
    try {
      const resultados = await db.precioMTOP.findMany({
        select: SELECT_CATALOGO_COMPLETO,
        orderBy: { descripcion: "asc" },
      });
      return NextResponse.json(resultados);
    } catch (err) {
      console.error("[GET /api/precios-mtop (catálogo completo)]", err);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  }

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const qNorm = normalizar(q);

    const resultados = await db.precioMTOP.findMany({
      where: {
        OR: [
          { descripcion: { contains: qNorm, mode: "insensitive" } },
          { descripcion: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        unidad: true,
        precioUnitario: true,
        precioConIva: true,
        cantidadUnidad: true,
        numeroLista: true,
        proveedor: true,
        notaProcedencia: true,
      },
      orderBy: { descripcion: "asc" },
      take: 8,
    });

    return NextResponse.json(resultados);
  } catch (err) {
    console.error("[GET /api/precios-mtop]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — actualiza precioUnitario (y precioConIva) de materiales existentes
// por código. Usado por la sección "Precios de Referencia de Materiales" en
// Configuración para materiales que no están en la Lista MTOP N°599.
//
// También acepta { descripcion, precioUnitario } para actualizar por
// coincidencia de descripción (contains, insensitive) — usado al editar
// inline el precio de un material en el APU de un rubro, para mantener
// el catálogo alineado con lo que el usuario corrige a mano.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    if (typeof body?.descripcion === "string" && Number.isFinite(body?.precioUnitario)) {
      // Hasta 2 matches alcanza para decidir: 0 (nada que hacer), 1 (caso
      // normal, sigue de largo), 2+ (ambiguo, no adivinamos cuál — no hace
      // falta traer más de 2 filas para saber que hay más de una).
      const matches = await db.precioMTOP.findMany({
        where: { descripcion: { contains: body.descripcion, mode: "insensitive" } },
        orderBy: { id: "asc" },
        take: 2,
      });
      if (matches.length === 0) {
        return NextResponse.json({ ok: true, actualizado: false });
      }
      if (matches.length > 1) {
        return NextResponse.json(
          {
            error: "descripcion_ambigua",
            mensaje: `Más de un material coincide con "${body.descripcion}" — no se puede corregir el precio sin saber a cuál te referís.`,
            candidatos: matches.map((m) => ({ codigo: m.codigo, descripcion: m.descripcion, proveedor: m.proveedor })),
          },
          { status: 409 }
        );
      }
      const match = matches[0];
      // datosCorreccionPrecio: misma resolución que "aceptar" en la Cola
      // de Revisión (ver resolver/route.ts) y que la importación masiva
      // (importar/route.ts) — un solo lugar para el criterio, ver
      // lib/resolverPrecioMTOP.ts.
      const actualizado = await db.precioMTOP.update({
        where: { id: match.id },
        data: datosCorreccionPrecio(body.precioUnitario),
      });
      return NextResponse.json({
        ok: true,
        actualizado: true,
        codigo: match.codigo,
        fechaUltimaVerificacion: actualizado.fechaUltimaVerificacion,
        requiereVerificacion: actualizado.requiereVerificacion,
        motivoVerificacion: actualizado.motivoVerificacion,
      });
    }

    const { materiales } = body;

    if (!Array.isArray(materiales)) {
      return NextResponse.json({ error: "Falta el array de materiales" }, { status: 400 });
    }

    // codigo dejó de ser único por sí solo (PrecioMTOP.codigo pasó a
    // @@unique([codigo, proveedor])) — hay que resolver el id real de cada
    // fila antes de poder actualizarla. Se resuelve con findFirst (no
    // findUnique) y se actualiza por id (no por el compuesto
    // codigo_proveedor, que Prisma no acepta con proveedor=null — la
    // mayoría de las filas hoy). Tampoco updateMany por código solo, a
    // propósito: actualizaría TODAS las filas con ese código si algún día
    // hay más de un proveedor compartiéndolo — la colisión que se evita.
    await Promise.all(
      materiales
        .filter((m) => m?.codigo && Number.isFinite(m.precioUnitario))
        .map(async (m: { codigo: string; precioUnitario: number }) => {
          const fila = await db.precioMTOP.findFirst({ where: { codigo: m.codigo }, select: { id: true } });
          if (!fila) return;
          await db.precioMTOP.update({
            where: { id: fila.id },
            data: { precioUnitario: m.precioUnitario, precioConIva: m.precioUnitario },
          });
        })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/precios-mtop]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
