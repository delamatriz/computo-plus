"use client";

// NOTA(multi-tenant): los jornales son globales (compartidos por todas las
// empresas), así que actualizarlos, subir el convenio y extraer con IA es solo
// del SUPERADMIN — las APIs lo exigen; para el resto este panel no se muestra.
// En la Fase 3 cada empresa va a tener su propia copia (nace de una semilla
// SUNCA oficial).
//
// Flujo de actualización anual de jornales (oct-2026, reemplaza al "Catálogo
// maestro de jornales" con la tabla editable): botón → imagen o PDF del
// convenio → extracción con IA → cambios propuestos (antes/después) →
// "Aplicar cambios" guarda directo, con confirmación. Los jornales vigentes se
// consultan en las tablas de solo lectura de la página.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, ImageUp, Sparkles } from "lucide-react";
import { convenioPosiblementeDesactualizado, mensajeAvisoConvenio } from "@/lib/convenioSunca";
import { useSuperadmin } from "@/hooks/useSuperadmin";

interface CategoriaLaboral {
  id: string;
  nombre: string;
  categoria: string;
  jornal: number;
}

interface Configuracion {
  id: string;
  convenioFechaVigente: string | null;
  convenioNumero?: string | null;
  convenioImagenUrl: string | null;
}

interface CategoriaExtraida {
  categoriaRomano: string | null;
  nombreEnImagen: string;
  jornal: number;
}

interface ResultadoExtraccion {
  categorias: CategoriaExtraida[];
  recargoAlturaPct?: number | null;
  fechaVigencia?: string;
  porcentajeAjuste?: number;
  convenioNumero?: string | null;
}

interface PropuestaCategoria {
  categoriaId: string;
  nombre: string;
  jornalAntes: number;
  jornalDespues: number;
}

// Mapea el número de categoría del laudo (identificado por nombre en la
// imagen, nunca por posición de fila) al código interno de CategoriaLaboral.
const ROMANO_A_CODIGO_LAUDO: Record<string, string> = {
  I: "sunca_cat_i",
  II: "sunca_cat_ii",
  III: "sunca_cat_iii",
  IV: "sunca_cat_iv",
  V: "sunca_cat_v",
  VI: "sunca_cat_vi",
  VII: "sunca_cat_vii",
  VIII: "sunca_cat_viii",
  IX: "sunca_cat_ix",
  X: "sunca_cat_x",
  XI: "sunca_cat_xi",
  XII: "sunca_cat_xii",
};

// Categorías de CategoriaLaboral que siguen el jornal de una categoría fija
// del laudo: los alias de nombre común (Peón = Cat. I, Medio oficial = Cat. V,
// Oficial = Cat. VII, Oficial especializado = Cat. VIII, Capataz = Cat. IX) y
// los oficios nivelados (ver /mano-de-obra, "Oficios especializados"). Sin la
// tabla editable, es la única forma de que se actualicen junto con el laudo.
// Siempre anclado al número de categoría, nunca a la posición de la fila.
const ROMANO_A_CODIGOS_NIVELADOS: Record<string, string[]> = {
  I: ["peon"],
  V: ["medio_oficial"],
  VII: ["oficial"],
  VIII: ["oficial_especializado", "electricista_oficial", "plomero_oficial", "pintor_oficial", "oficial_gasista"],
  IX: ["capataz"],
  X: ["oficial_maquinista", "oficial_escalerista"],
};

// Categorías que el SUPERADMIN edita a mano en "Otras categorías", debajo del
// botón de actualizar: las que no salen del laudo (sereno, pañolero,
// sobrestante, jefatura de obra) y las de trabajo en altura, que la extracción
// con IA solo recalcula si encuentra el % de recargo en el documento.
const CODIGOS_FUERA_DEL_LAUDO = [
  "oficial_altura",
  "medio_oficial_altura",
  "vigilancia_sereno",
  "panolero_canchero_gruista",
  "sobrestante",
  "jefatura_obra",
];

function formatearJornal(n: number): string {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Lee un jornal tipeado a mano, con coma o punto decimal. Con coma, los puntos
// son de miles ("2.393,81" → 2393.81, "2,50" → 2.5). Sin coma, un punto
// seguido de exactamente 3 dígitos es de miles ("2.500" → 2500, nunca 2,5) y
// si no, es decimal ("2393.81"). Cualquier otra cosa → NaN.
function parsearJornal(texto: string): number {
  const s = texto.replace(/[\s$]/g, "");
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s) || /^\d+,\d{1,2}$/.test(s)) {
    return Number(s.replace(/\./g, "").replace(",", "."));
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  if (/^\d+(\.\d{1,2})?$/.test(s)) return Number(s);
  return NaN;
}

const MENSAJE_ERROR_EXTRACCION =
  "No pude extraer los jornales con certeza. Intentá con una imagen más clara o con el PDF del convenio.";

export default function SeccionCategoriasLaborales() {
  // null (cargando) cuenta como "no": sin flash de controles de edición.
  const puedeEditar = useSuperadmin() === true;
  const router = useRouter();
  const [categorias, setCategorias] = useState<CategoriaLaboral[]>([]);
  const [fechaConvenio, setFechaConvenio] = useState<string>("");
  const [numeroConvenio, setNumeroConvenio] = useState<string>("");
  // Lo guardado en la base, para saber si fecha/número cambiaron.
  const [fechaGuardada, setFechaGuardada] = useState<string>("");
  const [numeroGuardado, setNumeroGuardado] = useState<string>("");
  // Número de convenio que la IA leyó del documento y difiere del cargado —
  // se muestra en la propuesta y se guarda con "Aplicar cambios".
  const [numeroPropuesto, setNumeroPropuesto] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Puede ser una imagen o un PDF (data URL).
  const [archivo, setArchivo] = useState<string | null>(null);
  const esPDF = archivo?.startsWith("data:application/pdf") ?? false;
  const [extrayendo, setExtrayendo] = useState(false);
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null);
  const [resumen, setResumen] = useState<string | null>(null);
  const [propuesta, setPropuesta] = useState<PropuestaCategoria[] | null>(null);
  const [filasNoIdentificadas, setFilasNoIdentificadas] = useState<CategoriaExtraida[]>([]);
  const [notaAltura, setNotaAltura] = useState<string | null>(null);
  // "Otras categorías": jornal tipeado por id, y estado del guardado.
  const [jornalesOtras, setJornalesOtras] = useState<Record<string, string>>({});
  const [guardandoOtras, setGuardandoOtras] = useState(false);
  const [mensajeOtras, setMensajeOtras] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    if (!puedeEditar) return;
    async function cargar() {
      const [resCategorias, resConfig] = await Promise.all([
        fetch("/api/categorias-laborales"),
        fetch("/api/configuracion"),
      ]);
      const dataCategorias: CategoriaLaboral[] = await resCategorias.json();
      const dataConfig: Configuracion = await resConfig.json();
      const fecha = dataConfig.convenioFechaVigente ? dataConfig.convenioFechaVigente.slice(0, 10) : "";
      setCategorias(dataCategorias);
      setJornalesOtras(
        Object.fromEntries(
          dataCategorias.filter((c) => CODIGOS_FUERA_DEL_LAUDO.includes(c.categoria)).map((c) => [c.id, formatearJornal(c.jornal)])
        )
      );
      setConfigId(dataConfig.id);
      setFechaConvenio(fecha);
      setFechaGuardada(fecha);
      setNumeroConvenio(dataConfig.convenioNumero ?? "");
      setNumeroGuardado(dataConfig.convenioNumero ?? "");
      setCargando(false);
    }
    cargar();
  }, [puedeEditar]);

  function limpiarExtraccion() {
    setErrorExtraccion(null);
    setResumen(null);
    setPropuesta(null);
    setNumeroPropuesto(null);
    setFilasNoIdentificadas([]);
    setNotaAltura(null);
  }

  function manejarSeleccionArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0];
    if (!elegido) return;
    e.target.value = "";
    limpiarExtraccion();
    setAbierto(true);
    const reader = new FileReader();
    reader.onload = () => setArchivo(reader.result as string);
    reader.readAsDataURL(elegido);
  }

  async function extraerJornalesConIA() {
    if (!archivo) return;
    setExtrayendo(true);
    limpiarExtraccion();

    try {
      const res = await fetch("/api/configuracion/extraer-jornales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivo }),
      });
      if (!res.ok) {
        setErrorExtraccion(MENSAJE_ERROR_EXTRACCION);
        return;
      }
      const resultado: ResultadoExtraccion = await res.json();

      const identificadas = resultado.categorias.filter(
        (c): c is CategoriaExtraida & { categoriaRomano: string } => c.categoriaRomano !== null
      );
      const jornalPorRomano: Record<string, number> = {};
      for (const c of identificadas) jornalPorRomano[c.categoriaRomano] = c.jornal;

      const propuestas: PropuestaCategoria[] = [];
      const yaPropuestas = new Set<string>();
      function agregarPropuesta(codigo: string, jornalDespues: number) {
        const categoria = categorias.find((cat) => cat.categoria === codigo);
        if (!categoria || yaPropuestas.has(categoria.id)) return;
        if (categoria.jornal === jornalDespues) return;
        yaPropuestas.add(categoria.id);
        propuestas.push({ categoriaId: categoria.id, nombre: categoria.nombre, jornalAntes: categoria.jornal, jornalDespues });
      }

      // Categorías del laudo, y las que se nivelan a una de ellas.
      for (const [romano, jornal] of Object.entries(jornalPorRomano)) {
        const codigo = ROMANO_A_CODIGO_LAUDO[romano];
        if (codigo) agregarPropuesta(codigo, jornal);
        for (const nivelado of ROMANO_A_CODIGOS_NIVELADOS[romano] ?? []) agregarPropuesta(nivelado, jornal);
      }

      // Compensación por trabajo en altura — solo Oficial y Medio Oficial,
      // nunca Peón. Si el documento no muestra el porcentaje, no se toca.
      let notaAlturaTexto: string | null = null;
      if (resultado.recargoAlturaPct != null) {
        const factor = 1 + resultado.recargoAlturaPct / 100;
        const oficialBase = jornalPorRomano["VII"] ?? categorias.find((c) => c.categoria === "oficial")?.jornal;
        const medioOficialBase = jornalPorRomano["V"] ?? categorias.find((c) => c.categoria === "medio_oficial")?.jornal;
        if (oficialBase != null) agregarPropuesta("oficial_altura", Math.round(oficialBase * factor * 100) / 100);
        if (medioOficialBase != null) agregarPropuesta("medio_oficial_altura", Math.round(medioOficialBase * factor * 100) / 100);
      } else {
        notaAlturaTexto =
          "No se detectó el porcentaje de compensación por trabajo en altura en el documento — se mantiene el valor actual.";
      }

      if (resultado.fechaVigencia) setFechaConvenio(resultado.fechaVigencia);
      const numeroNuevo =
        resultado.convenioNumero && resultado.convenioNumero.trim() !== numeroConvenio.trim()
          ? resultado.convenioNumero.trim()
          : null;
      setNumeroPropuesto(numeroNuevo);
      setPropuesta(propuestas);
      setFilasNoIdentificadas(resultado.categorias.filter((c) => c.categoriaRomano === null));
      setNotaAltura(notaAlturaTexto);
      if (propuestas.length === 0 && !numeroNuevo) {
        setResumen("No se detectaron cambios de jornales respecto a los valores actuales.");
      }
    } catch (err) {
      console.error(err);
      setErrorExtraccion(MENSAJE_ERROR_EXTRACCION);
    } finally {
      setExtrayendo(false);
    }
  }

  // Guarda en la base los jornales propuestos (si hay) y la fecha/número del
  // convenio. Con confirmación: afecta a todo lo que se cree de acá en más.
  async function guardar(conJornales: boolean) {
    const cambiosJornal = conJornales ? propuesta ?? [] : [];
    const numeroFinal = (conJornales && numeroPropuesto ? numeroPropuesto : numeroConvenio).trim();
    const confirmado = window.confirm(
      cambiosJornal.length > 0
        ? `¿Confirmás? Se actualizan ${cambiosJornal.length} jornal${cambiosJornal.length === 1 ? "" : "es"} y van a afectar a todos los proyectos nuevos que se creen de acá en adelante.`
        : "¿Confirmás la fecha y el número del convenio?"
    );
    if (!confirmado) return;

    setGuardando(true);
    try {
      // La imagen o el PDF del convenio recién se sube al confirmar: uno
      // elegido por error y nunca confirmado no queda guardado.
      let convenioImagenUrl: string | undefined;
      if (conJornales && archivo) {
        const resImagen = await fetch("/api/configuracion/convenio-imagen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagen: archivo }),
        });
        if (resImagen.ok) convenioImagenUrl = (await resImagen.json()).url;
        else console.error("[guardar] no se pudo subir el archivo del convenio");
      }

      const respuestas = await Promise.all([
        cambiosJornal.length > 0
          ? fetch("/api/categorias-laborales", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ categorias: cambiosJornal.map((p) => ({ id: p.categoriaId, jornal: p.jornalDespues })) }),
            })
          : null,
        configId
          ? fetch("/api/configuracion", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                convenioFechaVigente: fechaConvenio || null,
                convenioNumero: numeroFinal || null,
                ...(convenioImagenUrl !== undefined && { convenioImagenUrl }),
              }),
            })
          : null,
      ]);
      if (respuestas.some((r) => r && !r.ok)) {
        setErrorExtraccion("No se pudieron guardar los cambios. Volvé a intentar.");
        return;
      }

      setCategorias((prev) =>
        prev.map((c) => {
          const p = cambiosJornal.find((x) => x.categoriaId === c.id);
          return p ? { ...c, jornal: p.jornalDespues } : c;
        })
      );
      // Los campos de "Otras categorías" también: si no, quedaban con el jornal
      // de antes (p. ej. las de altura que la IA acaba de recalcular) y un
      // "Guardar" posterior en esa sección los revertía en silencio.
      setJornalesOtras((prev) => {
        const siguiente = { ...prev };
        for (const p of cambiosJornal) if (p.categoriaId in siguiente) siguiente[p.categoriaId] = formatearJornal(p.jornalDespues);
        return siguiente;
      });
      setNumeroConvenio(numeroFinal);
      setNumeroGuardado(numeroFinal);
      setFechaGuardada(fechaConvenio);
      setPropuesta(null);
      setNumeroPropuesto(null);
      setResumen(
        cambiosJornal.length > 0
          ? `Listo: se actualizaron ${cambiosJornal.length} jornal${cambiosJornal.length === 1 ? "" : "es"}.`
          : "Listo: se guardaron la fecha y el número del convenio."
      );
      // Las tablas de jornales vigentes de la página se arman en el servidor.
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  // Guarda a mano los jornales de las categorías fuera del laudo.
  async function guardarOtras() {
    const cambios = categorias
      .filter((c) => CODIGOS_FUERA_DEL_LAUDO.includes(c.categoria))
      .map((c) => ({ c, jornal: parsearJornal(jornalesOtras[c.id] ?? "") }))
      .filter(({ c, jornal }) => jornal !== c.jornal);
    if (cambios.some(({ jornal }) => !Number.isFinite(jornal) || jornal <= 0)) {
      setMensajeOtras({ ok: false, texto: "Cada jornal tiene que ser un número mayor a 0, por ejemplo 2.393,81." });
      return;
    }
    if (cambios.length === 0) {
      setMensajeOtras({ ok: true, texto: "No hay cambios para guardar." });
      return;
    }
    const confirmado = window.confirm(
      `¿Confirmás? Se actualizan ${cambios.length} jornal${cambios.length === 1 ? "" : "es"} y van a afectar a todos los proyectos nuevos que se creen de acá en adelante.`
    );
    if (!confirmado) return;

    setGuardandoOtras(true);
    setMensajeOtras(null);
    try {
      const res = await fetch("/api/categorias-laborales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorias: cambios.map(({ c, jornal }) => ({ id: c.id, jornal })) }),
      });
      if (!res.ok) {
        setMensajeOtras({ ok: false, texto: "No se pudieron guardar los jornales. Volvé a intentar." });
        return;
      }
      setCategorias((prev) =>
        prev.map((c) => {
          const cambio = cambios.find((x) => x.c.id === c.id);
          return cambio ? { ...c, jornal: cambio.jornal } : c;
        })
      );
      // Reescribe lo tipeado con el formato de la app ("2500" → "2.500,00").
      setJornalesOtras((prev) => {
        const siguiente = { ...prev };
        for (const { c, jornal } of cambios) siguiente[c.id] = formatearJornal(jornal);
        return siguiente;
      });
      setMensajeOtras({ ok: true, texto: `Listo: se actualizaron ${cambios.length} jornal${cambios.length === 1 ? "" : "es"}.` });
      router.refresh();
    } catch {
      setMensajeOtras({ ok: false, texto: "No se pudieron guardar los jornales. Volvé a intentar." });
    } finally {
      setGuardandoOtras(false);
    }
  }

  // Solo SUPERADMIN. Después de todos los hooks, a propósito.
  if (!puedeEditar) return null;

  const otrasCategorias = CODIGOS_FUERA_DEL_LAUDO.map((codigo) => categorias.find((c) => c.categoria === codigo)).filter(
    (c): c is CategoriaLaboral => !!c
  );

  const fechaONumeroCambiaron = fechaConvenio !== fechaGuardada || numeroConvenio.trim() !== numeroGuardado.trim();
  const hayPropuesta = !!propuesta && (propuesta.length > 0 || !!numeroPropuesto);
  const convenioDesactualizado = convenioPosiblementeDesactualizado(fechaConvenio || null);

  return (
    <div className="mt-3">
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={manejarSeleccionArchivo} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={cargando}
          className="inline-flex items-center gap-2 border border-slate-300 bg-white text-[#1E293B] text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          <ImageUp className="w-4 h-4" />
          Actualizar jornales desde imagen o PDF del convenio
        </button>
        {!abierto && (
          <button onClick={() => setAbierto(true)} disabled={cargando} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            Fecha y número del convenio
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-3 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3.5 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Los jornales alimentan todos los cálculos nuevos (rubros de la Biblioteca, Leyes Sociales, cuantía de
              obra) en todos los proyectos. No cambian lo ya guardado. Se actualizan una vez al año, cuando cambia el
              convenio SUNCA.
            </p>
          </div>

          {archivo && (
            <div className="border border-slate-200 rounded-lg p-4">
              {esPDF ? (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 mb-3 text-sm text-slate-600">
                  <FileText className="w-4 h-4 flex-shrink-0 text-slate-400" />
                  PDF del convenio cargado — listo para extraer.
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={archivo} alt="Foto del convenio SUNCA" className="max-h-64 rounded-lg mb-3" />
              )}
              <button
                onClick={extraerJornalesConIA}
                disabled={extrayendo || guardando}
                className="inline-flex items-center gap-2 bg-[#1A3A5C] text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#15304c] disabled:opacity-60 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                {extrayendo ? "Extrayendo jornales..." : "Extraer jornales automáticamente"}
              </button>
            </div>
          )}

          {errorExtraccion && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2.5 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorExtraccion}</span>
            </div>
          )}
          {notaAltura && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{notaAltura}</span>
            </div>
          )}
          {filasNoIdentificadas.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                No se pudo identificar con certeza a qué categoría corresponden{" "}
                {filasNoIdentificadas.length === 1 ? "esta fila" : "estas filas"} del documento — no se aplican:{" "}
                {filasNoIdentificadas.map((f) => `"${f.nombreEnImagen}" ($${formatearJornal(f.jornal)})`).join(", ")}.
              </span>
            </div>
          )}

          {hayPropuesta && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-sm font-medium text-[#1E293B] border-b border-slate-200">
                Cambios detectados — revisá antes de aplicar
              </div>
              {numeroPropuesto && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm border-b border-slate-100">
                  <span className="text-[#1E293B]">Número de convenio</span>
                  <span className="text-slate-500">{numeroConvenio.trim() || "sin número"}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-semibold text-[#2563EB]">{numeroPropuesto}</span>
                </div>
              )}
              {propuesta!.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 px-3 font-medium">Categoría</th>
                      <th className="py-2 px-3 font-medium">Antes</th>
                      <th className="py-2 px-3 font-medium"></th>
                      <th className="py-2 px-3 font-medium">Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propuesta!.map((p) => (
                      <tr key={p.categoriaId} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 px-3 text-[#1E293B]">{p.nombre}</td>
                        <td className="py-2 px-3 text-slate-500 tabular-nums">${formatearJornal(p.jornalAntes)}</td>
                        <td className="py-2 px-3 text-slate-400">→</td>
                        <td className="py-2 px-3 font-semibold text-[#2563EB] tabular-nums">${formatearJornal(p.jornalDespues)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex items-center gap-3 px-3 py-3 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => guardar(true)}
                  disabled={guardando}
                  className="bg-[#2563EB] text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
                >
                  {guardando ? "Guardando..." : "Aplicar cambios"}
                </button>
                <button
                  onClick={() => {
                    setPropuesta(null);
                    setNumeroPropuesto(null);
                  }}
                  disabled={guardando}
                  className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Descartar
                </button>
              </div>
            </div>
          )}

          {resumen && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2.5 text-sm">{resumen}</div>
          )}

          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Fecha del convenio vigente</label>
              <input
                type="date"
                value={fechaConvenio}
                onChange={(e) => setFechaConvenio(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Número de convenio</label>
              <input
                type="text"
                value={numeroConvenio}
                onChange={(e) => setNumeroConvenio(e.target.value)}
                maxLength={80}
                placeholder="ej: 2026-2027"
                className="w-44 border border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
              />
            </div>
            {fechaONumeroCambiaron && !hayPropuesta && (
              <button
                onClick={() => guardar(false)}
                disabled={guardando}
                className="bg-[#2563EB] text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
              >
                {guardando ? "Guardando..." : "Guardar fecha y número"}
              </button>
            )}
          </div>

          {convenioDesactualizado && fechaConvenio && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{mensajeAvisoConvenio(fechaConvenio, numeroConvenio)}</span>
            </div>
          )}
        </div>
      )}

      {/* Otras categorías — no salen del laudo, se actualizan a mano. */}
      {!cargando && otrasCategorias.length > 0 && (
        <div className="mt-3 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-[#1E293B]">Otras categorías</h3>
          <p className="text-xs text-slate-400 mt-0.5 mb-3">
            La actualización desde el convenio no las calcula (las de altura, solo si encuentra el % de recargo):
            cargá su jornal a mano cuando cambia el convenio.
          </p>
          <div className="space-y-2">
            {otrasCategorias.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <label htmlFor={`jornal-${c.id}`} className="text-sm text-[#1E293B] min-w-0">
                  {c.nombre}
                </label>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-sm text-slate-400">$</span>
                  <input
                    id={`jornal-${c.id}`}
                    type="text"
                    inputMode="decimal"
                    value={jornalesOtras[c.id] ?? ""}
                    onChange={(e) => {
                      setJornalesOtras((prev) => ({ ...prev, [c.id]: e.target.value }));
                      setMensajeOtras(null);
                    }}
                    className="w-32 text-right border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={guardarOtras}
              disabled={guardandoOtras}
              className="bg-[#2563EB] text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
            >
              {guardandoOtras ? "Guardando..." : "Guardar"}
            </button>
            {mensajeOtras && (
              <span className={mensajeOtras.ok ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{mensajeOtras.texto}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
