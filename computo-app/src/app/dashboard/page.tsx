import { db } from "@/lib/db";
import Link from "next/link";
import { Settings } from "lucide-react";
import GraficoProyectosPorMes from "@/components/dashboard/GraficoProyectosPorMes";
import { esSuperadmin, sesionActual } from "@/lib/sesion";
import { SELECT_CAPITULOS_RESUMEN, totalPresupuestado, ultimaModificacion } from "@/lib/resumenProyecto";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ESTADO_LABELS: Record<string, string> = {
  EN_CURSO: "En curso",
  FINALIZADO: "Finalizado",
  ANTEPROYECTO: "Anteproyecto",
  PAUSADO: "Pausado",
};

const ESTADO_CLASSES: Record<string, string> = {
  EN_CURSO: "bg-green-100 text-green-700",
  FINALIZADO: "bg-slate-100 text-slate-600",
  ANTEPROYECTO: "bg-violet-100 text-violet-700",
  PAUSADO: "bg-amber-100 text-amber-700",
};

// Orden fijo de las tarjetas de estado — no el orden en que aparecen en la
// base, sino el orden de flujo natural de un presupuesto. PAUSADO quedó
// afuera: estado inalcanzable desde ninguna acción de la UI (confirmado en
// diagnóstico previo), la tarjeta solo generaba una pregunta sin respuesta.
const ESTADOS_ORDEN = ["ANTEPROYECTO", "EN_CURSO", "FINALIZADO"] as const;

// Subtítulo de la tarjeta KPI de cada estado — el de FINALIZADO refleja el
// significado real de hoy (precio congelado al entregar, ver "Entregar"
// en proyectos/[id]/page.tsx), no "cerrado": un finalizado se puede volver
// a editar con "Habilitar edición" sin dejar de ser un presupuesto real.
// El de ANTEPROYECTO también es literal: hoy es el único camino que lleva
// a ese estado (ver "Guardar como anteproyecto" en /calcular).
const ESTADO_SUBTITULO: Record<string, string> = {
  ANTEPROYECTO: "creado con Cálculo Rápido",
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
// Coma decimal, como el resto de la app ("$ 1,5M", nunca "$ 1.5M").
function fmtMoneda(n: number, moneda: string): string {
  const simbolo = moneda === "USD" ? "U$S" : "$";
  const fmt = (v: number, decimales: number) =>
    v.toLocaleString("es-UY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return n >= 1000000
    ? `${simbolo} ${fmt(n / 1000000, 1)}M`
    : n >= 1000
    ? `${simbolo} ${fmt(n / 1000, 0)}K`
    : `${simbolo} ${fmt(n, 0)}`;
}

export default async function DashboardPage() {
  // Solo los proyectos de la empresa del usuario (tenant). El proxy ya
  // exige sesión; esto es por si se llega igual sin ella.
  const sesion = await sesionActual();
  if (!sesion) redirect("/login");
  // La cola de revisión es del catálogo global: solo la resuelve el
  // SUPERADMIN (la página /configuracion/revision-precios lo exige), así que
  // al resto ni se le cuenta ni se le muestra la tarjeta.
  const superadmin = await esSuperadmin(sesion);
  const [proyectos, materialesPendientes] = await Promise.all([
    db.proyecto.findMany({
      where: { empresaId: sesion.empresaId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { capitulos: true } },
        capitulos: SELECT_CAPITULOS_RESUMEN,
      },
    }),
    superadmin ? db.precioMTOP.count({ where: { requiereVerificacion: true, empresaId: null } }) : Promise.resolve(0),
  ]);

  // Total y última modificación: lib/resumenProyecto.ts (los mismos que Mis Proyectos).
  const totalProyecto = totalPresupuestado;
  const proyectosRecientes = [...proyectos]
    .sort((a, b) => ultimaModificacion(b) - ultimaModificacion(a))
    .slice(0, 6);

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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A3A5C]">Panel de control</h1>
          <p className="text-slate-500 text-sm mt-1">
            {superadmin
              ? "Resumen general de todos tus proyectos y del estado del catálogo de materiales."
              : "Resumen general de todos tus proyectos."}
          </p>
          <p className="text-slate-400 text-xs mt-1">
            {new Date().toLocaleDateString("es-UY", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Link
          href="/configuracion"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-slate-500 hover:text-[#2563EB] transition-colors"
        >
          <Settings className="w-3.5 h-3.5" /> Configuración
        </Link>
      </div>

      {/* Tarjetas KPI — 3 estados (PAUSADO afuera, inalcanzable) + total por moneda + cola de revisión (solo SUPERADMIN) */}
      <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 mb-8 ${superadmin ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        {ESTADOS_ORDEN.map((estado) => (
          <div key={estado} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <p className="text-3xl font-bold text-[#1A3A5C]">{contadorPorEstado[estado]}</p>
            <p className="text-sm text-slate-500 mt-1">{ESTADO_LABELS[estado]}</p>
            <p className="text-xs text-slate-400">{ESTADO_SUBTITULO[estado]}</p>
          </div>
        ))}

        <div
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
          title="Costo Directo + Utilidad, sin Gastos Generales ni IVA sobre el total (los materiales ya lo incluyen) — no es el precio final de cliente"
        >
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
          <p className="text-xs text-slate-400">en todos tus proyectos</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Costo Directo + Utilidad — sin Gastos Generales ni IVA
          </p>
        </div>

        {superadmin && (
          <Link
            href="/configuracion/revision-precios"
            className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm hover:bg-amber-100/60 transition-colors block"
          >
            <p className="text-3xl font-bold text-amber-700">{materialesPendientes}</p>
            <p className="text-sm text-amber-700 mt-1">Materiales pendientes</p>
            <p className="text-xs text-amber-600">de revisión →</p>
          </Link>
        )}
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
            {proyectosRecientes.map((p) => {
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
                      {p._count.capitulos} {p._count.capitulos === 1 ? "capítulo" : "capítulos"}
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
