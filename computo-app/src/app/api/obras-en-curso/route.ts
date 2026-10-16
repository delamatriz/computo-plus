import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSesion } from "@/lib/sesion";
import { calcularTotalCertificadoAgregado } from "@/lib/totalCertificadoAgregado";

// Obras en curso de la empresa: proyectos en estado EN_CURSO (los otros dos
// estados son ANTEPROYECTO y FINALIZADO). El avance es el monto certificado
// acumulado sobre el total presupuestado (cantidad × precio unitario de los
// rubros) — mismo cálculo por monto que SeccionCertificaciones, sin promediar
// porcentajes de rubros de distinto peso. Sin certificaciones: avance null.
export async function GET() {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const proyectos = await db.proyecto.findMany({
      where: { empresaId: sesion.empresaId, estado: "EN_CURSO" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        nombre: true,
        cliente: true,
        capitulos: { select: { rubros: { select: { cantidad: true, precioUnit: true } } } },
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

    const obras = proyectos.map((p) => {
      const totalPresupuestado = p.capitulos.reduce(
        (s, c) => s + c.rubros.reduce((sr, r) => sr + (r.cantidad ?? 0) * (r.precioUnit ?? 0), 0),
        0
      );
      const tiene = p.certificaciones.length > 0;
      const certificado = calcularTotalCertificadoAgregado(
        p.certificaciones.map((c) => ({
          items: c.items.map((i) => ({
            porcentajeAvance: i.porcentajeAvance,
            rubro: i.rubro ? { cantidad: i.rubro.cantidad ?? 0, precioUnit: i.rubro.precioUnit ?? 0 } : null,
          })),
        }))
      );
      const avancePct = tiene && totalPresupuestado > 0 ? Math.min(100, (certificado / totalPresupuestado) * 100) : null;
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
