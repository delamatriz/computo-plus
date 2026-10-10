import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto } from "@/lib/sesion";

function totalRubro(r: { cantidad: number; precioUnit: number }): number {
  return r.cantidad * r.precioUnit;
}

// Nombre legible de la variante para el mensaje de error — mismo texto que
// ya mostraba la versión anterior (con búsqueda de IA), para no romper la
// expectativa del usuario sobre qué variante corresponde a su proyecto.
function labelVariante(variante: string): string {
  return variante === "publica" ? "ICCV con participación pública" : "ICCV privado";
}

// Meses en español para el mensaje de error — mismo criterio que usaba el
// prompt de IA anterior ("agosto de 2026"), sin depender de Intl (evita
// diferencias de locale entre entornos).
const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function mesLegible(mes: string): string {
  const [anio, mesNum] = mes.split("-").map(Number);
  const nombre = MESES_ES[(mesNum ?? 1) - 1] ?? mes;
  return `${nombre} de ${anio}`;
}

// POST — antes disparaba una búsqueda web de IA por cada corrida (213k-467k
// tokens, y fallaba en encontrar el número índice absoluto de las
// variantes privada/pública 4 de 4 veces en el relevamiento — el INE solo
// expone esa cifra exacta en informes técnicos que la búsqueda no logra
// leer). Ahora es una lectura pura contra IndiceICCVMensual (carga manual
// de Luis en Configuración) — sin ninguna llamada a IA, ni logging de
// consumo (no hay nada que loguear).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const acceso = await requerirProyecto(proyectoId);
    if (acceso instanceof NextResponse) return acceso;
    const { fechaBase } = await req.json();

    if (typeof fechaBase !== "string" || !fechaBase) {
      return NextResponse.json({ error: "Falta la fecha base" }, { status: 400 });
    }

    const proyecto = await db.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
        capitulos: {
          include: { rubros: true },
        },
      },
    });

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const totalActual = proyecto.capitulos.reduce(
      (s, cap) => s + cap.rubros.reduce((sr, r) => sr + totalRubro(r), 0),
      0
    );

    const variante = proyecto.tipoContratacion === "PUBLICA" ? "publica" : "privada";

    const filaBase = await db.indiceICCVMensual.findUnique({
      where: { mes_variante: { mes: fechaBase, variante } },
    });
    if (!filaBase) {
      return NextResponse.json({
        error: `Índice de ${mesLegible(fechaBase)} no cargado — cargalo primero en Configuración.`,
      });
    }

    // "Más reciente publicado" = el mes más alto cargado para esta
    // variante (formato "YYYY-MM" ordena igual lexicográfico que
    // cronológico). Si Luis todavía no cargó nada más nuevo que la base,
    // el más reciente puede coincidir con la base — factor 1, válido.
    const filaActual = await db.indiceICCVMensual.findFirst({
      where: { variante },
      orderBy: { mes: "desc" },
    });
    if (!filaActual) {
      return NextResponse.json({
        error: `No hay ningún índice cargado todavía para "${labelVariante(variante)}" — cargalo primero en Configuración.`,
      });
    }

    const indiceBase = filaBase.valor;
    const indiceActual = filaActual.valor;
    const factor = indiceActual / indiceBase;
    const totalProyectado = totalActual * factor;

    await db.proyecto.update({
      where: { id: proyectoId },
      data: {
        fechaBaseIndice: new Date(`${fechaBase}-01`),
        indiceBaseValor: indiceBase,
      },
    });

    return NextResponse.json({
      factor,
      indiceBase,
      indiceActual,
      mesBase: mesLegible(fechaBase),
      mesActual: mesLegible(filaActual.mes),
      variante: labelVariante(variante),
      totalActual,
      totalProyectado,
    });
  } catch (err) {
    console.error("[actualizar-precios-indice POST]", err);
    return NextResponse.json(
      { error: "Error al consultar el índice ICCV" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const acceso = await requerirProyecto(proyectoId);
    if (acceso instanceof NextResponse) return acceso;
    const { factor } = await req.json();

    if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) {
      return NextResponse.json({ error: "Factor inválido" }, { status: 400 });
    }

    const capitulos = await db.capitulo.findMany({
      where: { proyectoId },
      include: { rubros: true },
    });

    for (const cap of capitulos) {
      for (const rubro of cap.rubros) {
        await db.rubro.update({
          where: { id: rubro.id },
          data: { precioUnit: rubro.precioUnit * factor },
        });
      }
    }

    await db.proyecto.update({
      where: { id: proyectoId },
      data: { ultimaActualizacionIndice: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[actualizar-precios-indice PUT]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
