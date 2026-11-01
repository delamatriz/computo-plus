import { Info } from "lucide-react";
import { db } from "@/lib/db";
import { formatearFechaUTC, periodoConvenio } from "@/lib/convenioSunca";
import SeccionCategoriasLaborales from "@/components/mano-de-obra/SeccionCategoriasLaborales";
import SeccionConvenioFirmado from "@/components/mano-de-obra/SeccionConvenioFirmado";
import { BotonVolverAlProyecto } from "@/components/shared/BotonVolverAlProyecto";

// Jornales sourced en vivo desde CategoriaLaboral — nunca cachear como
// contenido estático, si no una actualización de convenio no se reflejaría
// acá hasta el próximo build. Hoy el convenio se actualiza desde esta misma
// página, con la extracción con IA del SUPERADMIN (SeccionCategoriasLaborales);
// el script de carga inicial 2026 quedó en scripts/_historico/.
export const dynamic = "force-dynamic";

// Las 12 categorías oficiales del laudo, en orden — se muestran estas (no
// las 25 filas crudas de CategoriaLaboral, que tienen alias/duplicados por
// diseño: "Capataz" existe dos veces con el mismo jornal, por ejemplo).
const CATEGORIAS_LAUDO = [
  { categoria: "sunca_cat_i", numero: "I" },
  { categoria: "sunca_cat_ii", numero: "II" },
  { categoria: "sunca_cat_iii", numero: "III" },
  { categoria: "sunca_cat_iv", numero: "IV" },
  { categoria: "sunca_cat_v", numero: "V" },
  { categoria: "sunca_cat_vi", numero: "VI" },
  { categoria: "sunca_cat_vii", numero: "VII" },
  { categoria: "sunca_cat_viii", numero: "VIII" },
  { categoria: "sunca_cat_ix", numero: "IX" },
  { categoria: "sunca_cat_x", numero: "X" },
  { categoria: "sunca_cat_xi", numero: "XI" },
  { categoria: "sunca_cat_xii", numero: "XII" },
];

// Oficios propios de la app, nivelados a una categoría fija del laudo —
// listados aparte porque se buscan por nombre de oficio, no por número
// romano (ver rubroCompatibleConFila). La nivelación la aplica la
// actualización con IA de esta página (ROMANO_A_CODIGOS_NIVELADOS en
// SeccionCategoriasLaborales); la carga inicial 2026 la hizo
// scripts/_historico/seed-jornales-sunca-2026.ts.
const OFICIOS_ESPECIALIZADOS = [
  "electricista_oficial",
  "oficial_gasista",
  "plomero_oficial",
  "pintor_oficial",
  "oficial_maquinista",
  "oficial_escalerista",
];

// Resto de CategoriaLaboral que también se usa al armar un APU (trabajo en
// altura, vigilancia, dirección de obra) y no entra en las tablas de arriba.
// Los alias de nombre común ("Peón", "Oficial albañil", "Capataz"…) no se
// listan: repiten el mismo jornal de su categoría del laudo.
const OTRAS_CATEGORIAS = [
  "oficial_altura",
  "medio_oficial_altura",
  "vigilancia_sereno",
  "panolero_canchero_gruista",
  "sobrestante",
  "jefatura_obra",
];

// "Personal no incluido en el Decreto Ley 14.411" — a propósito NO vive en
// CategoriaLaboral (a diferencia de Oficios Especializados, arriba):
// (a) esa tabla alimenta los desplegables de mano de obra al armar un APU
// real, y estas categorías son justo las que la ley de la construcción NO
// cubre — cargarlas ahí las pondría seleccionables por error en un
// presupuesto de obra; (b) Obreros Mensuales/Administrativos son sueldos
// MENSUALES (hora = valor/240), no jornales diarios (hora = jornal/8) como
// asume el resto de esa tabla — mezclar ambas unidades bajo el mismo campo
// "jornal" sería confuso. Es de solo consulta, valores tal cual la fuente
// (ver FUENTE_PERSONAL_NO_INCLUIDO más abajo) — no se actualiza con la
// imagen del convenio, hay que tocar este archivo si cambian el año que
// viene. Confirmado con Luis antes de implementar (ver sesión).
interface FilaPersonalNoIncluido {
  categoria: string;
  valor: number; // igual en Zona 1/2/3 en esta planilla: se muestra una sola columna
  hora: number;
}

const OBREROS_JORNALEROS: FilaPersonalNoIncluido[] = [
  { categoria: "I", valor: 1992.52, hora: 249.07 },
  { categoria: "II", valor: 2118.36, hora: 264.8 },
  { categoria: "III", valor: 2249.03, hora: 281.14 },
  { categoria: "IV", valor: 2448.84, hora: 306.11 },
  { categoria: "V", valor: 2650.67, hora: 331.34 },
  { categoria: "VI", valor: 2868.82, hora: 358.62 },
  { categoria: "VII", valor: 3090.24, hora: 386.29 },
  { categoria: "VIII", valor: 3545.43, hora: 443.17 },
  { categoria: "IX", valor: 3778.69, hora: 472.35 },
  { categoria: "X", valor: 4007.09, hora: 500.88 },
  { categoria: "XI", valor: 4007.09, hora: 500.88 },
  { categoria: "XII", valor: 4239.26, hora: 529.9 },
];

const OBREROS_MENSUALES: FilaPersonalNoIncluido[] = [
  { categoria: "Im", valor: 84211.58, hora: 350.89 },
  { categoria: "IIm", valor: 91817.91, hora: 382.58 },
  { categoria: "IIIm", valor: 100706.51, hora: 419.62 },
  { categoria: "IVm", valor: 111568.53, hora: 464.86 },
];

const ADMINISTRATIVOS: FilaPersonalNoIncluido[] = [
  { categoria: "Ia", valor: 47370.41, hora: 197.37 },
  { categoria: "IIa", valor: 57970.08, hora: 241.54 },
  { categoria: "IIIa", valor: 68621.51, hora: 285.93 },
  { categoria: "IVa", valor: 79315.3, hora: 330.49 },
  { categoria: "Va", valor: 89971.11, hora: 374.88 },
  { categoria: "VIa", valor: 100709.99, hora: 419.63 },
  { categoria: "VIIa", valor: 111460.33, hora: 464.42 },
  { categoria: "VIIIa", valor: 122250.94, hora: 509.38 },
];

const FUENTE_PERSONAL_NO_INCLUIDO =
  'Fuente: Acta de Acuerdo de Consejo de Salarios, Grupo 9 Sub-Grupo 01, 14/agosto/2026, "Planilla de laudos vigentes a partir del 1º de abril de 2026" — vigencia 01/04/2026 al 31/03/2027.';

function fmtMoneda(v: number): string {
  return `$${v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function filasPersonalNoIncluido(datos: FilaPersonalNoIncluido[]): string[][] {
  return datos.map((d) => [d.categoria, fmtMoneda(d.valor), fmtMoneda(d.hora)]);
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

// Rendimiento promedio por categoría en el catálogo global —
// agregado en memoria (pocos registros) para no depender de GROUP BY de Prisma.
interface RendimientoResumen {
  categoria: string;
  cantLineas: number;
  rendimientoMin: number;
  rendimientoMax: number;
  rendimientoPromedio: number;
}

// Convierte el código interno de CategoriaLaboral al nombre corto que aparece
// en ManoObraAPUEstandar.categoria — ese campo guarda el nombre del oficio
// ("Oficial albañil", "Peón común", "Electricista oficial", etc.), no el código.
// La cruza se hace por nombre (case-insensitive).

export default async function ManoDeObraPage() {
  const [categorias, config, lineasCatalogo] = await Promise.all([
    db.categoriaLaboral.findMany(),
    db.configuracion.findFirst(),
    db.manoObraAPUEstandar.findMany({ select: { categoria: true, rendimiento: true, jornadaHs: true } }),
  ]);
  const porCategoria = new Map(categorias.map((c) => [c.categoria, c]));

  const filasLaudo = CATEGORIAS_LAUDO.map(({ categoria, numero }) => {
    const c = porCategoria.get(categoria);
    if (!c) return null;
    return [numero, c.nombre, fmtMoneda(c.jornal), fmtMoneda(c.jornal / 8)];
  }).filter((f): f is string[] => f !== null);

  const filasPorNombre = (lista: string[]) =>
    lista
      .map((categoria) => {
        const c = porCategoria.get(categoria);
        if (!c) return null;
        return [c.nombre, fmtMoneda(c.jornal), fmtMoneda(c.jornal / 8)];
      })
      .filter((f): f is string[] => f !== null);
  const filasOficios = filasPorNombre(OFICIOS_ESPECIALIZADOS);
  const filasOtras = filasPorNombre(OTRAS_CATEGORIAS);

  // Agrupar líneas del catálogo por categoría
  const mapaRendimientos = new Map<string, number[]>();
  for (const linea of lineasCatalogo) {
    const key = linea.categoria.trim();
    if (!mapaRendimientos.has(key)) mapaRendimientos.set(key, []);
    // rendimiento en el APU es "m² (u otro) por jornal de 8hs" —
    // normalizamos a rendimiento por hora para comparar entre jornadas distintas
    const rendPorHora = linea.jornadaHs > 0 ? linea.rendimiento / linea.jornadaHs : linea.rendimiento;
    mapaRendimientos.get(key)!.push(rendPorHora);
  }
  const rendimientosCatalogo: RendimientoResumen[] = Array.from(mapaRendimientos.entries())
    .map(([categoria, vals]) => ({
      categoria,
      cantLineas: vals.length,
      rendimientoMin: Math.min(...vals),
      rendimientoMax: Math.max(...vals),
      rendimientoPromedio: vals.reduce((a, b) => a + b, 0) / vals.length,
    }))
    .sort((a, b) => b.cantLineas - a.cantLineas);

  return (
    <div className="p-8 max-w-3xl">
      <BotonVolverAlProyecto />
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Mano de Obra
      </h1>
      <p className="text-slate-500 mb-8">
        Categorías laborales y jornales de referencia.
      </p>

      {/* Convenio SUNCA (link externo + subir, SUPERADMIN) y Decreto del
          Convenio firmado (descargar PDF) — lado a lado en desktop, apiladas
          en mobile. La fecha es la misma vigencia del aviso de abajo. */}
      <SeccionConvenioFirmado
        fechaConvenio={config?.convenioFechaVigente ? formatearFechaUTC(new Date(config.convenioFechaVigente)) : null}
      />

      {/* Actualizar jornales desde la imagen o el PDF del convenio (extracción
          con IA, fecha y número). Solo SUPERADMIN: el componente devuelve null
          para el resto. Reemplaza al "Catálogo maestro de jornales" con tabla
          editable; los jornales vigentes se consultan en las tablas de abajo. */}
      <SeccionCategoriasLaborales />

      <div className="mt-8">
        <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide mb-1">
          Jornales SUNCA vigentes
        </h2>
        {/* Vigencia del convenio bien visible para todos: es de qué fecha son los jornales. */}
        {config?.convenioFechaVigente && (
          <div className="mt-2 mb-1">
            <p className="inline-flex items-center rounded-lg bg-blue-50 border border-blue-100 px-3 py-1.5 text-sm font-semibold text-[#1A3A5C]">
              {periodoConvenio(config.convenioFechaVigente, config.convenioNumero)}
            </p>
            <p className="text-xs text-slate-400 mt-1.5">
              Verificá si hay convenio más reciente antes de usar en presupuestos definitivos.
            </p>
          </div>
        )}
        <Tabla encabezados={["Categoría", "Nombre", "Jornal", "Hora"]} filas={filasLaudo} />
      </div>

      {filasOficios.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide mb-1">
            Oficios especializados
          </h3>
          <p className="text-xs text-slate-400 mb-1">
            Nivelados a una categoría fija del laudo, no forman parte de la numeración I-XII.
          </p>
          <Tabla encabezados={["Oficio", "Jornal", "Hora"]} filas={filasOficios} />
        </div>
      )}

      {filasOtras.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide mb-1">
            Otras categorías
          </h3>
          <p className="text-xs text-slate-400 mb-1">
            Las categorías de altura tienen recargo sobre Oficial y Medio oficial según el convenio vigente —
            actualizalas a mano si cambia el porcentaje.
          </p>
          <Tabla encabezados={["Categoría", "Jornal", "Hora"]} filas={filasOtras} />
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide mb-1">
          Personal no incluido en el Decreto Ley 14.411
        </h3>
        <p className="text-xs text-slate-400 mb-1">
          Categorías fuera del régimen de la construcción — de consulta, no seleccionables al
          armar un APU.
        </p>

        <p className="text-xs font-semibold text-slate-500 mt-4 mb-1">
          Obreros jornaleros (jornal por día)
        </p>
        <Tabla encabezados={["Categoría", "Jornal", "Hora"]} filas={filasPersonalNoIncluido(OBREROS_JORNALEROS)} />

        <p className="text-xs font-semibold text-slate-500 mt-4 mb-1">Obreros mensuales</p>
        <Tabla encabezados={["Categoría", "Sueldo mensual", "Hora"]} filas={filasPersonalNoIncluido(OBREROS_MENSUALES)} />

        <p className="text-xs font-semibold text-slate-500 mt-4 mb-1">Administrativos</p>
        <Tabla encabezados={["Categoría", "Sueldo mensual", "Hora"]} filas={filasPersonalNoIncluido(ADMINISTRATIVOS)} />

        <p className="text-xs text-slate-400 mt-3">
          Mismo valor en las tres zonas del laudo. {FUENTE_PERSONAL_NO_INCLUIDO}
        </p>
      </div>

      {/* Rendimientos del catálogo — qué rendimiento usa cada categoría en los
          APU del Catálogo de Rubros, agrupado por categoría y ordenado de más
          a menos apariciones. Solo se muestran categorías del catálogo global
          (APUEstandar, no APUs de proyectos reales). */}
      <SeccionRendimientosCatalogo
        porCategoria={porCategoria}
        rendimientosCatalogo={rendimientosCatalogo}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sección: Rendimientos del Catálogo de Rubros
// ---------------------------------------------------------------------------

function fmtRend(v: number): string {
  // Hasta 3 decimales significativos, sin ceros de cola
  if (v >= 100) return v.toFixed(1);
  if (v >= 10) return v.toFixed(2);
  return v.toFixed(3).replace(/\.?0+$/, "");
}

function SeccionRendimientosCatalogo({
  porCategoria,
  rendimientosCatalogo,
}: {
  porCategoria: Map<string, { nombre: string; jornal: number }>;
  rendimientosCatalogo: RendimientoResumen[];
}) {
  if (rendimientosCatalogo.length === 0) {
    return (
      <div className="mt-8 bg-slate-50 rounded-xl border border-slate-200 px-6 py-10 text-center">
        <p className="text-sm text-slate-400">
          El catálogo de rubros aún no tiene APUs con mano de obra cargada.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide mb-1">
        Rendimientos en el Catálogo de Rubros
      </h2>
      <p className="text-xs text-slate-400 mb-3">
        Rendimientos por hora usados en los descompuestos del catálogo global, agrupados por categoría laboral.
        Los rangos reflejan variaciones entre distintos rubros del catálogo.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Categoría / Oficio
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Jornal vigente
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Rendimiento / hora
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Rubros
              </th>
            </tr>
          </thead>
          <tbody>
            {rendimientosCatalogo.map((r, i) => {
              // Buscar jornal por nombre de categoría (case-insensitive)
              const nombreBuscado = r.categoria.toLowerCase();
              let jornal: number | null = null;
              for (const cat of porCategoria.values()) {
                if (cat.nombre.toLowerCase() === nombreBuscado) {
                  jornal = cat.jornal;
                  break;
                }
              }

              const mismoRend = r.rendimientoMin === r.rendimientoMax;
              const rendLabel = mismoRend
                ? fmtRend(r.rendimientoPromedio)
                : `${fmtRend(r.rendimientoMin)} – ${fmtRend(r.rendimientoMax)}`;

              return (
                <tr key={r.categoria} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                  <td className="px-4 py-2.5 border-t border-slate-100 text-slate-700 font-medium">
                    {r.categoria}
                  </td>
                  <td className="px-4 py-2.5 border-t border-slate-100 text-right tabular-nums text-slate-500">
                    {jornal !== null ? fmtMoneda(jornal) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 border-t border-slate-100 text-right tabular-nums text-slate-600 font-medium">
                    {rendLabel}
                  </td>
                  <td className="px-4 py-2.5 border-t border-slate-100 text-right tabular-nums text-slate-400">
                    {r.cantLineas}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 mt-3 text-xs text-slate-400">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Rendimiento por hora = unidades producidas por hora de trabajo (u/hs). Los valores varían entre
          rubros según dificultad, acceso y condiciones de obra. El catálogo usa estas referencias al
          calcular el costo de mano de obra en cada APU.
        </span>
      </div>
    </div>
  );
}
