import { db } from "@/lib/db";
import Link from "next/link";

// La lista de proyectos se consulta en cada request — no se debe cachear
// como contenido estático, ya que cambia cada vez que se crea un proyecto.
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

export default async function ProyectosPage() {
  const proyectos = await db.proyecto.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { capitulos: true } } },
  });

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#1A3A5C]">Mis Proyectos</h1>
        <Link
          href="/proyectos/nuevo"
          className="bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
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
          {proyectos.map((p) => (
            <Link
              key={p.id}
              href={`/proyectos/${p.id}`}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-[#2563EB] transition-all flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    ESTADO_CLASSES[p.estado] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {ESTADO_LABELS[p.estado] ?? p.estado}
                </span>
                <span className="text-xs text-slate-400">
                  {p.moneda} · {p.tipo}
                </span>
              </div>
              <h2 className="font-semibold text-[#1E293B] mb-1 line-clamp-2">{p.nombre}</h2>
              {p.cliente && (
                <p className="text-sm text-slate-500 mb-3">{p.cliente}</p>
              )}
              <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-3 border-t border-slate-100">
                <span>{p._count.capitulos} capítulos</span>
                {p.area && <span>{p.area} m²</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
