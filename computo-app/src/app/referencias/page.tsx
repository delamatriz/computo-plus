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

// Marca inline de "todavía no construido" — mismo criterio de color que
// el badge ámbar "Requiere verificación" de /rubros, reusado acá para
// mantener el mismo lenguaje visual de "pendiente" en toda la app.
function Proximamente() {
  return <span className="text-amber-600 font-semibold">Próximamente</span>;
}

// Guía de Obra Pública — mismo patrón de sub-índice + scroll manual que
// /leyes-sociales (el click nativo en <a href="#id"> dentro de este
// layout con <main overflow-y-auto> saltaba al fondo de la página en vez
// de a la sección — se maneja el scroll a mano).
const seccionesObraPublica = [
  { id: "tipos-de-compra", label: "Tipos de compra" },
  { id: "garantias-obra-publica", label: "Garantías" },
  { id: "rupe", label: "RUPE" },
  { id: "ajuste-parametrico", label: "Ajuste paramétrico" },
];

function irASeccionObraPublica(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

function TablaObraPublica({ encabezados, filas }: { encabezados: string[]; filas: string[][] }) {
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
                    (j === 0 ? "text-slate-700" : "text-right font-medium text-slate-600 tabular-nums")
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

// Estructura del sistema — relevamiento real de qué existe hoy en
// producción (recorrido del Sidebar completo + el detalle de proyecto),
// confirmado antes de redactar. No es el roadmap: si algo todavía no
// está construido, se marca con <Proximamente /> en vez de omitirlo.
interface ItemEstructura {
  nombre: string;
  contenido: React.ReactNode;
}

const navPrincipal: ItemEstructura[] = [
  {
    nombre: "Mis Proyectos",
    contenido: <>La lista de todos tus proyectos, con acceso a cada uno.</>,
  },
  {
    nombre: "Metrajes",
    contenido: (
      <>
        Hoy te lleva directo a tu proyecto más reciente. La idea de tener
        acá una Biblioteca de Metrajes (consultar cómo se midió en obras
        anteriores) está <Proximamente />. Para medir un proyecto puntual
        hoy, entrá a ese proyecto y usá la pestaña Presupuesto.
      </>
    ),
  },
  {
    nombre: "Catálogo de Rubros",
    contenido: (
      <>
        El catálogo maestro con cientos de rubros ya armados, cada uno con
        su descompuesto completo (materiales, mano de obra, equipos). Es
        de consulta — sirve para ver cómo está armado un precio antes de
        usarlo en tu presupuesto.
      </>
    ),
  },
  {
    nombre: "Materiales",
    contenido: (
      <>
        Hoy tiene links a fuentes oficiales de precios (Lista MTOP, Índice
        ICCV del INE). El catálogo propio de materiales de Cómputo+ está{" "}
        <Proximamente />.
      </>
    ),
  },
  {
    nombre: "Mano de Obra",
    contenido: (
      <>
        Hoy tiene el link al Convenio SUNCA. El catálogo propio de
        categorías laborales y jornales está <Proximamente />.
      </>
    ),
  },
  {
    nombre: "Leyes Sociales",
    contenido: (
      <>
        Guía de referencia general: cuánto se aporta, por qué, con
        ejemplos de cálculo (AUC, BPS, fondos).{" "}
        <strong className="text-slate-700">Importante</strong>: esto es
        distinto de la calculadora de Leyes Sociales que tiene cada
        presupuesto — ver más abajo.
      </>
    ),
  },
  {
    nombre: "Configuración",
    contenido: (
      <>
        Los datos de tu empresa, las categorías laborales (jornales SUNCA)
        y algunos precios de referencia que podés ajustar vos mismo.
      </>
    ),
  },
  {
    nombre: "Biblioteca",
    contenido: (
      <>
        Hoy tiene el texto de las leyes puntuales más relevantes para
        presupuestar (tercerización, régimen de aportes, responsabilidad
        por defectos de construcción). Las guías y procedimientos propios
        de Cómputo+ están <Proximamente />.
      </>
    ),
  },
  {
    nombre: "Referencias",
    contenido: (
      <>
        Donde estás parado ahora: el glosario de términos de obra, y más
        adelante tutoriales y ejemplos de uso.
      </>
    ),
  },
  {
    nombre: "Sugerencias",
    contenido: (
      <>
        Pensado para que mandes ideas o reportes problemas. Todavía{" "}
        <Proximamente />.
      </>
    ),
  },
];

const dentroDePresupuesto: ItemEstructura[] = [
  {
    nombre: "Capítulos y rubros",
    contenido: <>El presupuesto en sí, la tabla que armás rubro por rubro.</>,
  },
  {
    nombre: "Documentación para metrar, Planilla de Cómputo, Calculadora y Visor de planos",
    contenido: (
      <>
        Acá subís los planos, los medís, y volcás las cantidades directo a
        tu presupuesto.
      </>
    ),
  },
  {
    nombre: "Leyes Sociales de este presupuesto",
    contenido: (
      <>
        A diferencia de la guía general del menú, esta calcula el aporte
        real sobre la mano de obra de este presupuesto puntual, con los
        números concretos de tu obra.
      </>
    ),
  },
  {
    nombre: "Resumen del presupuesto",
    contenido: <>Gastos generales y utilidad.</>,
  },
  {
    nombre: "Garantías",
    contenido: <>Fiel cumplimiento y afines.</>,
  },
  {
    nombre: "Certificaciones",
    contenido: <>Vas registrando el avance de obra, con fotos, mes a mes.</>,
  },
  {
    nombre: "Comparativo de ofertas",
    contenido: (
      <>Para comparar cotizaciones de distintos proveedores sobre un mismo rubro.</>
    ),
  },
  {
    nombre: "Detección de rubros faltantes",
    contenido: <>Te avisa si parece faltar algo en el presupuesto.</>,
  },
  {
    nombre: "Cronograma",
    contenido: <>Un Gantt armado a partir de tus capítulos y certificaciones.</>,
  },
  {
    nombre: "Memoria del presupuesto",
    contenido: <>Genera el texto de memoria descriptiva de la obra.</>,
  },
  {
    nombre: "Actualización de precios por índice ICCV",
    contenido: <>Para actualizar precios viejos con el índice del INE.</>,
  },
  {
    nombre: "Cómputo global de materiales",
    contenido: (
      <>
        La lista de materiales de todos los documentos del proyecto,
        juntada en un solo lugar.
      </>
    ),
  },
];

// Primer tutorial de la sección — el flujo principal end-to-end (crear
// proyecto → medir un plano → armar el presupuesto), el que conecta directo
// con el tagline "De la medición al presupuesto en minutos". Investigado
// navegando la app real (proyecto Matisse + un proyecto descartable para
// probar la confirmación real de "Aplicar al presupuesto" sin tocar datos
// reales) — nombres de botones y orden de pasos confirmados en pantalla,
// no de memoria.
interface PasoTutorial {
  numero: number;
  titulo: string;
  contenido: React.ReactNode;
}

const tutorialFlujoPrincipal: PasoTutorial[] = [
  {
    numero: 1,
    titulo: "Creá el proyecto",
    contenido: (
      <>
        Desde <strong className="text-slate-700">Mis Proyectos</strong>, hacé
        clic en <strong className="text-slate-700">+ Nuevo proyecto</strong>.
        Lo único que te pide para arrancar es el{" "}
        <strong className="text-slate-700">Nombre del proyecto</strong>. El
        resto —Tipo de obra, Cliente, RUT, dirección, fotos, documentos— lo
        podés completar ahora o después, desde{" "}
        <strong className="text-slate-700">Editar</strong>.
      </>
    ),
  },
  {
    numero: 2,
    titulo: "Subí el plano",
    contenido: (
      <>
        Ya dentro del proyecto, abrí la sección{" "}
        <strong className="text-slate-700">Documentación para metrar</strong>.
        Vas a ver tres bandejas:{" "}
        <strong className="text-slate-700">Planos y documentos</strong>,{" "}
        <strong className="text-slate-700">Fotos de relevamiento</strong> y{" "}
        <strong className="text-slate-700">Detalles</strong>. Subí tu plano en
        PDF con el botón <strong className="text-slate-700">Subir</strong> de
        la primera, y después hacé clic en{" "}
        <strong className="text-slate-700">
          Ir al visor y planilla de metraje
        </strong>
        .
      </>
    ),
  },
  {
    numero: 3,
    titulo: "Calibrá la escala",
    contenido: (
      <>
        Antes de poder medir, el plano necesita saber a qué escala está
        dibujado. Hacé clic en{" "}
        <strong className="text-slate-700">Calibrar escala</strong> (te va a
        decir <strong className="text-slate-700">Cambiar escala</strong> si ya
        la habías puesto antes) y escribí la escala tal como figura en el
        plano — por ejemplo <strong className="text-slate-700">1:100</strong>.
        Sin este paso, las herramientas de medir quedan bloqueadas.
      </>
    ),
  },
  {
    numero: 4,
    titulo: "Medí algo en el plano",
    contenido: (
      <>
        En la barra de herramientas del Visor tenés cinco opciones:{" "}
        <strong className="text-slate-700">Medir</strong>,{" "}
        <strong className="text-slate-700">Área</strong>,{" "}
        <strong className="text-slate-700">Trazo libre</strong>,{" "}
        <strong className="text-slate-700">Línea recta</strong> y{" "}
        <strong className="text-slate-700">Texto</strong> — una para cada tipo
        de medición o anotación que necesites. Para este ejemplo usamos{" "}
        <strong className="text-slate-700">Medir</strong>: hacés clic y
        arrastrás sobre el plano, de una punta a la otra de lo que querés
        medir (un muro, por ejemplo), y soltás. Se abre un cuadro{" "}
        <strong className="text-slate-700">Nueva medición</strong> con la
        longitud ya calculada —la podés corregir a mano si hace falta—, más
        los campos <strong className="text-slate-700">Descripción</strong> y{" "}
        <strong className="text-slate-700">Repeticiones</strong>. Guardás con{" "}
        <strong className="text-slate-700">Guardar</strong>.
      </>
    ),
  },
  {
    numero: 5,
    titulo: "La medida aparece sola en la Planilla",
    contenido: (
      <>
        Ni bien guardás, la fila aparece en la{" "}
        <strong className="text-slate-700">Planilla de Cómputo</strong>, con
        su largo, ancho, alto y subtotal según corresponda. No hay que hacer
        nada más para que llegue ahí.
      </>
    ),
  },
  {
    numero: 6,
    titulo: "Vinculala a un Rubro",
    contenido: (
      <>
        Cada fila de la planilla tiene una columna{" "}
        <strong className="text-slate-700">Rubro vinculado</strong>: es un
        desplegable con todos los rubros de tu presupuesto, agrupados por
        capítulo. Elegí el que corresponde a esa medición.
      </>
    ),
  },
  {
    numero: 7,
    titulo: "Aplicá al presupuesto",
    contenido: (
      <>
        <p>
          Con el botón{" "}
          <strong className="text-slate-700">Aplicar al presupuesto</strong>,
          arriba de la Planilla, Cómputo+ te muestra antes de nada un
          resumen: para cada rubro afectado, la cantidad que tiene hoy y la
          cantidad nueva que va a quedar.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-800">
          <span className="font-semibold">Ojo con esto:</span> el botón
          aplica <span className="font-semibold">todas</span> las filas
          vinculadas que tengas pendientes en el proyecto, no solo la que
          acabás de medir. Si venís acumulando mediciones de varios planos o
          de varios días, revisá bien el resumen antes de confirmar — se van
          a actualizar todos los rubros que aparezcan en esa lista, de una
          sola vez.
        </div>
      </>
    ),
  },
  {
    numero: 8,
    titulo: "Mirá el resultado en el presupuesto",
    contenido: (
      <>
        Confirmás, y el rubro queda con la cantidad que sacaste del plano.
        Como beneficio extra: Cómputo+ recuerda que esa cantidad vino de una
        medición (y no la escribiste a mano), así que si más adelante volvés
        a aplicar un cómputo sobre ese mismo rubro, te va a avisar antes de
        pisar un valor cargado manualmente.
      </>
    ),
  },
];

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

      <h2 id="glosario" className="text-lg font-bold text-[#1A3A5C] mb-3 scroll-mt-20">Glosario</h2>

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

      <div className="mt-12 pt-8 border-t border-slate-200">
        <h2 id="estructura-del-sistema" className="text-lg font-bold text-[#1A3A5C] mb-1 scroll-mt-20">
          Estructura del sistema
        </h2>
        <p className="text-sm text-slate-500 mb-6 max-w-2xl">
          Guía rápida para orientarte en Cómputo+: qué hay en el menú, y qué
          encontrás dentro de cada proyecto.
        </p>

        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">
          Navegación principal (menú de la izquierda)
        </h3>
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8">
          <dl className="space-y-3.5">
            {navPrincipal.map((item) => (
              <div key={item.nombre}>
                <dt className="text-sm font-semibold text-[#1E293B]">{item.nombre}</dt>
                <dd className="text-sm text-slate-600 leading-relaxed mt-0.5">{item.contenido}</dd>
              </div>
            ))}
          </dl>
        </div>

        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">
          Dentro de un proyecto
        </h3>
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-3">
          <p className="text-sm text-slate-600 leading-relaxed">
            Al entrar a un proyecto puntual hay tres pestañas:{" "}
            <strong className="text-slate-700">Presupuesto</strong>,{" "}
            <strong className="text-slate-700">Gestión de Obra</strong> y{" "}
            <strong className="text-slate-700">Certificación</strong>. Hoy
            casi todo vive en <strong className="text-slate-700">Presupuesto</strong> —
            Gestión de Obra y Certificación, como pestañas propias, todavía
            están <Proximamente />.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3.5">
            Dentro de Presupuesto encontrás, todo en una misma pantalla:
          </p>
          <dl className="space-y-3.5">
            {dentroDePresupuesto.map((item) => (
              <div key={item.nombre}>
                <dt className="text-sm font-semibold text-[#1E293B]">{item.nombre}</dt>
                <dd className="text-sm text-slate-600 leading-relaxed mt-0.5">{item.contenido}</dd>
              </div>
            ))}
          </dl>
        </div>

      </div>

      <div className="mt-12 pt-8 border-t border-slate-200">
        <h2
          id="tutorial-flujo-principal"
          className="text-lg font-bold text-[#1A3A5C] mb-1 scroll-mt-20"
        >
          De la medición al presupuesto, paso a paso
        </h2>
        <p className="text-sm text-slate-500 mb-6 max-w-2xl">
          El camino más corto entre un plano y un presupuesto: crear el
          proyecto, subir el plano, medirlo, y que esa medida llegue sola al
          rubro que corresponde.
        </p>

        <ol className="space-y-3">
          {tutorialFlujoPrincipal.map((paso) => (
            <li
              key={paso.numero}
              className="flex gap-4 bg-white rounded-xl border border-slate-200 p-5"
            >
              <div className="w-7 h-7 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center text-xs font-bold flex-shrink-0">
                {paso.numero}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-[#1E293B] mb-1.5">
                  {paso.titulo}
                </h4>
                <div className="text-sm text-slate-600 leading-relaxed">
                  {paso.contenido}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex items-start gap-3 bg-white rounded-xl border border-slate-200 p-5 mt-8">
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-[#2563EB]" />
          </div>
          <p className="text-sm text-slate-500">
            Este es el primer tutorial de esta sección. Más tutoriales y
            ejemplos de uso van a ir apareciendo en rondas futuras.
          </p>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-slate-200">
        <h2
          id="guia-obra-publica"
          className="text-lg font-bold text-[#1A3A5C] mb-1 scroll-mt-20"
        >
          Guía práctica para presupuestar Obra Pública
        </h2>
        <p className="text-sm text-slate-500 mb-6 max-w-2xl">
          Cuando el cliente es el Estado, las Leyes Sociales no cambian (mismo
          régimen que en obra privada), pero se suman exigencias propias de
          contratar con la Administración.
        </p>

        {/* Índice — mobile: pills horizontales, scrolleables, siempre
            visibles. Desktop: columna lateral fija. Mismo patrón que
            /leyes-sociales. */}
        <nav
          aria-label="Índice de la guía de Obra Pública"
          className="lg:hidden -mx-1 px-1 flex gap-2 overflow-x-auto pb-2 mb-8"
        >
          {seccionesObraPublica.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => irASeccionObraPublica(e, s.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-[#2563EB] transition-colors whitespace-nowrap"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="lg:flex lg:gap-10 lg:items-start">
          <aside className="hidden lg:block w-52 flex-shrink-0 sticky top-20 self-start">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 px-2 mb-2">
              En esta guía
            </p>
            <nav aria-label="Índice de la guía de Obra Pública" className="flex flex-col gap-0.5">
              {seccionesObraPublica.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => irASeccionObraPublica(e, s.id)}
                  className="px-2 py-1.5 rounded-[6px] text-sm text-slate-500 hover:text-[#2563EB] hover:bg-blue-50/50 transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="flex-1 min-w-0 space-y-10">
            <section id="tipos-de-compra" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Los tres tipos de compra, según el monto (2026)
              </h3>
              <TablaObraPublica
                encabezados={["Tipo de compra", "Hasta (UYU)"]}
                filas={[
                  ["Compra directa", "$654.000"],
                  ["Licitación abreviada", "$13.705.000"],
                  ["Licitación pública", "Por encima de ese monto"],
                ]}
              />
              <p className="text-sm text-slate-500 mt-3">
                Estos montos se actualizan una vez por año por IPC (INE, fin
                de diciembre).
              </p>
            </section>

            <section id="garantias-obra-publica" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Garantías
              </h3>
              <p className="text-sm text-slate-500 mb-1">
                Depósitos (efectivo, fianza o aval bancario) que respaldan tu
                compromiso durante el proceso.
              </p>
              <TablaObraPublica
                encabezados={["Garantía", "Cuándo se exige", "Monto"]}
                filas={[
                  ["Mantenimiento de oferta", "Obras por encima de $13.705.000", "Lo determina la Administración en el pliego"],
                  ["Fiel cumplimiento del contrato", "Adjudicaciones por encima de $5.482.000", "5% del monto adjudicado"],
                ]}
              />
              <p className="text-sm text-slate-500 mt-3">
                Si no constituís la garantía de mantenimiento de oferta y
                desistís de tu oferta, la multa es del 5% del monto máximo
                ofertado. Cada pliego puede establecer condiciones distintas —
                siempre hay que revisarlo.
              </p>
            </section>

            <section id="rupe" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                RUPE — Registro Único de Proveedores del Estado
              </h3>
              <p className="text-sm text-slate-500 mb-2">
                Trámite obligatorio para ofertar en licitaciones o compras
                directas por encima del tope de compra directa.
              </p>
              <ul className="text-sm text-slate-500 list-disc list-inside space-y-1">
                <li>Trámite online, gratuito</li>
                <li>Demora entre 24 y 72 horas hábiles</li>
                <li>Se hace una sola vez, después hay que mantener los datos actualizados</li>
                <li>Excepciones: compras muy chicas con &quot;Caja Chica&quot;, y casos exceptuados por la ACCE</li>
              </ul>
            </section>

            <section id="ajuste-parametrico" className="scroll-mt-20">
              <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                Ajuste paramétrico
              </h3>
              <p className="text-sm text-slate-500 mb-2">
                En obras largas, el Estado reconoce que los precios suben — el
                ajuste paramétrico actualiza lo certificado según la variación
                real de jornales, materiales y costo de vida, usando índices
                del MTOP.
              </p>
              <p className="text-sm text-slate-500">
                La fórmula exacta la define cada pliego particular, no es un
                número único — revisá la fórmula específica de cada llamado
                antes de presupuestar.
              </p>
            </section>

            <p className="text-xs text-slate-400 pt-2">
              Valores de referencia (montos y garantías vigentes para 2026,
              según artículos 64 y 66 del TOCAF). Verificar montos
              actualizados en comprasestatales.gub.uy antes de presupuestar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
