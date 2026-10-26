"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListaReferencias, type ReferenciaLink } from "@/components/ListaReferencias";
import { BotonVolverAlProyecto } from "@/components/shared/BotonVolverAlProyecto";
import {
  AUC_PCT_DEFAULT,
  AUC_PCT_JUBILATORIO_PATRONAL,
  AUC_PCT_JUBILATORIO_PERSONAL,
  AUC_PCT_CARGAS_SALARIALES,
  AUC_PCT_FONASA_PATRONAL,
  AUC_PCT_FONASA_PERSONAL,
  AUC_PCT_BSE,
} from "@/lib/auc";
import {
  FONDOS_PATRONALES,
  APORTES_PATRONALES_PCT_LEGAL_DEFAULT,
  FOCER_PERSONAL_PCT,
  FOCER_PATRONAL_PCT_REDUCIDO,
  SNIS_ADICIONAL_PERSONAL_PCT,
} from "@/lib/aportesPatronales";
import { CAJA_PROFESIONALES_PCT } from "@/lib/cajaProfesionales";

// Los porcentajes de los aportes patronales salen de aportesPatronales.ts
// (única fuente, la misma que usan los rubros nuevos y la tarjeta Leyes
// Sociales/BPS): la guía nunca vuelve a tener su propia copia de los números.
const fmtPct = (pct: number) =>
  pct.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const fmtMonto = (n: number) =>
  n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// El ejemplo usa el jornal vigente de Medio Oficial Albañil (Categoría V),
// leído de CategoriaLaboral como el resto de la app — nunca un número fijo:
// quedaba viejo con cada convenio.
const CODIGO_JORNAL_EJEMPLO = "sunca_cat_v";
const AUC_PCT_PUNTOS = AUC_PCT_DEFAULT * 100;
// Total de referencia sobre el jornal: AUC (lo paga el propietario) + los
// aportes patronales (los paga la empresa).
const TOTAL_REFERENCIA_PCT = AUC_PCT_PUNTOS + APORTES_PATRONALES_PCT_LEGAL_DEFAULT;
// FOCER patronal por defecto (5%), de la misma lista que suma los aportes.
const FOCER_PATRONAL_PCT = FONDOS_PATRONALES.find((f) => f.campo === "focerPatronalPct")!.pct;
const CAJA_ARQ = fmtPct(CAJA_PROFESIONALES_PCT.ARQUITECTURA);
const CAJA_ING = fmtPct(CAJA_PROFESIONALES_PCT.INGENIERIA);

// Info general de BPS (no el texto de una ley puntual) — base de esta
// sección práctica.
const referencias: ReferenciaLink[] = [
  {
    titulo: "Leyes Sociales — BPS",
    descripcion: "Aportes patronales y personales de la construcción",
    url: "https://www.bps.gub.uy/837/regimen-construccion.html",
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
  { id: "quien-paga", label: "Quién paga qué" },
  { id: "auc", label: "AUC" },
  { id: "fondos-adicionales", label: "Aportes patronales" },
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
  // null mientras carga o si no se pudo leer: el ejemplo muestra "—".
  const [jornalEjemplo, setJornalEjemplo] = useState<number | null>(null);
  useEffect(() => {
    let cancelado = false;
    fetch("/api/categorias-laborales")
      .then((r) => (r.ok ? r.json() : []))
      .then((cats: { categoria: string; jornal: number }[]) => {
        const c = Array.isArray(cats) ? cats.find((x) => x.categoria === CODIGO_JORNAL_EJEMPLO) : undefined;
        if (!cancelado && c) setJornalEjemplo(c.jornal);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);
  // Se separa lo que entra al APU del rubro (jornal + aportes patronales) de lo
  // que paga el propietario aparte (AUC): si no, el ejemplo no se parece en
  // nada a la mano de obra que el usuario ve en su APU.
  const enApuEjemplo = jornalEjemplo != null ? jornalEjemplo * (1 + APORTES_PATRONALES_PCT_LEGAL_DEFAULT / 100) : null;
  const aucEjemplo = jornalEjemplo != null ? jornalEjemplo * AUC_PCT_DEFAULT : null;
  const costoRealEjemplo = jornalEjemplo != null ? jornalEjemplo * (1 + TOTAL_REFERENCIA_PCT / 100) : null;
  const montoEjemplo = (n: number | null) => (n != null ? `$${fmtMonto(n)}` : "—");

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <BotonVolverAlProyecto />
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Leyes Sociales
      </h1>
      <p className="text-slate-500 mb-8">
        Referencia general de aportes al BPS (Banco de Previsión Social), el AUC
        (Aporte Unificado de la Construcción) y los fondos de la industria de la
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
            trabajador — por ejemplo, {montoEjemplo(jornalEjemplo)} para un
            Medio Oficial Albañil (Categoría V). El laudo (o convenio SUNCA — Sindicato Único Nacional de la Construcción y Anexos) es la tabla completa con
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
            <section id="quien-paga" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Quién paga qué
              </h3>
              <Tabla
                encabezados={["Aporte", "Quién lo paga y dónde entra"]}
                filas={[
                  [
                    `AUC (${fmtPct(AUC_PCT_PUNTOS)}%)`,
                    "Lo paga el propietario directamente al BPS. Va aparte, después del Precio Final: no entra al precio de ningún rubro",
                  ],
                  [
                    `Caja de Profesionales (${CAJA_ARQ}% arquitectura / ${CAJA_ING}% ingeniería)`,
                    "La paga el propietario y se recauda junto con el AUC, sobre el mismo monto imponible. En Cómputo+ es solo informativa: no entra a ningún precio",
                  ],
                  [
                    "Aportes patronales (FOCER — Fondo de Cesantía y Retiro, FSC — Fondo Social de la Construcción / FOCAP — Fondo de Capacitación, FOSVOC — Fondo Social de Vivienda Obrera de la Construcción, FRL — Fondo de Reconversión Laboral, Fondo de Garantía de Créditos Laborales)",
                    "Los paga la empresa. Van dentro del costo de la mano de obra de cada rubro, como un % solo sobre la mano de obra",
                  ],
                  [
                    `Aportes personales (FOCER personal ${fmtPct(FOCER_PERSONAL_PCT)}%, SNIS — Sistema Nacional Integrado de Salud — adicional)`,
                    "Los paga el trabajador: se le descuentan del jornal. No son un costo de la empresa y no entran al precio (se muestran como informativos)",
                  ],
                ]}
              />
            </section>

            <section id="auc" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                AUC (Aporte Unificado de la Construcción) — el aporte
                principal
              </h3>
              <p className="text-sm text-slate-500 mb-2">
                Lo paga el propietario directamente al BPS.
              </p>
              <p className="text-sm font-semibold text-slate-700 mb-1">
                Total: {fmtPct(AUC_PCT_PUNTOS)}% sobre el jornal.
              </p>
              <Tabla
                encabezados={["Concepto", "%"]}
                filas={[
                  ["Jubilatorio — patronal", `${fmtPct(AUC_PCT_JUBILATORIO_PATRONAL * 100)}%`],
                  ["Jubilatorio — personal", `${fmtPct(AUC_PCT_JUBILATORIO_PERSONAL * 100)}%`],
                  ["Cargas salariales (aguinaldo, licencia, salario vacacional)", `${fmtPct(AUC_PCT_CARGAS_SALARIALES * 100)}%`],
                  ["Salud (SNIS) — patronal", `${fmtPct(AUC_PCT_FONASA_PATRONAL * 100)}%`],
                  ["Salud (SNIS) — personal", `${fmtPct(AUC_PCT_FONASA_PERSONAL * 100)}%`],
                  ["BSE (Banco de Seguros del Estado) — accidentes de trabajo", `${fmtPct(AUC_PCT_BSE * 100)}%`],
                ]}
              />
              <p className="text-sm text-slate-500 mt-3">
                Es tan alto porque el BPS liquida directamente aguinaldo,
                licencia y salario vacacional en este régimen.
              </p>
            </section>

            <section id="fondos-adicionales" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Aportes patronales (fondos que paga la empresa)
              </h3>
              <p className="text-sm text-slate-500 mb-1">
                Los paga la empresa, no el propietario. Se calculan sobre la
                mano de obra y van dentro del precio de cada rubro: es un solo
                porcentaje para todas las categorías, no varía según
                categoría ni convenio.
              </p>
              <Tabla
                encabezados={["Fondo", "Código BPS", "% sobre la mano de obra"]}
                filas={[
                  ...FONDOS_PATRONALES.map((f) => [
                    f.nombre,
                    f.codigoBPS,
                    `${fmtPct(f.pct)}%`,
                  ]),
                  ["Total aportes patronales", "", `${fmtPct(APORTES_PATRONALES_PCT_LEGAL_DEFAULT)}%`],
                ]}
              />
              <p className="text-sm text-slate-500 mt-3">
                <strong className="text-slate-700">FOCER patronal:</strong>{" "}
                es {fmtPct(FOCER_PATRONAL_PCT)}% por defecto y corresponde{" "}
                {fmtPct(FOCER_PATRONAL_PCT_REDUCIDO)}% si el trabajador tiene
                derecho a indemnización por despido y la empresa lo declara
                (declaración jurada) — Ley 18.236, art. 16. La tabla usa el{" "}
                {fmtPct(FOCER_PATRONAL_PCT)}%; si en la obra corresponde el{" "}
                {fmtPct(FOCER_PATRONAL_PCT_REDUCIDO)}%, se edita en
                Presupuesto → Leyes Sociales/BPS. Ojo: al cambiarlo, los
                rubros ya creados no se modifican (cada uno guarda el % con el
                que se creó); para actualizarlos usá el botón{" "}
                <strong className="text-slate-700">
                  &quot;Aplicar aportes patronales a rubros existentes&quot;
                </strong>{" "}
                de esa misma tarjeta, que muestra una vista previa antes de
                aplicar.
              </p>
              <p className="text-sm text-slate-500 mt-2">
                <strong className="text-slate-700">SNIS adicional:</strong>{" "}
                no es un aporte patronal sino un aporte{" "}
                <strong className="text-slate-700">personal</strong> variable
                del trabajador ({fmtPct(SNIS_ADICIONAL_PERSONAL_PCT)}% de referencia): por eso no entra en la
                tabla ni en el precio del rubro.
              </p>
              <p className="text-sm text-slate-500 mt-2">
                <strong className="text-slate-700">El 7,5%:</strong> es el
                aporte jubilatorio patronal que se paga solo sobre las
                partidas (alimentación, salud, seguros, transporte); no
                integra el AUC y no es una carga fija sobre el jornal, así
                que no está en la tabla.
              </p>
              <p className="text-sm text-slate-500 mt-2">
                <strong className="text-slate-700">
                  Complemento de Cuota Mutual (CCM):
                </strong>{" "}
                depende de los beneficiarios de cada trabajador; Cómputo+ no
                lo modela.
              </p>
            </section>

            <section id="caja-profesionales" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Caja de Profesionales
              </h3>
              <p className="text-sm text-slate-500">
                {CAJA_ARQ}% del monto imponible en obras de arquitectura ({CAJA_ING}% en
                ingeniería) — Ley 17.738. Se recauda junto con el AUC y es
                aparte de él, no lo reemplaza. En la tarjeta Leyes
                Sociales/BPS la elegís (Arquitectura / Ingeniería / No aplica;
                por defecto Arquitectura) y se muestra también en el PDF
                junto al AUC, como línea informativa: no entra al precio de
                ningún rubro ni al Precio Final.
              </p>
            </section>

            <section id="total-referencia" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Total de referencia sobre jornal
              </h3>
              <p className="text-sm text-slate-700">
                AUC ({fmtPct(AUC_PCT_PUNTOS)}%, lo paga el propietario) + aportes
                patronales ({fmtPct(APORTES_PATRONALES_PCT_LEGAL_DEFAULT)}%, los
                paga la empresa) ≈{" "}
                <span className="font-bold text-[#2563EB]">{fmtPct(TOTAL_REFERENCIA_PCT)}%</span>
              </p>
            </section>

            <section id="ejemplo" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Ejemplo
              </h3>
              <p className="text-sm text-slate-500 mb-2">
                Medio Oficial Albañil (Categoría V), jornal vigente {montoEjemplo(jornalEjemplo)}:
              </p>
              <ul className="text-sm text-slate-700 space-y-1.5">
                <li>
                  <strong>Lo que entra al APU (Análisis de Precio Unitario) del rubro:</strong> jornal × aportes patronales (
                  {fmtPct(APORTES_PATRONALES_PCT_LEGAL_DEFAULT)}%) = {montoEjemplo(jornalEjemplo)} ×{" "}
                  {(1 + APORTES_PATRONALES_PCT_LEGAL_DEFAULT / 100).toLocaleString("es-UY", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ≈{" "}
                  <span className="font-bold text-[#2563EB]">{montoEjemplo(enApuEjemplo)}</span>
                </li>
                <li>
                  <strong>Lo que paga el propietario aparte, fuera del Precio Final:</strong> AUC (
                  {fmtPct(AUC_PCT_PUNTOS)}%) ≈ {montoEjemplo(aucEjemplo)}
                </li>
                <li className="text-slate-500">
                  Costo total de la jornada, sumando las dos partes ≈ {montoEjemplo(jornalEjemplo)} ×{" "}
                  {(1 + TOTAL_REFERENCIA_PCT / 100).toLocaleString("es-UY", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ≈{" "}
                  {montoEjemplo(costoRealEjemplo)}
                </li>
              </ul>
              <p className="text-sm text-slate-500 mt-3">
                Si comparás este ejemplo con el APU de un rubro, los números no van a coincidir: en el APU
                solo está la primera parte (jornal + aportes patronales). El AUC no entra al APU — lo paga el
                propietario directamente al BPS y se muestra aparte, después del Precio Final.
              </p>
              <p className="text-sm text-slate-500 mt-2">
                El precio unitario del rubro suma además la Utilidad sobre el costo directo — por eso el precio
                unitario del rubro va a ser mayor que estos valores.
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
                7,5% patronal + FONASA (Fondo Nacional de Salud, 4,5-6%) + FRL (0,1%), bastante menor
                al {fmtPct(AUC_PCT_PUNTOS)}% del AUC.
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
                son otros aspectos (garantías, RUPE — Registro Único de Proveedores del Estado —, retenciones, ajuste
                paramétrico) — ver la{" "}
                <Link href="/referencias#guia-obra-publica" className="font-medium text-[#2563EB] hover:underline">
                  guía de Obra Pública
                </Link>
                .
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
                . Ahí vas a ver las tablas &quot;Empresa paga&quot; y
                &quot;Propietario paga&quot;, y la retención personal, con cada
                fila (AUC, FOCER patronal, FSC/FOCAP, FOSVOC, FRL, etc.)
                editable una por una.
                Apenas cambiás un valor, el total de esa tarjeta se actualiza
                al instante — es un cálculo en vivo.
              </p>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-800 mb-3">
                <span className="font-semibold">Ojo con esto:</span> ese cambio
                no le llega solo a los rubros que ya tenías cargados en el
                presupuesto. Cada rubro guarda, en el momento en que se crea o
                se vuelve a generar su Análisis de Precio Unitario, el
                porcentaje de Aportes Patronales vigente en ese momento — y lo
                mantiene así aunque después edites el porcentaje general. Los
                rubros que agregues <strong>después</strong> del cambio usan el
                porcentaje nuevo; para los que ya estaban, usá el botón que se
                explica abajo.
              </div>

              <p className="text-sm text-slate-500 mb-3">
                Es la misma lógica que ya usa Cómputo+ para Gastos Generales y
                Utilidad: un presupuesto que ya armaste (o que ya le entregaste
                a un cliente) no tiene que cambiar de precio solo porque en
                otro lado se actualizó una tasa. Si necesitás que los rubros ya
                cargados tomen el porcentaje nuevo, usá el botón{" "}
                <strong className="text-slate-700">
                  &quot;Aplicar aportes patronales a rubros existentes&quot;
                </strong>{" "}
                de la tarjeta Leyes Sociales/BPS del proyecto: muestra una vista
                previa antes de aplicar y no toca los rubros con precio
                congelado ni los proyectos finalizados.
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
                    "Congelado al crear o regenerar ese rubro, o al usar \"Aplicar aportes patronales a rubros existentes\"",
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
