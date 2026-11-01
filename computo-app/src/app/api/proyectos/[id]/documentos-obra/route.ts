import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto } from "@/lib/sesion";
import type { DocumentoObraAgregado } from "@/lib/documentosObra";

// GET — todos los archivos que se adjuntaron en las secciones de Gestión de
// Obra (contrato, trámites, bitácora, remitos de OC, comprobantes de caja,
// acta de cierre y As-Built), para la tarjeta Documentos. Solo metadatos y la
// URL del proxy de cada sección: los archivos se siguen sirviendo, cargando y
// borrando donde siempre. Nunca trae el contenido (las fotos viejas de
// bitácora están guardadas en base64 en la base).

function tipoDe(contentType: string | null | undefined, nombre?: string | null): DocumentoObraAgregado["tipo"] {
  const t = (contentType ?? "").toLowerCase();
  if (t.includes("pdf") || nombre?.toLowerCase().endsWith(".pdf")) return "pdf";
  if (t.startsWith("image") || t === "imagen") return "imagen";
  return "otro";
}

function fmtDia(d: Date): string {
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const base = `/api/proyectos/${id}`;

    const [contrato, tramites, fotosBitacora, ordenes, movimientos, acta, postObra] = await Promise.all([
      db.contratoObra.findUnique({
        where: { proyectoId: id },
        select: {
          documentos: {
            select: { id: true, nombre: true, tipo: true, nombreArchivoOriginal: true, tipoArchivo: true, tamano: true, createdAt: true },
          },
        },
      }),
      db.tramiteLegal.findMany({
        where: { proyectoId: id },
        select: {
          id: true,
          nombre: true,
          documentos: {
            select: { id: true, nombre: true, nombreArchivoOriginal: true, tipoArchivo: true, tamano: true, createdAt: true },
          },
        },
      }),
      db.fotoEntradaBitacora.findMany({
        where: { entradaBitacora: { proyectoId: id } },
        select: { id: true, createdAt: true, entradaBitacora: { select: { id: true, numero: true, fecha: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.ordenCompra.findMany({
        where: { proyectoId: id, remitoNombreArchivo: { not: null } },
        select: { id: true, proveedor: true, remitoNombreArchivo: true, remitoTipoArchivo: true, fechaRecepcion: true, updatedAt: true },
      }),
      db.movimientoCaja.findMany({
        where: { proyectoId: id, comprobanteNombreArchivo: { not: null } },
        select: { id: true, concepto: true, fecha: true, comprobanteNombreArchivo: true, comprobanteTipoArchivo: true },
      }),
      db.actaCierre.findUnique({
        where: { proyectoId: id },
        select: {
          documentos: {
            select: { id: true, nombre: true, nombreArchivoOriginal: true, tipoArchivo: true, tamano: true, createdAt: true },
          },
        },
      }),
      db.documentoPostObra.findMany({
        where: { proyectoId: id },
        select: { id: true, nombre: true, categoria: true, nombreArchivoOriginal: true, tipoArchivo: true, tamano: true, createdAt: true },
      }),
    ]);

    const docs: DocumentoObraAgregado[] = [];
    for (const d of contrato?.documentos ?? []) {
      docs.push({
        id: `contrato-${d.id}`,
        origen: "CONTRATO",
        titulo: d.nombre,
        detalle: `Contrato${d.tipo ? ` · ${d.tipo}` : ""} · ${d.nombreArchivoOriginal}`,
        href: `${base}/contrato/documentos/${d.id}/archivo`,
        tipo: tipoDe(d.tipoArchivo, d.nombreArchivoOriginal),
        tamano: d.tamano,
        fecha: d.createdAt.toISOString(),
      });
    }
    for (const t of tramites) {
      for (const d of t.documentos) {
        docs.push({
          id: `tramite-${d.id}`,
          origen: "TRAMITE",
          titulo: d.nombre,
          detalle: `Trámite: ${t.nombre} · ${d.nombreArchivoOriginal}`,
          href: `${base}/tramites/${t.id}/documentos/${d.id}/archivo`,
          tipo: tipoDe(d.tipoArchivo, d.nombreArchivoOriginal),
          tamano: d.tamano,
          fecha: d.createdAt.toISOString(),
        });
      }
    }
    for (const f of fotosBitacora) {
      docs.push({
        id: `bitacora-${f.id}`,
        origen: "BITACORA",
        titulo: `Foto de bitácora Nº${f.entradaBitacora.numero}`,
        detalle: `Bitácora · ${fmtDia(f.entradaBitacora.fecha)}`,
        href: `${base}/bitacora/${f.entradaBitacora.id}/fotos/${f.id}`,
        tipo: "imagen",
        tamano: null,
        fecha: f.createdAt.toISOString(),
      });
    }
    for (const o of ordenes) {
      docs.push({
        id: `remito-${o.id}`,
        origen: "REMITO",
        titulo: `Remito — ${o.proveedor}`,
        detalle: `Orden de compra · ${o.remitoNombreArchivo}`,
        href: `${base}/ordenes-compra/${o.id}/remito`,
        tipo: tipoDe(o.remitoTipoArchivo, o.remitoNombreArchivo),
        tamano: null,
        fecha: (o.fechaRecepcion ?? o.updatedAt).toISOString(),
      });
    }
    for (const m of movimientos) {
      docs.push({
        id: `comprobante-${m.id}`,
        origen: "COMPROBANTE",
        titulo: `Comprobante — ${m.concepto}`,
        detalle: `Flujo de Caja · ${fmtDia(m.fecha)} · ${m.comprobanteNombreArchivo}`,
        href: `${base}/flujo-caja/${m.id}/comprobante`,
        tipo: tipoDe(m.comprobanteTipoArchivo, m.comprobanteNombreArchivo),
        tamano: null,
        fecha: m.fecha.toISOString(),
      });
    }
    for (const d of acta?.documentos ?? []) {
      docs.push({
        id: `cierre-${d.id}`,
        origen: "CIERRE",
        titulo: d.nombre,
        detalle: `Cierre de obra · ${d.nombreArchivoOriginal}`,
        href: `${base}/cierre-obra/documentos/${d.id}/archivo`,
        tipo: tipoDe(d.tipoArchivo, d.nombreArchivoOriginal),
        tamano: d.tamano,
        fecha: d.createdAt.toISOString(),
      });
    }
    for (const d of postObra) {
      docs.push({
        id: `asbuilt-${d.id}`,
        origen: "AS_BUILT",
        titulo: d.nombre,
        detalle: `${d.categoria} · ${d.nombreArchivoOriginal}`,
        href: `${base}/documentos-post-obra/${d.id}/archivo`,
        tipo: tipoDe(d.tipoArchivo, d.nombreArchivoOriginal),
        tamano: d.tamano,
        fecha: d.createdAt.toISOString(),
      });
    }

    return NextResponse.json(docs);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/documentos-obra]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
