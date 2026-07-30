import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET — árbol completo Capítulo → Subcapítulo → Rubro del catálogo maestro,
// para la navegación jerárquica de la Biblioteca (/rubros). Volumen chico
// (~24 capítulos, ~450 subrubros) — se trae entero en una sola llamada en
// vez de expandir por demanda.
export async function GET() {
  try {
    const capitulos = await db.capituloCatalogo.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      include: {
        subcapitulos: {
          orderBy: { orden: "asc" },
          include: {
            subrubros: {
              where: { activo: true },
              orderBy: { codigo: "asc" },
              include: { apuEstandar: { select: { id: true } } },
            },
          },
        },
        subrubros: {
          where: { activo: true, subcapituloId: null },
          orderBy: { codigo: "asc" },
          include: { apuEstandar: { select: { id: true } } },
        },
      },
    });

    const mapSubrubro = (s: { id: string; codigo: string; descripcion: string; unidad: string; apuEstandar: { id: string } | null }) => ({
      id: s.id,
      codigo: s.codigo,
      descripcion: s.descripcion,
      unidad: s.unidad,
      tieneApuEstandar: s.apuEstandar != null,
    });

    const resultado = capitulos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      subrubrosDirectos: c.subrubros.map(mapSubrubro),
      subcapitulos: c.subcapitulos.map((sc) => ({
        id: sc.id,
        nombre: sc.nombre,
        subrubros: sc.subrubros.map(mapSubrubro),
      })),
    }));

    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[GET /api/subrubros-estandar/jerarquia]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
