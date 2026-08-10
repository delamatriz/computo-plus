"use client";

import { useMemo, useState } from "react";
import { Search, FileText } from "lucide-react";

// Glosario — migrado tal cual del contenido de dominio aprobado (sección
// "Términos en código → UI" queda afuera a propósito, es jerga de
// desarrollo sin valor para el usuario final). Solo formato Markdown →
// JSX, sin reformular contenido.
interface Termino {
  nombre: string;
  contenido: React.ReactNode;
}

interface CategoriaGlosario {
  nombre: string;
  terminos: Termino[];
}

const glosario: CategoriaGlosario[] = [
  {
    nombre: "Estructura de un Presupuesto",
    terminos: [
      {
        nombre: "Proyecto",
        contenido: (
          <p>La obra completa. Puede tener múltiples versiones de presupuesto.</p>
        ),
      },
      {
        nombre: "Presupuesto",
        contenido: (
          <p>
            Documento formal que estima el costo total de una obra. Puede
            tener versiones (Presupuesto Rev.0, Rev.1, etc.).
          </p>
        ),
      },
      {
        nombre: "Rubro",
        contenido: (
          <>
            <p>Agrupación mayor de trabajo dentro de un presupuesto. Ejemplos:</p>
            <ul className="list-disc pl-5 mt-1.5 space-y-0.5 text-slate-500">
              <li>Rubro 1: Movimiento de tierras</li>
              <li>Rubro 2: Estructura</li>
              <li>Rubro 3: Mampostería</li>
              <li>Rubro 4: Instalaciones sanitarias</li>
              <li>Rubro 5: Terminaciones</li>
            </ul>
          </>
        ),
      },
      {
        nombre: "Partida",
        contenido: (
          <>
            <p>
              Ítem de trabajo dentro de un rubro. Tiene: descripción, unidad
              de medida, cantidad (del cómputo métrico), precio unitario
              (del APU), y precio total.
            </p>
            <p className="mt-1.5 text-slate-400 italic">
              Ejemplo: Hormigón H-25 en losa — m³ — 45,20 m³ — $8.500/m³ —
              $383.700
            </p>
          </>
        ),
      },
      {
        nombre: "Ítem",
        contenido: (
          <p>
            Sinónimo de Partida en algunos contextos. En Cómputo+, usar
            Partida como término principal.
          </p>
        ),
      },
    ],
  },
  {
    nombre: "Cómputo Métrico",
    terminos: [
      {
        nombre: "Cómputo Métrico (o Cómputo)",
        contenido: (
          <>
            <p>
              Proceso de medición y cuantificación de los trabajos a
              realizar, a partir de los planos de arquitectura e
              ingeniería. Determina las cantidades de cada partida.
            </p>
            <p className="mt-1.5 text-slate-400">
              También llamado: cubicación, mediciones, cómputo de obra.
            </p>
          </>
        ),
      },
      {
        nombre: "Cubicación",
        contenido: (
          <p>
            Proceso de calcular volúmenes. En Uruguay se usa como sinónimo
            parcial de cómputo métrico, aunque técnicamente refiere solo a
            volúmenes.
          </p>
        ),
      },
      {
        nombre: "Planilla de Cómputo",
        contenido: (
          <>
            <p>
              Documento/tabla donde se registran las mediciones detalladas
              por partida. Incluye: descripción del elemento medido,
              dimensiones parciales, subtotales y total.
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Formato típico — Partida: Hormigón en columnas
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 mt-1.5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {["Elemento", "L", "A", "H", "Cant.", "Subtotal"].map((h, i) => (
                      <th
                        key={h}
                        className={
                          "px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide " +
                          (i === 0 ? "text-left" : "text-right")
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 border-t border-slate-100 text-slate-700">Col. eje A (x4)</td>
                    <td className="px-3 py-2 border-t border-slate-100 text-right text-slate-500">—</td>
                    <td className="px-3 py-2 border-t border-slate-100 text-right text-slate-500">0.30</td>
                    <td className="px-3 py-2 border-t border-slate-100 text-right text-slate-500">0.30</td>
                    <td className="px-3 py-2 border-t border-slate-100 text-right text-slate-500">3.00</td>
                    <td className="px-3 py-2 border-t border-slate-100 text-right font-medium text-slate-600">1.08 m³</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="px-3 py-2 border-t border-slate-100 text-slate-700">Col. eje B (x6)</td>
                    <td className="px-3 py-2 border-t border-slate-100 text-right text-slate-500">—</td>
                    <td className="px-3 py-2 border-t border-slate-100 text-right text-slate-500">0.25</td>
                    <td className="px-3 py-2 border-t border-slate-100 text-right text-slate-500">0.25</td>
                    <td className="px-3 py-2 border-t border-slate-100 text-right text-slate-500">2.80</td>
                    <td className="px-3 py-2 border-t border-slate-100 text-right font-medium text-slate-600">1.05 m³</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border-t border-slate-200 font-bold text-[#1A3A5C]">TOTAL</td>
                    <td className="px-3 py-2 border-t border-slate-200" />
                    <td className="px-3 py-2 border-t border-slate-200" />
                    <td className="px-3 py-2 border-t border-slate-200" />
                    <td className="px-3 py-2 border-t border-slate-200" />
                    <td className="px-3 py-2 border-t border-slate-200 text-right font-bold text-[#2563EB]">2.13 m³</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ),
      },
      {
        nombre: "Replanteo",
        contenido: (
          <p>
            Transposición de las medidas del plano a la realidad física de
            la obra. En el contexto de software, puede referir a la
            verificación de medidas vs. planos.
          </p>
        ),
      },
    ],
  },
  {
    nombre: "Análisis de Precios",
    terminos: [
      {
        nombre: "APU (Análisis de Precio Unitario)",
        contenido: (
          <>
            <p>
              Desglose detallado del costo de una unidad de una partida.
              Compuesto por:
            </p>
            <ul className="list-disc pl-5 mt-1.5 space-y-0.5 text-slate-500">
              <li>Materiales (con rendimiento y precio unitario)</li>
              <li>Mano de obra (con categoría y rendimiento)</li>
              <li>Equipos/herramientas (con costo de uso)</li>
              <li>Gastos generales (porcentaje)</li>
              <li>Beneficio/utilidad (porcentaje)</li>
            </ul>
            <p className="mt-1.5">El APU determina el precio unitario de la partida.</p>
          </>
        ),
      },
      {
        nombre: "Insumo",
        contenido: (
          <>
            <p>Componente del APU. Puede ser:</p>
            <ul className="list-disc pl-5 mt-1.5 space-y-0.5 text-slate-500">
              <li><span className="font-medium text-slate-600">Material:</span> hormigón, ladrillo, pintura, etc.</li>
              <li><span className="font-medium text-slate-600">Mano de obra:</span> oficial, peón, electricista, etc.</li>
              <li><span className="font-medium text-slate-600">Equipo:</span> hormigonera, andamio, retroexcavadora, etc.</li>
            </ul>
          </>
        ),
      },
      {
        nombre: "Rendimiento",
        contenido: (
          <p>
            Cantidad de insumo necesaria por unidad de partida. Ej: 0.35 m³
            de hormigón por m³ de columna (considerando pérdidas).
          </p>
        ),
      },
      {
        nombre: "Leyes sociales",
        contenido: (
          <p>
            Cargas sociales sobre la mano de obra en Uruguay. Porcentaje que
            se agrega al costo de MO. Varía según categoría y convenio.
          </p>
        ),
      },
    ],
  },
  {
    nombre: "Precios de Referencia Uruguay",
    terminos: [
      {
        nombre: "Precios INE",
        contenido: (
          <p>
            Índices y precios de referencia publicados por el Instituto
            Nacional de Estadística de Uruguay. Usados para actualizar
            presupuestos y ajustar contratos.
          </p>
        ),
      },
      {
        nombre: "Índice de la Construcción (INE)",
        contenido: (
          <p>
            Índice publicado mensualmente por el INE que refleja la
            variación de costos de la construcción en Uruguay. Base para la
            actualización de contratos de obra.
          </p>
        ),
      },
      {
        nombre: "SUNCA",
        contenido: (
          <>
            <p>
              Sindicato Único Nacional de la Construcción y Anexos. Define
              las categorías de mano de obra y los jornales de referencia.
            </p>
            <p className="mt-1.5 text-slate-500">
              Categorías de MO más comunes: Peón, Medio oficial, Oficial,
              Oficial especializado, Capataz
            </p>
          </>
        ),
      },
      {
        nombre: "Cámara de la Construcción (CCOU)",
        contenido: (
          <p>
            Cámara de la Construcción del Uruguay. Publica precios de
            referencia de materiales.
          </p>
        ),
      },
    ],
  },
  {
    nombre: "Documentación de Obra",
    terminos: [
      {
        nombre: "Memoria Descriptiva",
        contenido: (
          <p>
            Documento textual que acompaña al presupuesto y describe los
            materiales, técnicas y especificaciones de cada rubro.
          </p>
        ),
      },
      {
        nombre: "Pliego de Condiciones",
        contenido: (
          <p>
            Documento que establece las condiciones contractuales, técnicas
            y administrativas de la obra.
          </p>
        ),
      },
      {
        nombre: "Certificado de Obra",
        contenido: (
          <p>
            Documento periódico (generalmente mensual) que certifica el
            avance de la obra y habilita el cobro al contratista.
          </p>
        ),
      },
    ],
  },
  {
    nombre: "Unidades de medida comunes",
    terminos: [
      {
        nombre: "Unidades de medida comunes",
        contenido: (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  {["Abreviatura", "Unidad", "Uso típico"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["m²", "metro cuadrado", "superficies (losas, muros, pisos)"],
                  ["m³", "metro cúbico", "volúmenes (hormigón, excavación)"],
                  ["ml", "metro lineal", "elementos lineales (vigas, cañerías)"],
                  ["kg", "kilogramo", "hierro, acero"],
                  ["tn", "tonelada", "áridos, materiales a granel"],
                  ["gl", "global", "trabajos que no se miden por unidad"],
                  ["u", "unidad", "puertas, ventanas, artefactos"],
                  ["jornada", "jornada laboral", "mano de obra"],
                ].map((fila, i) => (
                  <tr key={fila[0]} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                    <td className="px-4 py-2 border-t border-slate-100 font-medium text-slate-700">{fila[0]}</td>
                    <td className="px-4 py-2 border-t border-slate-100 text-slate-600">{fila[1]}</td>
                    <td className="px-4 py-2 border-t border-slate-100 text-slate-500">{fila[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      },
    ],
  },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function ReferenciasPage() {
  const [filtro, setFiltro] = useState("");

  const glosarioFiltrado = useMemo(() => {
    const q = norm(filtro.trim());
    if (!q) return glosario;
    return glosario
      .map((cat) => ({
        ...cat,
        terminos: cat.terminos.filter((t) => norm(t.nombre).includes(q)),
      }))
      .filter((cat) => cat.terminos.length > 0);
  }, [filtro]);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Referencias
      </h1>
      <p className="text-slate-500 mb-8">
        Documentación propia del sistema — tutoriales, glosario, ejemplos.
      </p>

      <h2 className="text-lg font-bold text-[#1A3A5C] mb-3">Glosario</h2>

      <div className="relative mb-6">
        <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar un término…"
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 focus:border-[#2563EB]/40 placeholder:text-slate-300"
        />
      </div>

      {glosarioFiltrado.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">
          Ningún término coincide con &quot;{filtro}&quot;
        </p>
      ) : (
        <div className="space-y-8">
          {glosarioFiltrado.map((cat) => (
            <div key={cat.nombre}>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">
                {cat.nombre}
              </h3>
              <div className="space-y-3">
                {cat.terminos.map((t) => (
                  <div
                    key={t.nombre}
                    className="bg-white rounded-xl border border-slate-200 p-5"
                  >
                    {cat.nombre !== "Unidades de medida comunes" && (
                      <h4 className="text-sm font-semibold text-[#1E293B] mb-1.5">
                        {t.nombre}
                      </h4>
                    )}
                    <div className="text-sm text-slate-600 leading-relaxed">
                      {t.contenido}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center justify-center text-center bg-white rounded-xl border border-slate-200 py-16 px-6 mt-10">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <FileText className="w-5 h-5 text-[#2563EB]" />
        </div>
        <h2 className="text-sm font-semibold text-[#1E293B] mb-1">
          Próximamente
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Acá vas a encontrar también tutoriales y ejemplos de uso de
          Cómputo+.
        </p>
      </div>
    </div>
  );
}
