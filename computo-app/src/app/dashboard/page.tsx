import { db } from "@/lib/db";
import Link from "next/link";

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

export default async function DashboardPage() {
  const proyectos = await db.proyecto.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { capitulos: true } },
      capitulos: {
        include: {
          rubros: { select: { precioUnit: true, cantidad: true } },
        },
      },
    },
  });

  const totalGeneral = proyectos.reduce((acc, p) => {
    const total = p.capitulos.reduce(
      (a, c) => a + c.rubros.reduce((b, r) => b + r.precioUnit * r.cantidad, 0),
      0
    );
    return acc + total;
  }, 0);

  const enCurso = proyectos.filter((p) => p.estado === "EN_CURSO").length;
  const finalizados = proyectos.filter((p) => p.estado === "FINALIZADO").length;

  const fmtMoneda = (n: number) =>
    n >= 1000000
      ? `U$S ${(n / 1000000).toFixed(1)}M`
      : n >= 1000
      ? `U$S ${(n / 1000).toFixed(0)}K`
      : `U$S ${n.toFixed(0)}`;

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

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-3xl font-bold text-[#1A3A5C]">{enCurso}</p>
          <p className="text-sm text-slate-500 mt-1">Proyectos activos</p>
          <p className="text-xs text-slate-400">en curso</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-3xl font-bold text-[#1A3A5C]">{fmtMoneda(totalGeneral)}</p>
          <p className="text-sm text-slate-500 mt-1">Total presupuestado</p>
          <p className="text-xs text-slate-400">en {proyectos.length} proyectos</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-3xl font-bold text-[#1A3A5C]">{proyectos.length}</p>
          <p className="text-sm text-slate-500 mt-1">Total proyectos</p>
          <p className="text-xs text-slate-400">en la base de datos</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-3xl font-bold text-[#1A3A5C]">{finalizados}</p>
          <p className="text-sm text-slate-500 mt-1">Finalizados</p>
          <p className="text-xs text-slate-400">proyectos cerrados</p>
        </div>
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
              const total = p.capitulos.reduce(
                (a, c) => a + c.rubros.reduce((b, r) => b + r.precioUnit * r.cantidad, 0),
                0
              );
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
                      {total > 0 ? fmtMoneda(total) : "—"}
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
