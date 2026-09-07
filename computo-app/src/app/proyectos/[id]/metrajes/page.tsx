"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Ruler } from "lucide-react";
import { BotonVolverAlProyecto } from "@/components/shared/BotonVolverAlProyecto";

// Esta página dejó de ser la página de TRABAJO de metrajes — ese contenido
// (Documentación para metrar, Planilla de cómputo, Calculadora, Visor) vive
// en la pestaña Presupuesto del proyecto (ver SeccionMetrajesPresupuesto.tsx
// y UI_UX_REDESIGN.md sección 2quater). Acá antes había un "Próximamente"
// sobre una futura Biblioteca de Metrajes (consulta de cómo se midió en
// otros proyectos ya trabajados) — esa idea sigue sin diseñar en detalle ni
// implementar (confirmado: no hay modelo de datos ni diseño de UI más allá
// del párrafo de UI_UX_REDESIGN.md), así que mientras tanto esta pantalla
// ahora explica cómo medir ESTE proyecto, con los nombres de botones/pasos
// confirmados en el código real (Visor.tsx, PlanillaComputo.tsx,
// SeccionDocumentacionParaMetrar.tsx), no inventados.
interface PasoMetrar {
  numero: number;
  titulo: string;
  contenido: React.ReactNode;
}

const PASOS_METRAR: PasoMetrar[] = [
  {
    numero: 1,
    titulo: "Subí el plano",
    contenido: (
      <>
        En la pestaña <strong className="text-slate-700">Presupuesto</strong>,
        abrí <strong className="text-slate-700">Documentación para metrar</strong> y
        subí tu plano en la bandeja{" "}
        <strong className="text-slate-700">Planos y documentos</strong> (PDF,
        imagen o DWG). Después hacé clic en{" "}
        <strong className="text-slate-700">
          Ir al visor y planilla de metraje
        </strong>
        .
      </>
    ),
  },
  {
    numero: 2,
    titulo: "Calibrá la escala",
    contenido: (
      <>
        Antes de poder medir, el plano necesita saber a qué escala está
        dibujado. Usá <strong className="text-slate-700">Calibrar escala</strong> y
        escribila tal como figura en el plano (ej.{" "}
        <strong className="text-slate-700">1:100</strong>) — sin este paso
        las herramientas de medir quedan bloqueadas. Por ahora la
        calibración funciona sobre planos en PDF; para imagen y DWG está en
        camino.
      </>
    ),
  },
  {
    numero: 3,
    titulo: "Elegí la herramienta según lo que estés midiendo",
    contenido: (
      <>
        <strong className="text-slate-700">Medir</strong> para elementos
        lineales (muros, cañerías, zócalos),{" "}
        <strong className="text-slate-700">Área</strong> para superficies
        (pisos, revoques, cubiertas), y{" "}
        <strong className="text-slate-700">Punto</strong> para contar
        elementos repetidos (artefactos, luminarias, bocas eléctricas).
      </>
    ),
  },
  {
    numero: 4,
    titulo: "Medí sobre el plano",
    contenido: (
      <>
        Dibujá sobre el plano con la herramienta elegida — el sistema
        calcula la cantidad solo. Completá{" "}
        <strong className="text-slate-700">Descripción</strong> y, si
        corresponde, <strong className="text-slate-700">Repeticiones</strong>,
        y guardá.
      </>
    ),
  },
  {
    numero: 5,
    titulo: "Vinculá la medición a un rubro",
    contenido: (
      <>
        La medida aparece sola en la{" "}
        <strong className="text-slate-700">Planilla de Cómputo</strong>.
        Elegí el rubro que corresponde en la columna{" "}
        <strong className="text-slate-700">Rubro vinculado</strong>.
      </>
    ),
  },
  {
    numero: 6,
    titulo: "Aplicá al presupuesto",
    contenido: (
      <>
        Con <strong className="text-slate-700">Aplicar al presupuesto</strong>,
        arriba de la Planilla, vas a ver antes de nada un resumen —
        cantidad actual y cantidad nueva de cada rubro afectado — para
        confirmar. Ojo: aplica todas las filas vinculadas pendientes del
        proyecto, no solo la última que mediste.
      </>
    ),
  },
];

export default function MetrajesPage() {
  const params = useParams();
  const proyectoId = (params?.id as string) ?? "";

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

      <div className="max-w-6xl mx-auto w-full px-3 md:px-6 py-6 flex-1">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <p className="text-sm text-slate-500 max-w-xl">
            El camino corto entre un plano y un rubro con su cantidad cargada.
          </p>
          <Link
            href={`/proyectos/${proyectoId}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors flex-shrink-0"
          >
            Ir a Presupuesto
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <ol className="space-y-3">
          {PASOS_METRAR.map((paso) => (
            <li
              key={paso.numero}
              className="flex gap-4 bg-white rounded-xl border border-slate-200 p-4 md:p-5"
            >
              <div className="w-7 h-7 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center text-xs font-bold flex-shrink-0">
                {paso.numero}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-[#1E293B] mb-1">
                  {paso.titulo}
                </h4>
                <div className="text-sm text-slate-600 leading-relaxed">
                  {paso.contenido}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex items-start gap-3 bg-white rounded-xl border border-slate-200 p-4 md:p-5 mt-3">
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Ruler className="w-4 h-4 text-[#2563EB]" />
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Próximamente vas a poder consultar acá cómo se midió en otros
            proyectos ya trabajados, como referencia — la Biblioteca de
            Metrajes.
          </p>
        </div>
      </div>
    </div>
  );
}
