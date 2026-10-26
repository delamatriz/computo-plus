import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSesion } from "@/lib/sesion";
import { calcularTotalCertificadoAgregado } from "@/lib/totalCertificadoAgregado";
import { SELECT_CAPITULOS_RESUMEN, WHERE_OBRA_EN_CURSO, totalPresupuestado, ultimaModificacion } from "@/lib/resumenProyecto";

// Obras en curso de la empresa: proyectos En curso con contrato o al menos una
// certificación (WHERE_OBRA_EN_CURSO, el mismo criterio que el link del Panel
// de control); uno En curso sin ninguno de los dos es un presupuesto en
// elaboración y no aparece. Ordenadas por última edición real
// (ultimaModificacion, igual que el Panel y Mis Proyectos). El avance es el monto certificado
// acumulado sobre el total presupuestado (cantidad × precio unitario de los
// rubros) — mismo cálculo por monto que SeccionCertificaciones, sin promediar
// porcentajes de rubros de distinto peso. Sin certificaciones: avance null.
export async function GET() {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const proyectos = await db.proyecto.findMany({
      where: { empresaId: sesion.empresaId, ...WHERE_OBRA_EN_CURSO },
      select: {
        id: true,
        nombre: true,
        cliente: true,
        updatedAt: true,
        capitulos: SELECT_CAPITULOS_RESUMEN,
        certificaciones: {
          orderBy: [{ fecha: "desc" }, { numero: "desc" }],
          select: {
            numero: true,
            fecha: true,
            items: { select: { porcentajeAvance: true, rubro: { select: { cantidad: true, precioUnit: true } } } },
          },
        },
      },
    });

    const ordenados = [...proyectos].sort((a, b) => ultimaModificacion(b) - ultimaModificacion(a));
    const obras = ordenados.map((p) => {
      const total = totalPresupuestado(p);
      const tiene = p.certificaciones.length > 0;
      const certificado = calcularTotalCertificadoAgregado(
        p.certificaciones.map((c) => ({
          items: c.items.map((i) => ({
            porcentajeAvance: i.porcentajeAvance,
            rubro: i.rubro ? { cantidad: i.rubro.cantidad ?? 0, precioUnit: i.rubro.precioUnit ?? 0 } : null,
          })),
        }))
      );
      const avancePct = tiene && total > 0 ? Math.min(100, (certificado / total) * 100) : null;
      return {
        id: p.id,
        nombre: p.nombre,
        cliente: p.cliente,
        avancePct,
        cantidadCertificaciones: p.certificaciones.length,
        ultimaCertificacion: tiene ? { numero: p.certificaciones[0].numero, fecha: p.certificaciones[0].fecha } : null,
      };
    });
    return NextResponse.json(obras);
  } catch (err) {
    console.error("[GET /api/obras-en-curso]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
