import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { CertificacionPDF, type CapituloCertificacionPDF } from "@/components/CertificacionPDF";
import { requerirProyecto, hijoNoEncontrado } from "@/lib/sesion";
import { nombreProyectoParaMostrar } from "@/lib/resumenProyecto";

// GET — PDF del certificado de avance para presentar al comitente. Usa lo
// guardado en la base (el cliente guarda antes de pedirlo si hay cambios).
// El % anterior de cada rubro es la suma de las certificaciones con número
// menor — mismo criterio que acumuladoAnterior en SeccionCertificaciones.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    const { id, certId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    const cert = await db.certificacion.findFirst({
      where: { id: certId, proyectoId: id },
      include: { items: { select: { rubroId: true, porcentajeAvance: true } } },
    });
    if (!cert) return hijoNoEncontrado("Certificación no encontrada");

    const [proyecto, anteriores] = await Promise.all([
      db.proyecto.findUnique({
        where: { id },
        select: {
          nombre: true,
          cliente: true,
          clienteRazonSocial: true,
          direccion: true,
          moneda: true,
          empresa: { select: { nombre: true } },
          capitulos: {
            orderBy: { orden: "asc" },
            select: {
              codigo: true,
              nombre: true,
              rubros: {
                select: { id: true, codigo: true, descripcion: true, unidad: true, cantidad: true, precioUnit: true },
              },
            },
          },
        },
      }),
      db.certificacionItem.findMany({
        where: { certificacion: { proyectoId: id, numero: { lt: cert.numero } } },
        select: { rubroId: true, porcentajeAvance: true },
      }),
    ]);
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const pctAnterior = new Map<string, number>();
    for (const it of anteriores) pctAnterior.set(it.rubroId, (pctAnterior.get(it.rubroId) ?? 0) + it.porcentajeAvance);
    const pctEsta = new Map(cert.items.map((it) => [it.rubroId, it.porcentajeAvance]));

    const capitulos: CapituloCertificacionPDF[] = proyecto.capitulos
      .map((cap) => ({
        codigo: cap.codigo,
        nombre: cap.nombre,
        rubros: [...cap.rubros]
          .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }))
          .map((r) => ({
            codigo: r.codigo,
            descripcion: r.descripcion,
            unidad: r.unidad,
            cantidad: r.cantidad,
            precioUnit: r.precioUnit,
            pctAnterior: pctAnterior.get(r.id) ?? 0,
            pctEsta: pctEsta.get(r.id) ?? 0,
          })),
      }))
      .filter((cap) => cap.rubros.length > 0);

    const proyectoNombre = nombreProyectoParaMostrar(proyecto.nombre);
    const elemento = React.createElement(CertificacionPDF, {
      empresaNombre: proyecto.empresa?.nombre || "Mi Empresa",
      proyectoNombre,
      comitente: proyecto.clienteRazonSocial || proyecto.cliente,
      direccion: proyecto.direccion,
      numero: cert.numero,
      nombre: cert.nombre,
      fecha: cert.fecha.toISOString(),
      observaciones: cert.observaciones,
      capitulos,
      moneda: proyecto.moneda,
    }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(elemento);

    const nombreBase = `Certificado-N${cert.numero}-${proyectoNombre}`.replace(/\s+/g, "-");
    const nombreAscii = nombreBase.replace(/[^\x20-\x7E]/g, "").replace(/-+/g, "-") || "certificado";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombreAscii}.pdf"; filename*=UTF-8''${encodeURIComponent(`${nombreBase}.pdf`)}`,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/certificaciones/[certId]/pdf]", err);
    return NextResponse.json({ error: "Error interno generando el PDF" }, { status: 500 });
  }
}
