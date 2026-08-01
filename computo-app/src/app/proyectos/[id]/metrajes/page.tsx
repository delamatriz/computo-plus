"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ruler } from "lucide-react";

// Esta página dejó de ser la página de TRABAJO de metrajes — ese contenido
// (Documentación para metrar, Planilla de cómputo, Calculadora, Visor) se
// mudó a la pestaña Presupuesto del proyecto (ver
// SeccionMetrajesPresupuesto.tsx y UI_UX_REDESIGN.md sección 2quater). Acá
// va a vivir a futuro la Biblioteca de Metrajes — consulta de cómo se midió
// en otros proyectos ya trabajados, como referencia — todavía sin diseñar
// en detalle ni implementar.
export default function MetrajesPage() {
  const params = useParams();
  const proyectoId = (params?.id as string) ?? "";
  const [proyectoNombre, setProyectoNombre] = useState("");

  useEffect(() => {
    if (!proyectoId) return;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado) setProyectoNombre(data.nombre ?? "");
      } catch {
        // silencioso — el nombre es solo decorativo acá
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [proyectoId]);

  return (
    <div className="min-h-full flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link
            href={`/proyectos/${proyectoId}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            {proyectoNombre || "Proyecto"}
          </Link>
          <h1 className="text-lg md:text-xl font-bold text-[#1A3A5C]">Metrajes</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-3 md:px-6 py-6 flex-1">
        <div className="flex flex-col items-center justify-center text-center bg-white rounded-[16px] border border-slate-300 shadow-sm py-16 px-6">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <Ruler className="w-5 h-5 text-[#2563EB]" />
          </div>
          <h2 className="text-sm font-semibold text-[#1E293B] mb-1">Próximamente</h2>
          <p className="text-sm text-slate-500 max-w-sm">
            Acá vas a poder consultar cómo se midió en otros proyectos ya
            trabajados, como referencia — la Biblioteca de Metrajes.
          </p>
          <p className="text-xs text-slate-400 max-w-sm mt-3">
            Para medir este proyecto, entrá a la pestaña{" "}
            <Link href={`/proyectos/${proyectoId}`} className="text-[#2563EB] hover:underline">
              Presupuesto
            </Link>{" "}
            y usá &quot;Documentación para metrar&quot;.
          </p>
        </div>
      </div>
    </div>
  );
}
