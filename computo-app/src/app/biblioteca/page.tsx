"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Download, FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { ListaReferencias, type ReferenciaLink } from "@/components/ListaReferencias";
import { useSuperadmin } from "@/hooks/useSuperadmin";
import { partesFechaUruguay } from "@/lib/fechaUruguay";
import {
  ACCEPT_BIBLIOTECA,
  CATEGORIAS_BIBLIOTECA,
  TAMANIO_MAXIMO_BIBLIOTECA,
  esArchivoBibliotecaValido,
  extensionArchivo,
  formatearTamanio,
  urlDescargaBiblioteca,
  type CategoriaBiblioteca,
  type DocumentoBibliotecaListado,
} from "@/lib/biblioteca";
import { cn } from "@/lib/utils";

// Biblioteca de documentos técnicos (DocumentoBiblioteca) — global, curada
// por el Administrador de CÓMPUTO+. Todos ven y descargan; solo el
// Administrador sube y elimina (lo valida el servidor, acá solo se ocultan
// los controles).

const referencias: ReferenciaLink[] = [
  {
    titulo: "Tercerización — Ley 18.251",
    descripcion: "Responsabilidad solidaria en subcontratación de obras",
    url: "https://www.impo.com.uy/bases/leyes/18251-2008",
  },
  {
    titulo: "Ley 14.411 — Industria de la Construcción",
    descripcion: "Régimen de aportes y leyes sociales de la construcción",
    url: "https://www.impo.com.uy/bases/leyes/14411-1975",
  },
  {
    titulo: "Ley 19.996",
    descripcion: "Modificaciones al régimen de la industria de la construcción",
    url: "https://www.impo.com.uy/bases/leyes/19996-2021",
  },
  {
    titulo: "Artículo 1844 — Responsabilidad por Defectos de Construcción",
    descripcion: "Código Civil uruguayo modificado por Ley 19.726 (2018) — plazos 10, 5 y 2 años",
    url: "https://www.impo.com.uy/bases/codigo-civil/16603-1994/1844",
  },
];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** "oct 2026", en hora de Uruguay. */
function mesAnio(iso: string): string {
  const { anio, mes } = partesFechaUruguay(new Date(iso));
  return `${MESES[mes - 1]} ${anio}`;
}

export default function BibliotecaPage() {
  const superadmin = useSuperadmin() === true;
  const [documentos, setDocumentos] = useState<DocumentoBibliotecaListado[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setErrorCarga(false);
    fetch("/api/biblioteca")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: DocumentoBibliotecaListado[]) => setDocumentos(data))
      .catch(() => setErrorCarga(true));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const grupos = CATEGORIAS_BIBLIOTECA.map((c) => ({
    ...c,
    documentos: (documentos ?? []).filter((d) => d.categoria === c.id),
  })).filter((g) => g.documentos.length > 0);

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">Biblioteca</h1>
          <p className="text-slate-500">Documentación técnica de apoyo a la construcción.</p>
        </div>
        {superadmin && (
          <button
            onClick={() => setModalAbierto(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
          >
            <Upload className="w-4 h-4" />
            Subir documento
          </button>
        )}
      </div>

      {errorCarga ? (
        <p className="text-sm text-red-600 bg-white rounded-xl border border-slate-200 p-5">
          No se pudieron cargar los documentos. Recargá la página para intentar de nuevo.
        </p>
      ) : documentos === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando…
        </div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center bg-white rounded-xl border border-slate-200 py-16 px-6">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <BookOpen className="w-5 h-5 text-[#2563EB]" />
          </div>
          <h2 className="text-sm font-semibold text-[#1E293B] mb-1">Aún no hay documentos en la biblioteca.</h2>
          <p className="text-sm text-slate-500 max-w-sm">
            {superadmin
              ? "Subí normas, manuales técnicos o artículos con el botón «Subir documento»: los van a poder consultar y descargar todos los usuarios."
              : "Acá vas a encontrar normas, manuales técnicos y artículos de consulta para tus obras. Mientras tanto, tenés las referencias externas de abajo."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map((g) => (
            <section key={g.id}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                {g.nombre} <span className="text-slate-400 font-normal">({g.documentos.length})</span>
              </h2>
              <div className="space-y-3">
                {g.documentos.map((d) => (
                  <FilaDocumento
                    key={d.id}
                    documento={d}
                    superadmin={superadmin}
                    onEliminado={(id) => setDocumentos((prev) => (prev ? prev.filter((x) => x.id !== id) : prev))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Referencias externas</h2>
        <ListaReferencias items={referencias} />
      </section>

      {modalAbierto && (
        <ModalSubirDocumento
          onClose={() => setModalAbierto(false)}
          onSubido={() => {
            setModalAbierto(false);
            setToast("Documento agregado");
            cargar();
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-[10px] px-4 py-2.5 shadow-lg"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-800">{toast}</span>
        </div>
      )}
    </div>
  );
}

// ── Fila ───────────────────────────────────────────────────────────────

function FilaDocumento({
  documento,
  superadmin,
  onEliminado,
}: {
  documento: DocumentoBibliotecaListado;
  superadmin: boolean;
  onEliminado: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const ext = extensionArchivo(documento.nombreArchivo);

  const eliminar = async () => {
    setEliminando(true);
    try {
      const res = await fetch(`/api/biblioteca/${documento.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onEliminado(documento.id);
    } catch (err) {
      console.error("[eliminar documento de biblioteca]", err);
      window.alert("No se pudo eliminar el documento.");
      setEliminando(false);
      setConfirmando(false);
    }
  };

  return (
    <div className="flex items-start gap-3 sm:gap-4 bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
      <div
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center",
          ext === "pdf" ? "bg-red-50 text-red-600" : "bg-blue-50 text-[#2563EB]"
        )}
        aria-hidden
      >
        <FileText className="w-4 h-4" />
        <span className="text-[9px] font-bold uppercase leading-none mt-0.5">{ext}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1E293B] break-words">{documento.titulo}</p>
        {documento.descripcion && <p className="text-sm text-slate-500 mt-0.5 break-words">{documento.descripcion}</p>}
        <p className="text-xs text-slate-400 mt-1 tabular-nums">
          {formatearTamanio(documento.tamanio)} · {mesAnio(documento.creadoEn)}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
          <a
            href={urlDescargaBiblioteca(documento.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar
          </a>
          {superadmin &&
            (confirmando ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">¿Eliminar?</span>
                <button
                  onClick={eliminar}
                  disabled={eliminando}
                  className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md px-2 py-1 disabled:opacity-60"
                >
                  {eliminando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Sí"}
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  disabled={eliminando}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 rounded-md px-2 py-1"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmando(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Modal de subida ────────────────────────────────────────────────────

function ModalSubirDocumento({ onClose, onSubido }: { onClose: () => void; onSubido: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<CategoriaBiblioteca>("normas");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputArchivo = useRef<HTMLInputElement>(null);

  const elegirArchivo = (f: File | null) => {
    setError(null);
    if (!f) return setArchivo(null);
    if (!esArchivoBibliotecaValido(f.name)) {
      setArchivo(null);
      setError("Solo se aceptan archivos PDF, DOC o DOCX.");
    } else if (f.size > TAMANIO_MAXIMO_BIBLIOTECA) {
      setArchivo(null);
      setError(`El archivo pesa ${formatearTamanio(f.size)}: el máximo es 20 MB.`);
    } else {
      setArchivo(f);
    }
    if (inputArchivo.current) inputArchivo.current.value = "";
  };

  const puedeSubir = titulo.trim().length > 0 && archivo !== null && !subiendo;

  const subir = async () => {
    if (!archivo || !titulo.trim()) return;
    setSubiendo(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      form.append("titulo", titulo.trim());
      form.append("descripcion", descripcion.trim());
      form.append("categoria", categoria);
      const res = await fetch("/api/biblioteca", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo subir el documento. Probá de nuevo.");
      onSubido();
    } catch (err) {
      setError((err as Error).message);
      setSubiendo(false);
    }
  };

  const campo = "w-full rounded-[8px] border border-slate-200 px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={subiendo ? undefined : onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] bg-white rounded-[16px] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-[#1A3A5C]">Subir documento</h2>
          <button onClick={onClose} disabled={subiendo} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} autoFocus />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Descripción <span className="text-slate-400 font-normal">(opcional)</span>
            </span>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className={cn(campo, "resize-y")} />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Categoría</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaBiblioteca)} className={cn(campo, "bg-white")}>
              {CATEGORIAS_BIBLIOTECA.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="block text-xs font-medium text-slate-600 mb-1">Archivo</span>
            <input
              ref={inputArchivo}
              type="file"
              accept={ACCEPT_BIBLIOTECA}
              onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputArchivo.current?.click()}
              className="w-full flex items-center gap-3 rounded-[8px] border border-dashed border-slate-300 px-3 py-3 text-left hover:border-[#2563EB] hover:bg-blue-50/40 transition-colors"
            >
              <Upload className="w-4 h-4 text-slate-400 flex-shrink-0" />
              {archivo ? (
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#1E293B] truncate">{archivo.name}</span>
                  <span className="block text-xs text-slate-400">{formatearTamanio(archivo.size)} · Tocá para cambiarlo</span>
                </span>
              ) : (
                <span className="text-sm text-slate-500">Elegir archivo PDF, DOC o DOCX (máx. 20 MB)</span>
              )}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={subiendo}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={subir}
            disabled={!puedeSubir}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
          >
            {subiendo && <Loader2 className="w-4 h-4 animate-spin" />}
            {subiendo ? "Subiendo…" : "Subir documento"}
          </button>
        </div>
      </div>
    </div>
  );
}
