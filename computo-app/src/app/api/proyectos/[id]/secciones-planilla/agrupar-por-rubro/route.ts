import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto } from "@/lib/sesion";

// POST — "Agrupar por rubro": una sección por cada rubro con filas
// vinculadas (nombre = nombre del rubro) y cada fila vinculada pasa a la
// sección de su rubro. Las filas sin vínculo no se tocan (siguen donde
// estaban: sueltas o en su sección).
//
// - Alcanza con filas vinculadas a un rubro (una sola sección también
//   ordena: separa lo vinculado de lo suelto).
// - Cada sección guarda su rubro (SeccionPlanilla.rubroId): si ya existe la
//   sección de ese rubro se reusa aunque la hayan renombrado; si no, se
//   reusa una sección manual con el mismo nombre (y pasa a ser la del
//   rubro). Correr el botón dos veces da el mismo resultado.
// - Dos rubros con el mismo nombre en capítulos distintos (ej. "Revoque
//   grueso" en Albañilería y en Fachada) quedan en secciones separadas, con
//   el capítulo entre paréntesis.
// - Las secciones nuevas van al final, en el orden del presupuesto
//   (capítulo y código del rubro).
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    const vinculadas = await db.filaMetraje.findMany({
      where: { documento: { proyectoId: id }, rubroId: { not: null } },
      select: {
        id: true,
        rubro: { select: { id: true, codigo: true, descripcion: true, capitulo: { select: { nombre: true, orden: true } } } },
      },
    });

    const rubros = new Map<string, NonNullable<(typeof vinculadas)[number]["rubro"]>>();
    const filasPorRubro = new Map<string, string[]>();
    for (const f of vinculadas) {
      if (!f.rubro) continue;
      rubros.set(f.rubro.id, f.rubro);
      filasPorRubro.set(f.rubro.id, [...(filasPorRubro.get(f.rubro.id) ?? []), f.id]);
    }
    if (rubros.size < 1) {
      return NextResponse.json(
        { error: "Para agrupar por rubro hace falta al menos una fila vinculada a un rubro." },
        { status: 400 }
      );
    }

    const ordenados = [...rubros.values()].sort(
      (a, b) => a.capitulo.orden - b.capitulo.orden || a.codigo.localeCompare(b.codigo, "es", { numeric: true })
    );
    // Nombre de cada sección: el del rubro; si se repite, con el capítulo; y
    // si aun así se repite (dos rubros iguales en el mismo capítulo), con el
    // código del rubro. Así cada rubro cae siempre en su propia sección.
    type R = (typeof ordenados)[number];
    const repetidos = (nombres: Map<string, string>) => {
      const cuenta = new Map<string, number>();
      for (const n of nombres.values()) cuenta.set(n.toLowerCase(), (cuenta.get(n.toLowerCase()) ?? 0) + 1);
      return (n: string) => (cuenta.get(n.toLowerCase()) ?? 0) > 1;
    };
    const base = new Map(ordenados.map((r) => [r.id, r.descripcion.trim() || "Rubro sin nombre"]));
    const repiteBase = repetidos(base);
    const conCapitulo = new Map(
      ordenados.map((r) => [r.id, repiteBase(base.get(r.id)!) ? `${base.get(r.id)} (${r.capitulo.nombre})` : base.get(r.id)!])
    );
    const repiteCapitulo = repetidos(conCapitulo);
    const nombreSeccion = (r: R) =>
      repiteCapitulo(conCapitulo.get(r.id)!) ? `${base.get(r.id)} (${r.capitulo.nombre}, ${r.codigo})` : conCapitulo.get(r.id)!;

    await db.$transaction(async (tx) => {
      const existentes = await tx.seccionPlanilla.findMany({ where: { proyectoId: id }, orderBy: { orden: "asc" } });
      const porRubro = new Map(existentes.filter((s) => s.rubroId).map((s) => [s.rubroId!, s.id]));
      // Solo secciones manuales: una que ya es de otro rubro no se reclama
      // aunque se llame igual.
      const manualesPorNombre = new Map(existentes.filter((s) => !s.rubroId).map((s) => [s.nombre.trim().toLowerCase(), s.id]));
      let siguienteOrden = (existentes.at(-1)?.orden ?? -1) + 1;

      for (const r of ordenados) {
        const nombre = nombreSeccion(r);
        let seccionId = porRubro.get(r.id);
        if (!seccionId) {
          const manual = manualesPorNombre.get(nombre.toLowerCase());
          if (manual) {
            await tx.seccionPlanilla.update({ where: { id: manual }, data: { rubroId: r.id } });
            manualesPorNombre.delete(nombre.toLowerCase());
            seccionId = manual;
          } else {
            const nueva = await tx.seccionPlanilla.create({ data: { proyectoId: id, nombre, orden: siguienteOrden++, rubroId: r.id } });
            seccionId = nueva.id;
          }
          porRubro.set(r.id, seccionId);
        }
        await tx.filaMetraje.updateMany({ where: { id: { in: filasPorRubro.get(r.id) ?? [] } }, data: { seccionId } });
      }
      // Dos consultas por rubro contra el Postgres remoto: el tope de 5 s por
      // defecto de una transacción interactiva queda corto con muchos rubros.
    }, { timeout: 30000 });

    const [secciones, filas] = await Promise.all([
      db.seccionPlanilla.findMany({ where: { proyectoId: id }, orderBy: [{ orden: "asc" }, { createdAt: "asc" }] }),
      db.filaMetraje.findMany({ where: { documento: { proyectoId: id } }, orderBy: { createdAt: "asc" } }),
    ]);
    return NextResponse.json({ secciones, filas });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/secciones-planilla/agrupar-por-rubro]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
