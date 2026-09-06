"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const CLASE_DEFAULT =
  "inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#2563EB] transition-colors mb-4";

// Deep-link genérico desde cualquier ítem del sidebar (o desde un link
// puntual armado a mano, ej. irAMaterialPendiente en proyectos/[id]/page.tsx)
// hacia una pantalla de referencia (Materiales, Mano de Obra, Catálogo de
// Rubros, Leyes Sociales, Configuración) — vuelve directo al proyecto de
// origen sin pasar por Mis Proyectos. Se autocontiene en su propio
// <Suspense>: useSearchParams() lo exige para no forzar al resto de la
// página (a veces un Server Component) a manejarlo.
function BotonVolverAlProyectoInner({ className }: { className?: string }) {
  const searchParams = useSearchParams();
  const proyectoOrigenId = searchParams.get("from");

  if (!proyectoOrigenId) return null;

  return (
    <Link href={`/proyectos/${proyectoOrigenId}`} className={className ?? CLASE_DEFAULT}>
      <ArrowLeft className="w-4 h-4" />
      Volver al proyecto
    </Link>
  );
}

export function BotonVolverAlProyecto({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <BotonVolverAlProyectoInner className={className} />
    </Suspense>
  );
}
