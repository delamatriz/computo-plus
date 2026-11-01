"use client";

import { useState, useCallback, useMemo } from "react";
import { FolderOpen, ChevronDown, ChevronRight, Search, FileText, Image as ImageIcon, File as FileIcon, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PALETA } from "@/lib/paletaPresupuesto";
import {
  CATEGORIAS_BIBLIOTECA,
  urlDescargaBiblioteca,
  formatearTamanio,
  type DocumentoBibliotecaListado,
} from "@/lib/biblioteca";
import { ETIQUETA_ORIGEN, type DocumentoObraAgregado, type OrigenDocumentoObra } from "@/lib/documentosObra";

// Acceso rápido, desde Gestión de Obra, a los documentos que se consultan en
// obra: la Biblioteca técnica (global, la misma de /biblioteca) y todo lo de
// este proyecto — planos, detalles y fotos (Documentación para metrar) más lo
// adjuntado en las demás secciones (contrato, trámites, bitácora, remitos,
// comprobantes, cierre y As-Built). Solo lectura — se cargan y se borran en
// sus pantallas de siempre. Cada archivo se abre en otra pestaña.

/* ─── Tipos ───────────────────────────────────────────────── */
interface DocumentoObra {
  id: string;
  categoria: "PLANO" | "FOTO" | "DETALLE";
  nombre: string;
  tipoArchivo: string; // "PDF" | "IMAGEN" | "DWG"
  nombreArchivoOriginal: string;
  tamano: number | null;
}

type Pestana = "biblioteca" | "obra";

// Fila de la pestaña "De la obra": un documento de metraje o un adjunto de
// otra sección, con la misma forma.
interface ArchivoObra {
  id: string;
  categoria: DocumentoObra["categoria"] | OrigenDocumentoObra;
  titulo: string;
  detalle: string;
  href: string;
  tamano: number | null;
  icono: "pdf" | "imagen" | "otro";
}

const ORDEN_CATEGORIAS_OBRA: ArchivoObra["categoria"][] = [
  "PLANO",
  "DETALLE",
  "FOTO",
  "CONTRATO",
  "TRAMITE",
  "BITACORA",
  "REMITO",
  "COMPROBANTE",
  "CIERRE",
  "AS_BUILT",
];

function etiquetaCategoriaObra(c: ArchivoObra["categoria"]): string {
  return c in ETIQUETA_OBRA ? ETIQUETA_OBRA[c as DocumentoObra["categoria"]] : ETIQUETA_ORIGEN[c as OrigenDocumentoObra];
}

const ETIQUETA_OBRA: Record<DocumentoObra["categoria"], string> = {
  PLANO: "Planos",
  DETALLE: "Detalles",
  FOTO: "Fotos",
};

interface Props {
  proyectoId: string;
}

// Misma ruta que urlProxyDocumentoMetraje (lib/blob.ts), que no se puede
// importar acá: ese módulo trae @vercel/blob, que es solo de servidor.
function urlDocumentoObra(proyectoId: string, docId: string): string {
  return `/api/proyectos/${proyectoId}/documentos-metraje/${docId}/archivo`;
}

function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionDocumentosObra({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState(false);
  const [biblioteca, setBiblioteca] = useState<DocumentoBibliotecaListado[]>([]);
  const [deObra, setDeObra] = useState<ArchivoObra[]>([]);
  const [pestana, setPestana] = useState<Pestana>("obra");
  const [categoria, setCategoria] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setError(false);
    try {
      const [resB, resO, resA] = await Promise.all([
        fetch("/api/biblioteca"),
        fetch(`/api/proyectos/${proyectoId}/documentos-metraje`),
        fetch(`/api/proyectos/${proyectoId}/documentos-obra`),
      ]);
      if (!resB.ok || !resO.ok || !resA.ok) throw new Error("No se pudieron cargar los documentos");
      const dataB = await resB.json();
      const dataO = await resO.json();
      const dataA = await resA.json();
      const listaB: DocumentoBibliotecaListado[] = Array.isArray(dataB) ? dataB : [];
      const metraje: DocumentoObra[] = Array.isArray(dataO.documentos) ? dataO.documentos : [];
      const adjuntos: DocumentoObraAgregado[] = Array.isArray(dataA) ? dataA : [];
      const listaO: ArchivoObra[] = [
        ...metraje.map((d) => ({
          id: d.id,
          categoria: d.categoria,
          titulo: d.nombre,
          detalle: `${ETIQUETA_OBRA[d.categoria]} · ${d.nombreArchivoOriginal}`,
          href: urlDocumentoObra(proyectoId, d.id),
          tamano: d.tamano,
          icono: (d.tipoArchivo === "IMAGEN" ? "imagen" : d.tipoArchivo === "PDF" ? "pdf" : "otro") as ArchivoObra["icono"],
        })),
        ...adjuntos.map((d) => ({
          id: d.id,
          categoria: d.origen,
          titulo: d.titulo,
          detalle: d.detalle,
          href: d.href,
          tamano: d.tamano,
          icono: d.tipo,
        })),
      ];
      setBiblioteca(listaB);
      setDeObra(listaO);
      // Si la obra no tiene nada cargado, arrancar en la biblioteca.
      if (listaO.length === 0 && listaB.length > 0) setPestana("biblioteca");
    } catch (err) {
      console.error("[documentos-obra] error cargando", err);
      setError(true);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  // Se recarga en cada apertura: los adjuntos se suben en otras secciones.
  const abrirSeccion = () => {
    if (!expandido) cargar();
    setExpandido((p) => !p);
  };

  const cambiarPestana = (p: Pestana) => {
    setPestana(p);
    setCategoria("todas");
  };

  const q = normalizar(busqueda.trim());

  const bibliotecaFiltrada = useMemo(
    () =>
      biblioteca.filter(
        (d) =>
          (categoria === "todas" || d.categoria === categoria) &&
          (!q || normalizar(`${d.titulo} ${d.descripcion ?? ""} ${d.nombreArchivo}`).includes(q))
      ),
    [biblioteca, categoria, q]
  );

  const obraFiltrada = useMemo(
    () =>
      deObra.filter(
        (d) =>
          (categoria === "todas" || d.categoria === categoria) &&
          (!q || normalizar(`${d.titulo} ${d.detalle}`).includes(q))
      ),
    [deObra, categoria, q]
  );

  const filtros =
    pestana === "biblioteca"
      ? CATEGORIAS_BIBLIOTECA.map((c) => ({ id: c.id, nombre: c.nombre, n: biblioteca.filter((d) => d.categoria === c.id).length }))
      : ORDEN_CATEGORIAS_OBRA.map((c) => ({
          id: c,
          nombre: etiquetaCategoriaObra(c),
          n: deObra.filter((d) => d.categoria === c).length,
        })).filter((f) => f.n > 0);

  // Sin nada que buscar no tiene sentido mostrar el buscador ni el filtro.
  const hayDocumentos = (pestana === "biblioteca" ? biblioteca.length : deObra.length) > 0;

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left group ${PALETA.capituloFila}`}
      >
        <div className="flex items-center gap-2.5">
          <FolderOpen className="w-4 h-4 text-[#1D4435]" />
          <h2 className="text-sm font-bold text-[#1D4435] uppercase tracking-wide">Documentos</h2>
        </div>
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-200"
          >
            <div className="px-5 py-5 space-y-3" style={{ background: "#F8FAFC" }}>
              <p className="text-xs text-slate-500 -mt-1">
                Todo lo de esta obra — planos, fotos y lo adjuntado en contrato, trámites, bitácora, compras, caja y
                cierre — y la biblioteca técnica (normas, manuales), sin salir de Gestión de Obra. Cada archivo se abre
                en otra pestaña.
              </p>

              {/* Pestañas */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-[10px] bg-slate-100">
                {(
                  [
                    ["obra", "De la obra", deObra.length],
                    ["biblioteca", "Biblioteca", biblioteca.length],
                  ] as const
                ).map(([id, nombre, n]) => (
                  <button
                    key={id}
                    onClick={() => cambiarPestana(id)}
                    className={cn(
                      "py-2 px-2 rounded-[8px] text-xs font-semibold transition-colors min-w-0 truncate",
                      pestana === id ? "bg-white text-[#1A3A5C] shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {nombre}
                    {cargado && <span className="ml-1 font-normal text-slate-400">({n})</span>}
                  </button>
                ))}
              </div>

              {/* Búsqueda y filtro */}
              {cargado && !error && hayDocumentos && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre"
                      className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                    />
                  </div>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="sm:w-56 text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                  >
                    <option value="todas">Todas las categorías</option>
                    {filtros.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre} ({f.n})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lista */}
              {!cargado ? (
                <p className="text-xs text-slate-400 italic px-1 py-3">Cargando documentos…</p>
              ) : error ? (
                <p className="text-xs text-red-600 px-1 py-3">
                  No se pudieron cargar los documentos.{" "}
                  <button onClick={cargar} className="font-semibold underline">
                    Reintentar
                  </button>
                </p>
              ) : pestana === "obra" ? (
                obraFiltrada.length === 0 ? (
                  <Vacio
                    texto={
                      deObra.length === 0
                        ? "Esta obra todavía no tiene documentos. Los planos y fotos se cargan en Documentación para metrar (pestaña Presupuesto); el resto, en cada sección de Gestión de Obra."
                        : "Ningún documento coincide con la búsqueda."
                    }
                  />
                ) : (
                  <div className="rounded-[10px] border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                    {obraFiltrada.map((d) => (
                      <FilaArchivo
                        key={d.id}
                        href={d.href}
                        titulo={d.titulo}
                        detalle={d.detalle}
                        tamano={d.tamano}
                        icono={d.icono}
                      />
                    ))}
                  </div>
                )
              ) : bibliotecaFiltrada.length === 0 ? (
                <Vacio
                  texto={
                    biblioteca.length === 0
                      ? "La biblioteca técnica todavía no tiene documentos."
                      : "Ningún documento coincide con la búsqueda."
                  }
                />
              ) : (
                <div className="rounded-[10px] border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                  {bibliotecaFiltrada.map((d) => (
                    <FilaArchivo
                      key={d.id}
                      href={urlDescargaBiblioteca(d.id)}
                      titulo={d.titulo}
                      detalle={CATEGORIAS_BIBLIOTECA.find((c) => c.id === d.categoria)?.nombre ?? d.categoria}
                      descripcion={d.descripcion}
                      tamano={d.tamanio}
                      icono={d.nombreArchivo.toLowerCase().endsWith(".pdf") ? "pdf" : "otro"}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Fila de archivo ─────────────────────────────────────── */
function FilaArchivo({
  href,
  titulo,
  detalle,
  descripcion,
  tamano,
  icono,
}: {
  href: string;
  titulo: string;
  detalle: string;
  descripcion?: string | null;
  tamano: number | null;
  icono: "pdf" | "imagen" | "otro";
}) {
  const cls = "w-4 h-4 text-slate-400 group-hover:text-[#2563EB] flex-shrink-0 mt-0.5 transition-colors";
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-[#F8FAFC] transition-colors group"
    >
      {icono === "pdf" ? <FileText className={cls} /> : icono === "imagen" ? <ImageIcon className={cls} /> : <FileIcon className={cls} />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700 truncate group-hover:text-[#2563EB] transition-colors">{titulo}</p>
        <p className="text-[11px] text-slate-400 truncate">
          {detalle}
          {tamano != null && ` · ${formatearTamanio(tamano)}`}
        </p>
        {descripcion && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{descripcion}</p>}
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#2563EB] flex-shrink-0 mt-0.5 transition-colors" />
    </a>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="text-xs text-slate-400 italic px-1 py-3">{texto}</p>;
}
