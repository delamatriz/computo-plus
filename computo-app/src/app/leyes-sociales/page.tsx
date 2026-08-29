"use client";

import { ListaReferencias, type ReferenciaLink } from "@/components/ListaReferencias";

// Info general de BPS (no el texto de una ley puntual) — base de esta
// sección práctica.
const referencias: ReferenciaLink[] = [
  {
    titulo: "Leyes Sociales — BPS",
    descripcion: "Aportes patronales y personales de la construcción",
    url: "https://www.bps.gub.uy",
  },
  {
    titulo: "Pequeñas Obras de Mantenimiento — BPS",
    descripcion: "Condiciones y requisitos para obras de mantenimiento menores",
    url: "https://www.bps.gub.uy/9037/",
  },
];

// Guía redactada por Luis — índice de secciones para el TOC lateral
// (desktop) y la barra de pills horizontal (mobile). Mismos ids que las
// <section> más abajo.
const secciones = [
  { id: "auc", label: "AUC" },
  { id: "fondos-adicionales", label: "Fondos adicionales" },
  { id: "caja-profesionales", label: "Caja de Profesionales" },
  { id: "total-referencia", label: "Total de referencia" },
  { id: "ejemplo", label: "Ejemplo" },
  { id: "excluido-ley", label: "Excluido de Ley 14.411" },
  { id: "regimen-especial", label: "Régimen especial" },
  { id: "obra-publica", label: "Obra pública" },
  { id: "actualizar-porcentajes", label: "Actualizar los %" },
];

// El click nativo en <a href="#id"> dentro de este layout (contenido
// dentro de <main overflow-y-auto>, con la columna del índice en
// position:sticky al lado) terminaba scrolleando hasta el fondo de la
// página en vez de a la sección — probado: asignar location.hash por JS
// sí posiciona bien, pero el salto nativo del click no. Se maneja el
// scroll a mano en vez de confiar en el comportamiento nativo del
// navegador acá.
function irASeccion(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

function Tabla({
  encabezados,
  filas,
}: {
  encabezados: string[];
  filas: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            {encabezados.map((h, i) => (
              <th
                key={h}
                className={
                  "px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide " +
                  (i === 0 ? "text-left" : "text-right")
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
              {fila.map((celda, j) => (
                <td
                  key={j}
                  className={
                    "px-4 py-2.5 border-t border-slate-100 " +
                    (j === 0
                      ? "text-slate-700"
                      : "text-right font-medium text-slate-600 tabular-nums")
                  }
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LeyesSocialesPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Leyes Sociales
      </h1>
      <p className="text-slate-500 mb-8">
        Referencia general de aportes BPS, AUC y fondos de la industria de la
        construcción.
      </p>

      <ListaReferencias items={referencias} />

      <div className="mt-10 border-t border-slate-200 pt-8">
        <h2 className="text-lg font-bold text-[#1A3A5C] mb-1">
          Guía práctica para presupuestar
        </h2>
        <p className="text-sm text-slate-500 mb-6 max-w-2xl">
          Es el conjunto de aportes obligatorios que se suman al jornal en
          toda obra de construcción en Uruguay. Hay que registrar la obra en
          BPS entre 10 días antes y 48 horas hábiles después de empezada.
        </p>

        <div className="rounded-[12px] border border-blue-100 bg-blue-50/50 px-4 py-3 mb-8 max-w-2xl">
          <p className="text-sm font-semibold text-[#1A3A5C] mb-1">
            ¿Qué es el jornal?
          </p>
          <p className="text-sm text-slate-600">
            Es el monto en pesos que corresponde a una categoría puntual de
            trabajador — por ejemplo, $2.176,19 para un Medio Oficial
            Albañil. El laudo (o convenio SUNCA) es la tabla completa con
            los jornales de todas las categorías; el jornal es el valor
            específico de una categoría dentro de esa tabla.
          </p>
        </div>

        {/* Índice — mobile: pills horizontales, scrolleables, siempre
            visibles (no colapsan, solo permiten saltar rápido). En
            desktop se oculta acá y aparece como columna lateral fija. */}
        <nav
          aria-label="Índice de la guía"
          className="lg:hidden -mx-1 px-1 flex gap-2 overflow-x-auto pb-2 mb-8"
        >
          {secciones.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => irASeccion(e, s.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-[#2563EB] transition-colors whitespace-nowrap"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="lg:flex lg:gap-10 lg:items-start">
          {/* Índice — desktop: columna lateral fija (sticky) */}
          <aside className="hidden lg:block w-52 flex-shrink-0 sticky top-20 self-start">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 px-2 mb-2">
              En esta página
            </p>
            <nav aria-label="Índice de la guía" className="flex flex-col gap-0.5">
              {secciones.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => irASeccion(e, s.id)}
                  className="px-2 py-1.5 rounded-[6px] text-sm text-slate-500 hover:text-[#2563EB] hover:bg-blue-50/50 transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Contenido de la guía */}
          <div className="flex-1 min-w-0 space-y-10">
            <section id="auc" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                AUC (Aporte Unificado de la Construcción) — el aporte
                principal
              </h3>
              <p className="text-sm font-semibold text-slate-700 mb-1">
                Total: 71,8% sobre el jornal.
              </p>
              <Tabla
                encabezados={["Concepto", "%"]}
                filas={[
                  ["Jubilatorio — patronal", "9%"],
                  ["Jubilatorio — personal", "17,9%"],
                  ["Cargas salariales (aguinaldo, licencia, salario vacacional)", "29,9%"],
                  ["Salud (SNIS) — patronal", "5,5%"],
                  ["Salud (SNIS) — personal", "3,5%"],
                  ["BSE (accidentes de trabajo)", "6%"],
                ]}
              />
              <p className="text-sm text-slate-500 mt-3">
                Es tan alto porque el BPS liquida directamente aguinaldo,
                licencia y salario vacacional en este régimen.
              </p>
            </section>

            <section id="fondos-adicionales" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Fondos adicionales
              </h3>
              <Tabla
                encabezados={["Fondo", "% patronal", "% personal", "Total"]}
                filas={[
                  ["FSC + FOCAP (código 34)", "—", "—", "1,85%"],
                  ["FOSVOC (código 43)", "0,025%", "0,025%", "0,05%"],
                  ["FRL (Fondo de Reconversión Laboral)", "0,125%", "0,10%", "0,225%"],
                ]}
              />
            </section>

            <section id="caja-profesionales" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Si dirigís la obra como arquitecto
              </h3>
              <p className="text-sm text-slate-500">
                Sumá un 4% de Caja de Profesionales (2% si es obra de
                Ingeniería) — Ley 17.738. Es aparte del AUC, no lo reemplaza.
              </p>
            </section>

            <section id="total-referencia" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Total de referencia sobre jornal
              </h3>
              <p className="text-sm text-slate-700">
                AUC (71,8%) + FSC/FOCAP (1,85%) + FOSVOC (0,05%) + FRL
                (0,225%) ≈{" "}
                <span className="font-bold text-[#2563EB]">73,93%</span>
              </p>
            </section>

            <section id="ejemplo" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Ejemplo
              </h3>
              <p className="text-sm text-slate-500 mb-1">
                Medio Oficial Albañil (Categoría V), jornal $2.176,19:
              </p>
              <p className="text-sm text-slate-700">
                Costo real de mano de obra por jornada ≈ $2.176,19 × 1,7393 ≈{" "}
                <span className="font-bold text-[#2563EB]">$3.785,05</span>
              </p>
            </section>

            <section id="excluido-ley" className="scroll-mt-20">
              <div className="text-sm text-slate-600 space-y-2 mb-3">
                <p>
                  <strong className="text-slate-700">
                    Incluido en la Ley 14.411
                  </strong>{" "}
                  (todo lo de esta guía hasta acá): personal que trabaja
                  directamente en la obra — albañilería, sanitaria,
                  electricidad, pintura, acondicionamiento térmico, etc. Es
                  el régimen que aplica a prácticamente todo el personal de
                  obra.
                </p>
                <p>
                  <strong className="text-slate-700">
                    Excluido de la Ley 14.411
                  </strong>
                  : dueños de la empresa, socios, directores, personal
                  técnico (incluye arquitectos) y administrativo de oficina,
                  y obreros que no trabajan directamente en la obra. No es
                  una alternativa para calcular el costo de mano de obra de
                  una obra — es una categoría aparte (personal de
                  oficina/gerencia), rara vez relevante para presupuestar.
                </p>
              </div>
            </section>

            <section id="regimen-especial" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Régimen especial: pequeñas obras de mantenimiento
              </h3>
              <p className="text-sm text-slate-500">
                Para refacciones equivalentes a hasta 30 jornadas de medio
                oficial albañil, se puede optar por el régimen de industria
                y comercio en vez del AUC — con aportes de 15% personal +
                7,5% patronal + FONASA (4,5-6%) + FRL (0,1%), bastante menor
                al 71,8% del AUC.
              </p>
            </section>

            <section id="obra-publica" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                ¿Cambia para obra pública / licitaciones con el Estado?
              </h3>
              <p className="text-sm text-slate-500">
                No. El AUC y el resto de las leyes sociales son el mismo
                régimen nacional (Ley 14.411), sin importar si el cliente es
                un particular, una empresa privada o un organismo público —
                depende del tipo de actividad (construcción), no de quién
                contrata. Lo que sí puede variar en una licitación pública
                son otros aspectos (garantías, RUPE, retenciones, ajuste
                paramétrico) — ver guía aparte de Obra Pública
                (próximamente).
              </p>
            </section>

            <section id="actualizar-porcentajes" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Actualizar los porcentajes
              </h3>
              <p className="text-sm text-slate-500 mb-3">
                Los porcentajes de esta guía (AUC, FOCER, FSC/FOCAP, y el resto)
                no son fijos para siempre — cuando cambia la normativa, se
                editan dentro de cada proyecto, en{" "}
                <strong className="text-slate-700">
                  Presupuesto → Leyes Sociales/BPS
                </strong>
                . Ahí vas a ver dos tablas, &quot;Empresa paga&quot; y
                &quot;Propietario paga&quot;, con cada fila (AUC, FOCER
                patronal, FSC/FOCAP, FOSVOC, FRL, etc.) editable una por una.
                Apenas cambiás un valor, el total de esa tarjeta se actualiza
                al instante — es un cálculo en vivo.
              </p>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-800 mb-3">
                <span className="font-semibold">Ojo con esto:</span> ese cambio
                no le llega solo a los rubros que ya tenías cargados en el
                presupuesto. Cada rubro guarda, en el momento en que se crea o
                se vuelve a generar su Análisis de Precio Unitario, el
                porcentaje de Aportes Patronales vigente en ese momento — y lo
                mantiene así aunque después edites el porcentaje general. Solo
                los rubros que agregues <strong>después</strong> del cambio
                van a usar el porcentaje nuevo.
              </div>

              <p className="text-sm text-slate-500 mb-3">
                Es la misma lógica que ya usa Cómputo+ para Gastos Generales y
                Utilidad: un presupuesto que ya armaste (o que ya le entregaste
                a un cliente) no tiene que cambiar de precio solo porque en
                otro lado se actualizó una tasa. Si necesitás que un rubro
                puntual tome el porcentaje nuevo, hay que volver a generar su
                Análisis de Precio Unitario a mano.
              </p>

              <p className="text-sm text-slate-500 mb-2">
                Por este mismo motivo, vas a ver dos números que hablan de
                &quot;Aportes Patronales&quot; y que legítimamente pueden no
                coincidir exactamente:
              </p>
              <Tabla
                encabezados={["Dónde lo ves", "Cómo se calcula"]}
                filas={[
                  [
                    "Tarjeta Leyes Sociales/BPS",
                    "Siempre en vivo, sobre el Monto Imponible total del presupuesto",
                  ],
                  [
                    "Dentro de cada rubro (dentro de su precio unitario)",
                    "Congelado al crear o regenerar ese rubro puntual",
                  ],
                ]}
              />
              <p className="text-sm text-slate-500 mt-3">
                El primero sirve para controlar cuánto hay que declarar a BPS
                hoy. El segundo hace que el precio de cada rubro refleje su
                costo real de mano de obra en el momento en que se armó. No
                son el mismo número, y no hace falta que lo sean.
              </p>
            </section>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-10 pt-4 border-t border-slate-100">
          Valores de referencia (AUC vigente desde Decreto 341/018 de 2018).
          Verificar vigencia contra normativa BPS actualizada antes de
          aplicar a un presupuesto formal.
        </p>
      </div>
    </div>
  );
}
