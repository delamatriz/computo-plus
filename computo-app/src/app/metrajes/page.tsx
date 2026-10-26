import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { sesionActual } from "@/lib/sesion";
import GuiaMetrar from "@/components/metrajes/GuiaMetrar";
import { BotonVolverAlProyecto } from "@/components/shared/BotonVolverAlProyecto";

export const dynamic = "force-dynamic";

// /metrajes muestra siempre la guía "Cómo metrar un proyecto" — la guía es
// la misma para cualquier proyecto, así que ya no redirige a ninguno (antes
// mandaba al proyecto más viejo de la empresa cuando se llegaba sin
// ?from=). El ?from= que manda el Sidebar ahora solo sirve para "Volver al
// proyecto" (BotonVolverAlProyecto).
const CLASE_BOTON =
  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors flex-shrink-0";

export default async function MetrajesPage() {
  const sesion = await sesionActual();
  if (!sesion) redirect("/login");
  const cantidadProyectos = await db.proyecto.count({ where: { empresaId: sesion.empresaId } });

  return (
    <div className="min-h-full flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <BotonVolverAlProyecto className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3" />
          <h1 className="text-lg md:text-xl font-bold text-[#1A3A5C]">
            Cómo metrar un proyecto
          </h1>
        </div>
      </div>

      <GuiaMetrar
        accion={
          cantidadProyectos > 0 ? (
            <Link href="/proyectos" className={CLASE_BOTON}>
              Ir a mis proyectos
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <p className="text-sm text-slate-500">
              Todavía no tenés proyectos —{" "}
              <Link href="/proyectos/nuevo" className="font-medium text-[#2563EB] hover:underline">
                Crear tu primer proyecto →
              </Link>
            </p>
          )
        }
      />
    </div>
  );
}
