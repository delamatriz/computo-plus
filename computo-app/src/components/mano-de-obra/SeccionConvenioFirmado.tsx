"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { useSuperadmin } from "@/hooks/useSuperadmin";

// Tarjeta de consulta/descarga del PDF del convenio SUNCA firmado (Acta
// de Acuerdo completa) — distinto de la foto usada para extraer
// jornales con IA (esa vive en la sección de edición, más abajo). Sin
// paso de revisión: se sube y queda, un documento de referencia simple.
// Descargar es para todos; subir/reemplazar es solo del SUPERADMIN (el
// convenio es global — POST .../convenio-pdf lo exige).
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

export default function SeccionConvenioFirmado() {
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
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-[#2563EB]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#1E293B]">Descargar convenio firmado</h2>
          {!cargando && tieneArchivo && (
            <p className="text-xs text-slate-400 mt-0.5">Disponible para todos los usuarios de tu empresa.</p>
          )}
          <p className="text-sm text-slate-500 mt-0.5">
            Acta de Acuerdo — Consejo de Salarios, Grupo 9 Sub-Grupo 01, documento completo.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {!cargando && tieneArchivo && (
          <a
            href="/api/configuracion/convenio-pdf"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:underline"
          >
            <Download className="w-3.5 h-3.5" /> Descargar
          </a>
        )}
        {!cargando && !tieneArchivo && (
          <p className="text-sm text-slate-400">Sin PDF cargado todavía.</p>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {puedeSubir && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={subirArchivo}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={subiendo}
            className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors mt-3"
          >
            <Upload className="w-3 h-3" />
            {subiendo ? "Subiendo…" : tieneArchivo ? "Actualizar convenio" : "Subir convenio firmado"}
          </button>
        </>
      )}
    </div>
  );
}
