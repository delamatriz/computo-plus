"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, HardHat, Loader2 } from "lucide-react";

// Obras en curso — proyectos EN_CURSO de la empresa con su avance certificado
// (ver GET /api/obras-en-curso) y acceso directo a la pestaña Gestión de Obra.

interface ObraEnCurso {
  id: string;
  nombre: string;
  cliente: string | null;
  avancePct: number | null;
  cantidadCertificaciones: number;
  ultimaCertificacion: { numero: number; fecha: string } | null;
}

function fmtPct(v: number): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

export default function ObrasEnCursoPage() {
  const [obras, setObras] = useState<ObraEnCurso[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/obras-en-curso", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fallo"))))
      .then((data: ObraEnCurso[]) => setObras(data))
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-1">Obras en curso</h1>
        <p className="text-slate-500 text-sm">
          Tus proyectos en ejecución, con el avance certificado hasta hoy.
          {obras && obras.length > 0 && (
            <span className="text-slate-400"> {obras.length} {obras.length === 1 ? "obra" : "obras"}.</span>
          )}
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudieron cargar las obras. Probá de nuevo en un momento.
        </div>
      ) : obras === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando obras…
        </div>
      ) : obras.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-slate-200 border-dashed py-16 px-6">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <HardHat className="w-6 h-6 text-[#2563EB]" />
          </div>
          <p className="text-base font-semibold text-[#1A3A5C]">No tenés obras en curso</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {obras.map((o) => (
            <li key={o.id} className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-[#1E293B] truncate">{o.nombre.trim()}</p>
                {o.cliente && <p className="text-xs text-slate-400 truncate mt-0.5">{o.cliente}</p>}
                {o.avancePct != null ? (
                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.round(o.avancePct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${o.avancePct}%` }} />
                    </div>
                    <span className="text-sm font-bold text-[#2563EB] tabular-nums w-14 text-right">{fmtPct(o.avancePct)}%</span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Sin certificaciones</p>
                )}
                {o.ultimaCertificacion && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    Última certificación: Nº {o.ultimaCertificacion.numero} · {fmtFecha(o.ultimaCertificacion.fecha)}
                  </p>
                )}
              </div>
              <Link
                href={`/proyectos/${encodeURIComponent(o.id)}?tab=gestion-obra`}
                className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1A3A5C] text-white text-sm font-medium px-4 py-2.5 transition-colors"
              >
                <ArrowRight className="w-4 h-4" /> Gestión de Obra
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
