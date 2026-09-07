import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Ruler } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MetrajesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // El Sidebar ahora manda ?from=<proyectoId> cuando el usuario ya estaba
  // dentro de un proyecto (ver Sidebar.tsx) — se prioriza sobre el
  // fallback de abajo, que antes era el ÚNICO comportamiento y por eso
  // mandaba siempre al proyecto más viejo de la base sin importar de
  // dónde vino el usuario. Se valida que el id realmente exista (no
  // confiar ciegamente en un query param) antes de redirigir.
  const { from } = await searchParams;
  if (from) {
    const proyectoOrigen = await db.proyecto.findUnique({
      where: { id: from },
      select: { id: true },
    });
    if (proyectoOrigen) {
      redirect(`/proyectos/${proyectoOrigen.id}/metrajes?from=${proyectoOrigen.id}`);
    }
  }

  // Fallback — sin ?from= (ej. acceso directo a /metrajes sin venir de
  // ningún proyecto puntual): el proyecto más viejo de la base, como
  // último recurso para no dejar la pantalla vacía. Ya no es el
  // comportamiento principal.
  const proyectoActivo = await db.proyecto.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (proyectoActivo) {
    redirect(`/proyectos/${proyectoActivo.id}/metrajes`);
  }

  const proyectos = await db.proyecto.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-2 mb-6">
        <Ruler className="w-5 h-5 text-[#2563EB]" />
        <h1 className="text-2xl font-semibold text-[#1A3A5C]">Metrajes</h1>
      </div>

      {proyectos.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg mb-2">No tenés proyectos todavía</p>
          <Link href="/proyectos/nuevo" className="text-[#2563EB] hover:underline">
            Crear tu primer proyecto
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500 mb-4">
            Elegí un proyecto para ver o editar sus metrajes:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proyectos.map((p) => (
              <Link
                key={p.id}
                href={`/proyectos/${p.id}/metrajes`}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-[#2563EB] transition-all flex flex-col"
              >
                <h2 className="font-semibold text-[#1E293B] mb-1 line-clamp-2">{p.nombre}</h2>
                {p.cliente && (
                  <p className="text-sm text-slate-500">{p.cliente}</p>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
