import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { ListaMaterialesPDF, FilaMaterialPDF } from "@/components/ListaMaterialesPDF";
import React from "react";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const proyecto = await db.proyecto.findUnique({
      where: { id },
      include: {
        capitulos: {
          orderBy: { orden: "asc" },
          include: {
            rubros: {
              orderBy: { codigo: "asc" },
              include: {
                apu: {
                  include: {
                    materiales: {
                      orderBy: { orden: "asc" },
                      include: {
                        componentes: { orderBy: { orden: "asc" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const mapa = new Map<string, FilaMaterialPDF>();
    const agregar = (descripcion: string, unidad: string, cant: number, precio: number | undefined) => {
      const key = `${descripcion}||${unidad}`;
      const ex = mapa.get(key);
      if (ex) {
        ex.cantidadTotal += cant;
      } else {
        mapa.set(key, { descripcion, unidad, cantidadTotal: cant, precioUnit: precio });
      }
    };

    for (const cap of proyecto.capitulos) {
      for (const rubro of cap.rubros) {
        const apu = rubro.apu;
        if (!apu || rubro.cantidad == null) continue;
        for (const m of apu.materiales) {
          if (m.componentes && m.componentes.length > 0) {
            for (const comp of m.componentes) {
              const cant = comp.rendimientoPorUnidad * m.rendimiento * rubro.cantidad;
              agregar(comp.descripcion, comp.unidad, cant, comp.precioUnit);
            }
          } else {
            const cant = m.rendimiento * rubro.cantidad;
            agregar(m.descripcion, m.unidad, cant, m.precioUnit);
          }
        }
      }
    }

    const filas = Array.from(mapa.values())
      .filter((f) => f.cantidadTotal > 0)
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));

    const total = filas.reduce((s, f) => {
      if (f.precioUnit == null) return s;
      return s + f.cantidadTotal * f.precioUnit;
    }, 0);

    const elemento = React.createElement(ListaMaterialesPDF, {
      nombreProyecto: proyecto.nombre,
      filas,
      total,
    }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(elemento);

    const nombreBase = proyecto.nombre.replace(/\s+/g, "-");
    const nombreAscii = nombreBase.replace(/[^\x20-\x7E]/g, "").replace(/-+/g, "-") || "proyecto";
    const nombreArchivoAscii = `Lista-Materiales-${nombreAscii}.pdf`;
    const nombreArchivoUtf8 = encodeURIComponent(`Lista-Materiales-${nombreBase}.pdf`);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombreArchivoAscii}"; filename*=UTF-8''${nombreArchivoUtf8}`,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/lista-materiales-pdf]", err);
    return NextResponse.json({ error: "Error interno generando el PDF" }, { status: 500 });
  }
}
