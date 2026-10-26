import { Ruler } from "lucide-react";

// Guía "Cómo metrar un proyecto" de /metrajes. El trabajo de metrajes
// (Documentación para metrar, Planilla de cómputo, Visor) vive en la
// pestaña Presupuesto de cada proyecto (ver SeccionMetrajesPresupuesto.tsx);
// esta guía explica ese camino con los nombres de botones/pasos confirmados
// en el código real (Visor.tsx, PlanillaComputo.tsx,
// SeccionDocumentacionParaMetrar.tsx), no inventados. La futura Biblioteca
// de Metrajes (cómo se midió en otros proyectos) sigue sin diseño ni modelo
// de datos: queda el aviso de "Próximamente" al final.
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
        <strong className="text-slate-700">Planos y documentos</strong> (PDF
        o imagen). Después hacé clic en{" "}
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
        calibración funciona sobre planos en PDF; para imagen, próximamente.
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
        confirmar. Ojo: aplica todas las filas vinculadas al presupuesto,
        no solo la última que mediste.
      </>
    ),
  },
];

/** accion: el botón de la derecha del subtítulo (lo decide la página). */
export default function GuiaMetrar({ accion }: { accion: React.ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto w-full px-3 md:px-6 py-6 flex-1">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <p className="text-sm text-slate-500 max-w-xl">
          El camino corto entre un plano y un rubro con su cantidad cargada.
        </p>
        {accion}
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
  );
}
