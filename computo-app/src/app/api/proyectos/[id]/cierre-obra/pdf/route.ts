import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { ActaCierrePDF } from "@/components/ActaCierrePDF";
import React from "react";

// GET — genera el PDF imprimible del Acta de Cierre y Recepción de
// Obra, para firmar en papel en el momento de la recepción (sin
// captura de firma digital — eso queda fuera de alcance). Reutiliza
// el mismo patrón de datos "Partes" ya usado en Contrato de Obra
// (Proyecto.cliente* + Proyecto.empresa) y el mismo patrón de PDF de
// Orden de Compra (@react-pdf/renderer, mismos estilos).
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const [proyecto, acta] = await Promise.all([
      db.proyecto.findUnique({
        where: { id },
        include: { empresa: true },
      }),
      db.actaCierre.findUnique({
        where: { proyectoId: id },
        include: {
          observaciones: {
            include: { rubro: { select: { codigo: true, descripcion: true, capitulo: { select: { nombre: true } } } } },
            orderBy: { createdAt: "asc" },
          },
          firmantes: { orderBy: { createdAt: "asc" } },
        },
      }),
    ]);

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    if (!acta) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene acta de cierre" }, { status: 404 });
    }

    const elemento = React.createElement(ActaCierrePDF, {
      empresaNombreHeader: proyecto.empresa?.nombre || "Mi Empresa",
      proyectoNombre: proyecto.nombre,
      fechaCierre: acta.fechaCierre ? acta.fechaCierre.toISOString() : null,
      comitente: {
        nombre: proyecto.cliente,
        razonSocial: proyecto.clienteRazonSocial,
        rut: proyecto.clienteRut,
        telefono: proyecto.clienteTelefono,
        email: proyecto.clienteEmail,
      },
      empresa: proyecto.empresa
        ? {
            nombre: proyecto.empresa.nombre,
            rut: proyecto.empresa.rut,
            matricula: proyecto.empresa.matricula,
            direccion: proyecto.empresa.direccion,
            telefono: proyecto.empresa.telefono,
          }
        : null,
      observacionesGenerales: acta.observacionesGenerales,
      observaciones: acta.observaciones.map((o) => ({
        rubroCodigo: o.rubro.codigo,
        rubroDescripcion: o.rubro.descripcion,
        capituloNombre: o.rubro.capitulo?.nombre,
        observacion: o.observacion,
        estado: o.estado,
      })),
      firmantes: acta.firmantes.map((f) => ({ nombre: f.nombre, rol: f.rol })),
    }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(elemento);

    const nombreBase = `Acta-Cierre-${proyecto.nombre}`.replace(/\s+/g, "-");
    const nombreAscii = nombreBase.replace(/[^\x20-\x7E]/g, "").replace(/-+/g, "-") || "acta-cierre";
    const nombreArchivoAscii = `${nombreAscii}.pdf`;
    const nombreArchivoUtf8 = encodeURIComponent(`${nombreBase}.pdf`);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombreArchivoAscii}"; filename*=UTF-8''${nombreArchivoUtf8}`,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/cierre-obra/pdf]", err);
    return NextResponse.json({ error: "Error interno generando el PDF" }, { status: 500 });
  }
}
