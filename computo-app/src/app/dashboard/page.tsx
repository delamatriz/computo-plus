import { db } from "@/lib/db";
import Link from "next/link";
import GraficoProyectosPorMes from "@/components/dashboard/GraficoProyectosPorMes";

export const dynamic = "force-dynamic";

const ESTADO_LABELS: Record<string, string> = {
  EN_CURSO: "En curso",
  FINALIZADO: "Finalizado",
  BORRADOR: "Borrador",
  PAUSADO: "Pausado",
};

const ESTADO_CLASSES: Record<string, string> = {
  EN_CURSO: "bg-green-100 text-green-700",
  FINALIZADO: "bg-slate-100 text-slate-600",
  BORRADOR: "bg-yellow-100 text-yellow-700",
  PAUSADO: "bg-amber-100 text-amber-700",
};

// Orden fijo de las 4 tarjetas de estado — no el orden en que aparecen en
// la base, sino el orden de flujo natural de un presupuesto.
const ESTADOS_ORDEN = ["BORRADOR", "EN_CURSO", "PAUSADO", "FINALIZADO"] as const;

// Subtítulo de la tarjeta KPI de cada estado — el de FINALIZADO refleja el
// significado real de hoy (precio congelado al entregar, ver "Entregar"
// en proyectos/[id]/page.tsx), no "cerrado": un finalizado se puede volver
// a editar con "Habilitar edición" sin dejar de ser un presupuesto real.
const ESTADO_SUBTITULO: Record<string, string> = {
  BORRADOR: "aún sin confirmar",
  EN_CURSO: "obras en marcha",
  PAUSADO: "obras en pausa",
  FINALIZADO: "presupuesto entregado",
};

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_GRAFICO = 6;

// Orden fijo de visualización — no el orden de inserción del objeto
// totalPorMoneda (que seguiría el orden en que aparece cada moneda entre
// los proyectos, no determinístico como criterio visual).
const MONEDAS_ORDEN = ["UYU", "USD"];

// moneda es un campo real por proyecto (UYU/USD, ver Proyecto.moneda) —
// nunca se suman entre sí (ver totalPorMoneda más abajo); el símbolo acá
// solo decide cómo se imprime cada monto ya separado por moneda.
function fmtMoneda(n: number, moneda: string): string {
  const simbolo = moneda === "USD" ? "U$S" : "$";
  return n >= 1000000
    ? `${simbolo} ${(n / 1000000).toFixed(1)}M`
    : n >= 1000
    ? `${simbolo} ${(n / 1000).toFixed(0)}K`
    : `${simbolo} ${n.toFixed(0)}`;
}

export default async function DashboardPage() {
  const [proyectos, materialesPendientes] = await Promise.all([
    db.proyecto.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { capitulos: true } },
        capitulos: {
          include: {
            rubros: { select: { precioUnit: true, cantidad: true } },
          },
        },
      },
    }),
    db.precioMTOP.count({ where: { requiereVerificacion: true } }),
  ]);

  function totalProyecto(p: (typeof proyectos)[number]): number {
    return p.capitulos.reduce(
      (a, c) => a + c.rubros.reduce((b, r) => b + r.precioUnit * r.cantidad, 0),
      0
    );
  }

  // Nunca se suman entre monedas distintas — un acumulador por moneda, no
  // uno solo (ver el bug del dashboard viejo: sumaba UYU y USD como si
  // fueran la misma unidad y mostraba todo con símbolo de dólar).
  const totalPorMoneda: Record<string, number> = {};
  for (const p of proyectos) {
    const total = totalProyecto(p);
    totalPorMoneda[p.moneda] = (totalPorMoneda[p.moneda] ?? 0) + total;
  }

  const contadorPorEstado = Object.fromEntries(
    ESTADOS_ORDEN.map((e) => [e, proyectos.filter((p) => p.estado === e).length])
  ) as Record<(typeof ESTADOS_ORDEN)[number], number>;

  // Últimos MESES_GRAFICO meses en orden cronológico (más viejo primero),
  // incluyendo los que tienen 0 proyectos creados — si no, el eje del
  // gráfico saltearía meses sin dato en vez de mostrar un hueco en 0.
  const hoy = new Date();
  const datosGrafico = Array.from({ length: MESES_GRAFICO }, (_, i) => {
    const offset = MESES_GRAFICO - 1 - i;
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth() - offset;
    const fechaMes = new Date(anio, mes, 1);
    const cantidad = proyectos.filter((p) => {
      const c = new Date(p.createdAt);
      return c.getFullYear() === fechaMes.getFullYear() && c.getMonth() === fechaMes.getMonth();
    }).length;
    return { mes: NOMBRES_MES[fechaMes.getMonth()], cantidad };
  });

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#1A3A5C]">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString("es-UY", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Tarjetas KPI — 4 estados + total por moneda + cola de revisión */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {ESTADOS_ORDEN.map((estado) => (
          <div key={estado} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <p className="text-3xl font-bold text-[#1A3A5C]">{contadorPorEstado[estado]}</p>
            <p className="text-sm text-slate-500 mt-1">{ESTADO_LABELS[estado]}</p>
            <p className="text-xs text-slate-400">{ESTADO_SUBTITULO[estado]}</p>
          </div>
        ))}

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="space-y-0.5">
            {MONEDAS_ORDEN.filter((m) => m in totalPorMoneda).map((m) => (
              <p
                key={m}
                className={`font-bold text-[#1A3A5C] leading-tight ${
                  MONEDAS_ORDEN.filter((x) => x in totalPorMoneda).length > 1 ? "text-2xl" : "text-3xl"
                }`}
              >
                {fmtMoneda(totalPorMoneda[m], m)}
              </p>
            ))}
          </div>
          <p className="text-sm text-slate-500 mt-1">Total presupuestado</p>
          <p className="text-xs text-slate-400">en {proyectos.length} proyectos</p>
        </div>

        <Link
          href="/configuracion/revision-precios"
          className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm hover:bg-amber-100/60 transition-colors block"
        >
          <p className="text-3xl font-bold text-amber-700">{materialesPendientes}</p>
          <p className="text-sm text-amber-700 mt-1">Materiales pendientes</p>
          <p className="text-xs text-amber-600">de revisión →</p>
        </Link>
      </div>

      {/* Proyectos creados por mes — últimos 6 meses, agregado de todos los
          proyectos (no la curva S de un proyecto puntual, esa vive en
          SeccionCronograma.tsx dentro de cada proyecto). */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-8">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-semibold text-[#1A3A5C]">Proyectos creados por mes</h2>
        </div>
        <GraficoProyectosPorMes data={datosGrafico} />
      </div>

      {/* Lista de proyectos recientes */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-[#1A3A5C]">Proyectos recientes</h2>
          <Link href="/proyectos" className="text-sm text-[#2563EB] hover:underline">
            Ver todos →
          </Link>
        </div>
        {proyectos.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p>No hay proyectos todavía.</p>
            <Link href="/proyectos/nuevo" className="text-[#2563EB] hover:underline text-sm mt-2 block">
              Crear primer proyecto
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {proyectos.slice(0, 6).map((p) => {
              const total = totalProyecto(p);
              return (
                <Link
                  key={p.id}
                  href={`/proyectos/${p.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-[#1E293B] text-sm">{p.nombre}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.cliente && `${p.cliente} · `}
                      {p._count.capitulos} capítulos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#2563EB]">
                      {total > 0 ? fmtMoneda(total, p.moneda) : "—"}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        ESTADO_CLASSES[p.estado] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {ESTADO_LABELS[p.estado] ?? p.estado}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
