import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { PresupuestoPDF, ProyectoConCapitulos, ModoPDF } from "@/components/PresupuestoPDF";
import { calcularCostoDirectoAgregado, calcularCostosIndirectosAgregados, calcularUtilidadAgregada, type ApuParaCosto } from "@/lib/costoAgregado";
import { calcularDiasObra } from "@/lib/diasObra";
import React from "react";

const MODOS_VALIDOS: ModoPDF[] = ["cerrado", "abierto", "interno"];

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const modoParam = req.nextUrl.searchParams.get("modo");
    const modo: ModoPDF = MODOS_VALIDOS.includes(modoParam as ModoPDF) ? (modoParam as ModoPDF) : "abierto";

    const proyecto = await db.proyecto.findUnique({
      where: { id },
      include: {
        empresa: true,
        leyesSociales: true,
        titulos: {
          orderBy: { orden: "asc" },
        },
        capitulos: {
          orderBy: { orden: "asc" },
          include: {
            rubros: {
              orderBy: { codigo: "asc" },
              // Antes no se traía el APU — el PDF no tenía forma de separar
              // Costo Directo/Costos Indirectos/Utilidad, solo conocía el
              // precioUnit final de cada rubro. Necesario para reusar
              // calcularCostoDirectoAgregado/calcularUtilidadAgregada de
              // costoAgregado.ts (las mismas funciones que ya usa la
              // cascada de tarjetas), en vez de reimplementar la lógica acá.
              include: {
                apu: { include: { materiales: true, manoObra: true, equipos: true } },
              },
            },
          },
        },
      },
    });

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // El AUC propietario NO va en Gastos Generales — se muestra aparte en
    // la línea "Leyes Sociales — Aporte Propietario" para evitar duplicarlo.
    const itemsExtras = Array.isArray(proyecto.gastosGeneralesItems)
      ? (proyecto.gastosGeneralesItems as { id: string; descripcion: string; monto: number }[])
      : [];
    const sumaItemsExtras = itemsExtras.reduce((s, item) => s + (item.monto || 0), 0);

    // Costo Directo, Costos Indirectos y Utilidad agregados — mismas
    // funciones puras que ya usa la cascada de tarjetas en
    // proyectos/[id]/page.tsx (costoAgregado.ts), para que el PDF nunca
    // vuelva a quedar con una fórmula propia desincronizada. Antes, en
    // modo Porcentaje, Costos Indirectos se perdía por completo acá (el
    // PDF solo sumaba el total fijo del modo Detallado, 0 en Porcentaje).
    const capitulosParaCosto = proyecto.capitulos.map((cap) => ({
      rubros: cap.rubros.map((r) => ({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit })),
    }));
    const apuDataParaCosto: Record<string, ApuParaCosto> = {};
    for (const cap of proyecto.capitulos) {
      for (const r of cap.rubros) {
        if (r.apu) {
          apuDataParaCosto[r.id] = {
            materiales: r.apu.materiales,
            manoObra: r.apu.manoObra,
            equipos: r.apu.equipos,
            aportesPatronalesPct: r.apu.aportesPatronalesPct,
            utilidadPct: r.apu.utilidadPct,
          };
        }
      }
    }
    const costoDirectoAgregado = calcularCostoDirectoAgregado(capitulosParaCosto, apuDataParaCosto);
    const utilidadAgregada = calcularUtilidadAgregada(capitulosParaCosto, apuDataParaCosto);
    const costosIndirectosAgregados = calcularCostosIndirectosAgregados(
      proyecto.modoGastosGenerales,
      proyecto.gastosGeneralesDetallado,
      proyecto.gastosGeneralesPctDefault,
      costoDirectoAgregado.total
    );
    // "Días de Obra" — misma función pura que ya usa proyectos/[id]/page.tsx
    // (lib/diasObra.ts), sobre los mismos capitulosParaCosto/apuDataParaCosto
    // ya armados arriba (ambos ya tienen "rendimiento" por línea de mano de
    // obra, no hace falta una consulta ni un mapeo nuevo).
    const diasObra = calcularDiasObra(capitulosParaCosto, apuDataParaCosto);

    const datos: ProyectoConCapitulos = {
      id: proyecto.id,
      nombre: proyecto.nombre,
      subtitulo: proyecto.subtitulo,
      cliente: proyecto.cliente,
      clienteRut: proyecto.clienteRut,
      tipo: proyecto.tipo,
      area: proyecto.area,
      direccion: proyecto.direccion,
      moneda: proyecto.moneda,
      empresa: proyecto.empresa
        ? {
            nombre: proyecto.empresa.nombre,
            rut: proyecto.empresa.rut,
            direccion: proyecto.empresa.direccion,
            telefono: proyecto.empresa.telefono,
            email: proyecto.empresa.email,
            web: proyecto.empresa.web,
            logo: proyecto.empresa.logo,
          }
        : null,
      costoDirectoAgregado: costoDirectoAgregado.total,
      costosIndirectosAgregados,
      utilidadAgregada,
      diasObra: diasObra.total,
      sumaItemsExtras,
      // Timbres CJP no lleva IVA (confirmado) — se pasa aparte para que el
      // PDF pueda excluirlo de la base de IVA sin perder el desglose (se
      // sigue sumando con Ítems extra y Costos Indirectos para la línea
      // combinada "GASTOS GENERALES", sin cambios visuales ahí).
      timbresCJP: proyecto.timbresCJP,
      incluyeIVA: proyecto.incluyeIVA,
      montoImponibleMO: proyecto.leyesSociales?.montoImponibleMO ?? null,
      fechaInicio: proyecto.fechaInicio,
      fechaPresupuesto: proyecto.fechaPresupuesto,
      plazoObra: proyecto.plazoObra,
      diasLaborales: proyecto.diasLaborales,
      garantiaFielCumplimiento: proyecto.garantiaFielCumplimiento,
      garantiaViciosOcultos: proyecto.garantiaViciosOcultos,
      garantiaResponsabilidad: proyecto.garantiaResponsabilidad,
      memoriaDescriptiva: proyecto.memoriaDescriptiva,
      notasPresupuesto: proyecto.notasPresupuesto,
      titulos: proyecto.titulos.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        color: t.color,
      })),
      capitulos: proyecto.capitulos.map((cap) => ({
        id: cap.id,
        nombre: cap.nombre,
        codigo: cap.codigo,
        tituloId: cap.tituloId,
        rubros: cap.rubros.map((r) => ({
          id: r.id,
          codigo: r.codigo,
          descripcion: r.descripcion,
          unidad: r.unidad,
          cantidad: r.cantidad,
          precioUnit: r.precioUnit,
        })),
      })),
    };

    const elemento = React.createElement(PresupuestoPDF, { proyecto: datos, modo }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(elemento);

    // Nombre de archivo seguro para el header (ASCII) + versión UTF-8 (RFC 5987) para nombres con tildes/símbolos
    const nombreBase = proyecto.nombre.replace(/\s+/g, "-");
    const nombreAscii = nombreBase.replace(/[^\x20-\x7E]/g, "").replace(/-+/g, "-") || "presupuesto";
    const nombreArchivoAscii = `Presupuesto-${nombreAscii}.pdf`;
    const nombreArchivoUtf8 = encodeURIComponent(`Presupuesto-${nombreBase}.pdf`);

    const response = new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombreArchivoAscii}"; filename*=UTF-8''${nombreArchivoUtf8}`,
      },
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/pdf]", err);
    return NextResponse.json({ error: "Error interno generando el PDF" }, { status: 500 });
  }
}
