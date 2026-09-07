"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";

// Tarjeta de consulta/descarga del PDF del convenio SUNCA firmado (Acta
// de Acuerdo completa) — distinto de la foto usada para extraer
// jornales con IA (esa vive en la sección de edición, más abajo). Sin
// paso de revisión: se sube y queda, un documento de referencia simple.
export default function SeccionConvenioFirmado() {
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
        if (!res.ok) throw new Error();
        setTieneArchivo(true);
      } catch {
        setError("No se pudo subir el archivo. Probá de nuevo.");
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
            <Download className="w-3.5 h-3.5" /> Descargar PDF
          </a>
        )}
        {!cargando && !tieneArchivo && (
          <p className="text-sm text-slate-400">Sin PDF cargado todavía.</p>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

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
        {subiendo ? "Subiendo…" : tieneArchivo ? "Reemplazar PDF" : "Subir PDF"}
      </button>
    </div>
  );
}
