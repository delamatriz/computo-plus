import Link from "next/link";
import { Hammer } from "lucide-react";
import { db } from "@/lib/db";
import { ListaReferencias, type ReferenciaLink } from "@/components/ListaReferencias";
import { mensajeAvisoConvenio } from "@/lib/convenioSunca";

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

function fmtMoneda(v: number): string {
  return `$${v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Mano de Obra
      </h1>
      <p className="text-slate-500 mb-8">
        Categorías laborales, jornales y rendimientos de referencia.
      </p>

      <ListaReferencias items={referencias} />

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
          Convenio SUNCA — documento original
        </h3>
        {config?.convenioImagenUrl ? (
          <div className="rounded-xl border border-slate-200 overflow-hidden mt-2 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/configuracion/convenio-imagen"
              alt="Foto del convenio SUNCA escaneado"
              className="w-full h-auto"
            />
          </div>
        ) : (
          <p className="text-sm text-slate-400 mt-1">
            Todavía no se cargó una foto del convenio. Subí una imagen en{" "}
            <Link href="/configuracion" className="text-[#2563EB] hover:underline">
              Configuración → Categorías Laborales SUNCA
            </Link>{" "}
            para verla acá.
          </p>
        )}
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
