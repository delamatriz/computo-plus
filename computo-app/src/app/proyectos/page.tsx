import { db } from "@/lib/db";
import Link from "next/link";
import { sesionActual } from "@/lib/sesion";
import { redirect } from "next/navigation";
import { nombreTipoObra } from "@/lib/tiposObra";
import {
  SELECT_CAPITULOS_RESUMEN,
  nombreProyectoParaMostrar,
  totalPresupuestado,
  ultimaModificacion,
} from "@/lib/resumenProyecto";

// La lista de proyectos se consulta en cada request — no se debe cachear
// como contenido estático, ya que cambia cada vez que se crea un proyecto.
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

// UYU es la moneda por defecto (Proyecto.moneda): solo se muestra si es otra.
const MONEDA_DEFAULT = "UYU";

// Total completo, sin abreviar: en la tarjeta de un proyecto hay lugar
// (el Panel de control lo abrevia a K/M porque suma todos).
function fmtTotal(n: number, moneda: string): string {
  const simbolo = moneda === "USD" ? "U$S" : "$";
  return `${simbolo} ${n.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}

export default async function ProyectosPage() {
  // Solo los proyectos de la empresa del usuario (tenant). El proxy ya
  // exige sesión; esto es por si se llega igual sin ella.
  const sesion = await sesionActual();
  if (!sesion) redirect("/login");
  const proyectosBase = await db.proyecto.findMany({
    where: { empresaId: sesion.empresaId },
    include: {
      _count: { select: { capitulos: true, titulos: true } },
      capitulos: SELECT_CAPITULOS_RESUMEN,
    },
  });
  // Mismo orden que "Proyectos recientes" del Panel de control: última modificación primero.
  const proyectos = [...proyectosBase].sort((a, b) => ultimaModificacion(b) - ultimaModificacion(a));

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A3A5C]">Mis Proyectos</h1>
          <p className="text-slate-500 text-sm mt-1">Todos tus proyectos de obra.</p>
        </div>
        <Link
          href="/proyectos/nuevo"
          className="bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          + Nuevo proyecto
        </Link>
      </div>

      {proyectos.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg mb-2">No tenés proyectos todavía</p>
          <Link href="/proyectos/nuevo" className="text-[#2563EB] hover:underline">
            Crear tu primer proyecto
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proyectos.map((p) => {
            const total = totalPresupuestado(p);
            const detalle = [p.moneda !== MONEDA_DEFAULT ? p.moneda : null, nombreTipoObra(p.tipo)].filter(Boolean).join(" · ");
            return (
              <Link
                key={p.id}
                href={`/proyectos/${p.id}`}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-[#2563EB] transition-all flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      ESTADO_CLASSES[p.estado] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {ESTADO_LABELS[p.estado] ?? p.estado}
                  </span>
                  <span className="text-xs text-slate-400 text-right">{detalle}</span>
                </div>
                <h2 className="font-semibold text-[#1E293B] mb-1 line-clamp-2">{nombreProyectoParaMostrar(p.nombre)}</h2>
                {p.estado === "ANTEPROYECTO" && (
                  <p className="text-xs text-violet-500 mb-1">Creado con Cálculo Rápido</p>
                )}
                {p.cliente && <p className="text-sm text-slate-500 mb-1">{p.cliente}</p>}
                {/* Costo Directo + Utilidad, sin Gastos Generales ni IVA — el mismo total que el Panel de control. */}
                {total > 0 && (
                  <p
                    className="text-lg font-bold text-[#2563EB] mt-1 mb-3 tabular-nums"
                    title="Costo Directo + Utilidad — sin Gastos Generales ni IVA"
                  >
                    {fmtTotal(total, p.moneda)}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-3 border-t border-slate-100">
                  <span>
                    {/* Con un solo título el proyecto no muestra títulos en ningún lado: solo capítulos. */}
                    {p._count.titulos > 1 && `${p._count.titulos} títulos · `}
                    {p._count.capitulos} {p._count.capitulos === 1 ? "capítulo" : "capítulos"}
                  </span>
                  {p.area ? <span>{p.area.toLocaleString("es-UY")} m²</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
