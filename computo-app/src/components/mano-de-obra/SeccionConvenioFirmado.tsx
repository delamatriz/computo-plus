"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Upload } from "lucide-react";
import { useSuperadmin } from "@/hooks/useSuperadmin";

// Las dos tarjetas del convenio SUNCA de /mano-de-obra, en un solo componente
// para que compartan el estado del PDF (subirlo a la izquierda habilita la
// descarga a la derecha sin recargar):
//   - Izquierda: el convenio vigente en el sitio del SUNCA (link externo) y,
//     para el SUPERADMIN, "Subir convenio a CÓMPUTO+".
//   - Derecha: descargar el PDF del convenio firmado (Acta de Acuerdo
//     completa), para todos.
// Es distinto de la foto usada para extraer jornales con IA (esa vive en el
// Catálogo maestro de jornales, más abajo). Sin paso de revisión: se sube y
// queda. Subir/reemplazar es solo del SUPERADMIN (el convenio es global —
// POST .../convenio-pdf lo exige).
// Debajo del tope de la petición (next.config.ts: 40 MB, y el base64 pesa ~33 % más que el archivo).
const TOPE_PDF_BYTES = 25 * 1024 * 1024;
const MENSAJE_ERROR_SUBIDA_GENERICO = "No se pudo subir el archivo. Probá de nuevo.";
// Códigos que devuelve POST /api/configuracion/convenio-pdf.
const MENSAJES_ERROR_SUBIDA: Record<string, string> = {
  no_es_pdf: "El archivo tiene que ser un PDF.",
  cuerpo_invalido: "El archivo llegó incompleto al servidor — probablemente es demasiado pesado. Probá con un PDF más liviano.",
  blob_sin_token: "El servidor no tiene configurado el almacenamiento de archivos (falta BLOB_READ_WRITE_TOKEN).",
  blob_error: "El almacenamiento de archivos rechazó la subida — el detalle está en el log del servidor.",
};

const URL_SUNCA = "https://www.sunca.com.uy";

export default function SeccionConvenioFirmado({
  fechaConvenio,
}: {
  // Fecha de vigencia del convenio cargado (dd/mm/aaaa), o null si no hay.
  fechaConvenio: string | null;
}) {
  // null (cargando) cuenta como "no": sin flash del botón de subir.
  const puedeSubir = useSuperadmin() === true;
  const [tieneArchivo, setTieneArchivo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado) setTieneArchivo(!!data.convenioPdfUrl);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    e.target.value = "";
    if (archivo.size > TOPE_PDF_BYTES) {
      setError(`El PDF pesa más de ${TOPE_PDF_BYTES / (1024 * 1024)} MB — probá con uno más liviano.`);
      return;
    }

    setSubiendo(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/configuracion/convenio-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archivo: reader.result }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(MENSAJES_ERROR_SUBIDA[data?.error as string] ?? MENSAJE_ERROR_SUBIDA_GENERICO);
          return;
        }
        setTieneArchivo(true);
      } catch {
        setError(MENSAJE_ERROR_SUBIDA_GENERICO);
      } finally {
        setSubiendo(false);
      }
    };
    reader.onerror = () => {
      setError("No se pudo leer el archivo.");
      setSubiendo(false);
    };
    reader.readAsDataURL(archivo);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
      {/* Izquierda — convenio vigente en el SUNCA (+ subir, SUPERADMIN) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
        <h2 className="text-sm font-semibold text-[#1E293B]">
          Convenio firmado SUNCA{fechaConvenio ? ` (${fechaConvenio})` : ""}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {/* Subir es solo del SUPERADMIN: al resto no se le pide. */}
          {puedeSubir
            ? "Descargá el convenio vigente del sitio del SUNCA y subilo a CÓMPUTO+ para que puedan consultarlo."
            : "Consultá el convenio vigente en el sitio del SUNCA."}
        </p>
        <a
          href={URL_SUNCA}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 self-start text-sm font-medium text-[#2563EB] hover:underline"
        >
          sunca.com.uy <ExternalLink className="w-3.5 h-3.5" />
        </a>

        {puedeSubir && (
          <>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={subirArchivo} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendo}
              className="mt-3 inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-[8px] border border-slate-200 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-[#1E293B] disabled:opacity-50 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {subiendo ? "Subiendo…" : "Subir convenio a CÓMPUTO+"}
            </button>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </>
        )}
      </div>

      {/* Derecha — descargar el PDF cargado */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#1E293B]">Decreto del Convenio firmado</h2>
            {/* Sin PDF, el aviso va solo abajo, en el lugar del botón. */}
            {!cargando && tieneArchivo && <p className="text-sm text-slate-500 mt-0.5">Documento disponible para tu empresa.</p>}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          {!cargando && tieneArchivo && (
            <a
              href="/api/configuracion/convenio-pdf"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:underline"
            >
              <Download className="w-3.5 h-3.5" /> Descargar PDF
            </a>
          )}
          {!cargando && !tieneArchivo && <p className="text-sm text-slate-400">Sin PDF cargado todavía.</p>}
        </div>
      </div>
    </div>
  );
}
