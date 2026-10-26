"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { proyectoIdDesdeParams } from "@/lib/proyectoActual";
import { nombreProyectoParaMostrar } from "@/lib/resumenProyecto";

const CLASE_DEFAULT =
  "inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#2563EB] transition-colors mb-4";

// Deep-link genérico desde cualquier ítem del sidebar, desde la campanita del
// Header o desde un link puntual armado a mano (ej. irAMaterialPendiente en
// proyectos/[id]/page.tsx) hacia una pantalla de referencia (Materiales, Mano
// de Obra, Catálogo de Rubros, Leyes Sociales, Configuración, Cola de
// revisión) — vuelve directo al proyecto de origen sin pasar por Mis
// Proyectos. Se autocontiene en su propio <Suspense>: useSearchParams() lo
// exige para no forzar al resto de la página (a veces un Server Component) a
// manejarlo.
//
// Dos formatos de URL, los dos vigentes:
//   ?from=proyecto&proyectoId=<id>   (campanita — ver conProyectoDeOrigen)
//   ?from=<id>                       (sidebar y links viejos)
// Sin ninguno de los dos no se muestra nada.
//
// El nombre sale de GET /api/proyectos/<id>?resumen=1. Si ese pedido da 404
// (proyecto inexistente o de otra empresa) el botón se oculta: no tiene
// sentido ofrecer volver a una pantalla que no existe. Ante cualquier otro
// fallo queda el rótulo genérico.
function BotonVolverAlProyectoInner({ className }: { className?: string }) {
  const searchParams = useSearchParams();
  const proyectoOrigenId = proyectoIdDesdeParams(searchParams);

  // El nombre se guarda junto con el id al que pertenece: si cambia el id,
  // el nombre viejo no se muestra ni un instante.
  const [resuelto, setResuelto] = useState<{ id: string; nombre: string | null; existe: boolean } | null>(null);

  useEffect(() => {
    if (!proyectoOrigenId) return;
    let cancelado = false;
    fetch(`/api/proyectos/${encodeURIComponent(proyectoOrigenId)}?resumen=1`)
      .then(async (res) => {
        if (cancelado) return;
        if (res.status === 404) return setResuelto({ id: proyectoOrigenId, nombre: null, existe: false });
        const data = res.ok ? await res.json().catch(() => null) : null;
        if (!cancelado) setResuelto({ id: proyectoOrigenId, nombre: typeof data?.nombre === "string" ? data.nombre : null, existe: true });
      })
      .catch(() => {
        if (!cancelado) setResuelto({ id: proyectoOrigenId, nombre: null, existe: true });
      });
    return () => {
      cancelado = true;
    };
  }, [proyectoOrigenId]);

  if (!proyectoOrigenId) return null;
  const actual = resuelto?.id === proyectoOrigenId ? resuelto : null;
  if (actual && !actual.existe) return null;

  return (
    <Link href={`/proyectos/${encodeURIComponent(proyectoOrigenId)}`} className={className ?? CLASE_DEFAULT}>
      <ArrowLeft className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">
        Volver al proyecto{actual?.nombre ? <> <span className="font-semibold text-slate-700">{nombreProyectoParaMostrar(actual.nombre)}</span></> : null}
      </span>
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
