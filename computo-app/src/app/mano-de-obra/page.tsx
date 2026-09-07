import { Hammer } from "lucide-react";
import { db } from "@/lib/db";
import { ListaReferencias, type ReferenciaLink } from "@/components/ListaReferencias";
import { mensajeAvisoConvenio } from "@/lib/convenioSunca";
import SeccionCategoriasLaborales from "@/components/mano-de-obra/SeccionCategoriasLaborales";
import SeccionConvenioFirmado from "@/components/mano-de-obra/SeccionConvenioFirmado";
import { BotonVolverAlProyecto } from "@/components/shared/BotonVolverAlProyecto";

// Jornales sourced en vivo desde CategoriaLaboral (misma tabla que ya
// actualiza Configuración) — nunca cachear como contenido estático, si no
// una actualización de convenio (ver seed-jornales-sunca-2026.ts) no se
// reflejaría acá hasta el próximo build.
export const dynamic = "force-dynamic";

const referencias: ReferenciaLink[] = [
  {
    titulo: "Convenio SUNCA",
    descripcion: "Escalas salariales y convenio colectivo vigente",
    url: "https://sunca.uy/category/convenios/",
  },
];

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
// romano (ver rubroCompatibleConFila / seed-jornales-sunca-2026.ts).
const OFICIOS_ESPECIALIZADOS = [
  "electricista_oficial",
  "oficial_gasista",
  "plomero_oficial",
  "pintor_oficial",
  "oficial_maquinista",
  "oficial_escalerista",
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
  valor: number; // igual en Zona 1/2/3 en esta planilla
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
  return datos.map((d) => [d.categoria, fmtMoneda(d.valor), fmtMoneda(d.valor), fmtMoneda(d.valor), fmtMoneda(d.hora)]);
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

export default async function ManoDeObraPage() {
  const [categorias, config] = await Promise.all([
    db.categoriaLaboral.findMany(),
    db.configuracion.findFirst(),
  ]);
  const porCategoria = new Map(categorias.map((c) => [c.categoria, c]));

  const filasLaudo = CATEGORIAS_LAUDO.map(({ categoria, numero }) => {
    const c = porCategoria.get(categoria);
    if (!c) return null;
    return [numero, c.nombre, fmtMoneda(c.jornal), fmtMoneda(c.jornal / 8)];
  }).filter((f): f is string[] => f !== null);

  const filasOficios = OFICIOS_ESPECIALIZADOS.map((categoria) => {
    const c = porCategoria.get(categoria);
    if (!c) return null;
    return [c.nombre, fmtMoneda(c.jornal), fmtMoneda(c.jornal / 8)];
  }).filter((f): f is string[] => f !== null);

  return (
    <div className="p-8 max-w-3xl">
      <BotonVolverAlProyecto />
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Mano de Obra
      </h1>
      <p className="text-slate-500 mb-8">
        Categorías laborales, jornales y rendimientos de referencia.
      </p>

      {/* Convenio SUNCA (link externo) + Descargar convenio firmado (PDF,
          Blob) — lado a lado en desktop, apiladas en mobile. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        <ListaReferencias items={referencias} />
        <SeccionConvenioFirmado />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide mb-1">
          Jornales SUNCA vigentes
        </h2>
        {config?.convenioFechaVigente && (
          <p className="text-xs text-slate-400 mb-1">
            {mensajeAvisoConvenio(config.convenioFechaVigente)}
          </p>
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
        <Tabla
          encabezados={["Categoría", "Zona 1", "Zona 2", "Zona 3", "Valor Hora"]}
          filas={filasPersonalNoIncluido(OBREROS_JORNALEROS)}
        />

        <p className="text-xs font-semibold text-slate-500 mt-4 mb-1">Obreros mensuales</p>
        <Tabla
          encabezados={["Categoría", "Zona 1", "Zona 2", "Zona 3", "Valor Hora"]}
          filas={filasPersonalNoIncluido(OBREROS_MENSUALES)}
        />

        <p className="text-xs font-semibold text-slate-500 mt-4 mb-1">Administrativos</p>
        <Tabla
          encabezados={["Categoría", "Zona 1", "Zona 2", "Zona 3", "Valor Hora"]}
          filas={filasPersonalNoIncluido(ADMINISTRATIVOS)}
        />

        <p className="text-xs text-slate-400 mt-3">{FUENTE_PERSONAL_NO_INCLUIDO}</p>
      </div>

      {/* Editor real de CategoriaLaboral — antes vivía en /configuracion,
          movida acá porque es contenido específico de mano de obra, no de
          la empresa en general (ver NOTA(multi-tenant) en el componente).
          Client component embebido dentro de esta página server — el
          resto de la página (las tablas de consulta de arriba) sigue
          siendo un server component sin cambios. Al final de todo y
          colapsada: es mantenimiento anual, no algo que un usuario nuevo
          necesite ver de entrada. */}
      <div className="mt-8">
        <SeccionCategoriasLaborales />
      </div>

      <div className="flex flex-col items-center justify-center text-center bg-white rounded-xl border border-slate-200 py-16 px-6 mt-8">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <Hammer className="w-5 h-5 text-[#2563EB]" />
        </div>
        <h2 className="text-sm font-semibold text-[#1E293B] mb-1">
          Próximamente
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Acá vas a poder consultar los rendimientos usados en los
          descompuestos del Catálogo de Rubros.
        </p>
      </div>
    </div>
  );
}
