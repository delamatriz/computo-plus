import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularPrecioVigenteRubro } from "@/lib/recalcularPrecioRubro";

// Dry-run masivo — recorre TODOS los proyectos con al menos un rubro con
// precioCongelado (ya "Entregados" alguna vez), recalcula cada uno contra
// PrecioMTOP/CategoriaLaboral (mismo motor que el modal rubro-por-rubro,
// ver lib/recalcularPrecioRubro.ts) y devuelve solo los que realmente
// cambiarían, agrupados por proyecto. Solo lectura — no escribe nada.
//
// `finalizado` viaja por proyecto porque precioCongelado != null NO implica
// que el proyecto siga FINALIZADO hoy — "Habilitar edición" vuelve a
// EN_CURSO sin tocar precioCongelado (ver comentario en
// proyectos/[id]/page.tsx). Se informa para que la pantalla de revisión
// pueda avisar antes de que el apply falle rubro por rubro.
export async function GET() {
  try {
    const proyectos = await db.proyecto.findMany({
      where: { capitulos: { some: { rubros: { some: { precioCongelado: { not: null } } } } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nombre: true,
        moneda: true,
        estado: true,
        capitulos: {
          select: {
            rubros: {
              where: { precioCongelado: { not: null } },
              select: { id: true, codigo: true, descripcion: true },
            },
          },
        },
      },
    });

    const resultado: {
      proyectoId: string;
      nombre: string;
      moneda: string;
      finalizado: boolean;
      rubros: {
        rubroId: string;
        codigo: string;
        descripcion: string;
        precioUnitAnterior: number;
        precioUnitVigente: number;
        diffPct: number;
        cambiaMateriales: boolean;
        cambiaManoObra: boolean;
      }[];
    }[] = [];

    for (const p of proyectos) {
      const rubrosDelProyecto = p.capitulos.flatMap((c) => c.rubros);
      const rubrosAfectados: (typeof resultado)[number]["rubros"] = [];

      // Secuencial a propósito, no Promise.all — el volumen esperado es
      // chico (ver investigación previa: 0 rubros congelados hoy) y cada
      // cálculo ya hace varias queries propias; en paralelo sin límite
      // podría saturar el pool de conexiones si el volumen crece.
      for (const r of rubrosDelProyecto) {
        const calculo = await calcularPrecioVigenteRubro(r.id);
        if (!calculo) continue;
        const cambiaMateriales = calculo.lineasMaterialActualizadas > 0;
        const cambiaManoObra = calculo.lineasManoObraActualizadas > 0;
        if (!cambiaMateriales && !cambiaManoObra) continue;

        rubrosAfectados.push({
          rubroId: r.id,
          codigo: r.codigo,
          descripcion: r.descripcion,
          precioUnitAnterior: calculo.precioUnitAnterior,
          precioUnitVigente: calculo.precioUnitVigente,
          diffPct: calculo.diffPct,
          cambiaMateriales,
          cambiaManoObra,
        });
      }

      if (rubrosAfectados.length > 0) {
        resultado.push({
          proyectoId: p.id,
          nombre: p.nombre,
          moneda: p.moneda,
          finalizado: p.estado === "FINALIZADO",
          rubros: rubrosAfectados,
        });
      }
    }

    const totalRubros = resultado.reduce((s, p) => s + p.rubros.length, 0);
    return NextResponse.json({ proyectos: resultado, totalProyectos: resultado.length, totalRubros });
  } catch (err) {
    console.error("[GET /api/configuracion/aplicar-precios-vigentes/dry-run]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
