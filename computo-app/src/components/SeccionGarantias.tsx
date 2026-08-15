"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, ChevronDown, ChevronRight, Landmark } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  fielCumplimiento: string;
  viciosOcultos: string;
  responsabilidad: string;
  onChangeFielCumplimiento: (v: string) => void;
  onChangeViciosOcultos: (v: string) => void;
  onChangeResponsabilidad: (v: string) => void;
  /** "PRIVADA" | "PUBLICA" — solo si es pública se muestra el bloque de RUPE/umbrales. */
  tipoContratacion: string;
  totalGeneral: number;
  moneda: string;
}

// Umbrales TOCAF 2026 (arts. 64 y 66) — valores de referencia, se
// actualizan una vez al año por IPC. Ver guía completa en
// /referencias#guia-obra-publica.
const UMBRAL_MANTENIMIENTO_OFERTA = 13_705_000;
const UMBRAL_FIEL_CUMPLIMIENTO = 5_482_000;
const PORCENTAJE_FIEL_CUMPLIMIENTO = 0.05;

function fmtMonedaUYU(v: number): string {
  return `$ ${Math.round(v).toLocaleString("es-UY")}`;
}

function SeccionGarantiasObraPublica({ totalGeneral, moneda }: { totalGeneral: number; moneda: string }) {
  const monedaDistinta = moneda !== "UYU";
  const superaMantenimientoOferta = !monedaDistinta && totalGeneral > UMBRAL_MANTENIMIENTO_OFERTA;
  const superaFielCumplimiento = !monedaDistinta && totalGeneral > UMBRAL_FIEL_CUMPLIMIENTO;
  const montoFielCumplimiento = totalGeneral * PORCENTAJE_FIEL_CUMPLIMIENTO;

  return (
    <div className="space-y-3 pb-5 border-b border-slate-200">
      <div className="flex items-center gap-2">
        <Landmark className="w-4 h-4 text-[#2563EB]" />
        <h3 className="text-sm font-bold text-[#1A3A5C]">Garantías y RUPE — Obra Pública</h3>
      </div>

      <div className="rounded-[10px] bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900">
        Para ofertar o contratar con el Estado tenés que estar inscripto y activo en el RUPE
        (Registro Único de Proveedores del Estado).
      </div>

      {monedaDistinta ? (
        <div className="rounded-[10px] bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
          Los umbrales de garantías están fijados en pesos uruguayos (UYU) y este proyecto está en{" "}
          {moneda} — convertí el total antes de definir las garantías correspondientes.
        </div>
      ) : (
        <>
          {superaFielCumplimiento && (
            <div className="flex items-start gap-2 rounded-[10px] bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <span>
                Este presupuesto supera los {fmtMonedaUYU(UMBRAL_FIEL_CUMPLIMIENTO)} — corresponde
                garantía de <strong>fiel cumplimiento del contrato</strong>: 5% del total ={" "}
                <strong>{fmtMonedaUYU(montoFielCumplimiento)}</strong>.
              </span>
            </div>
          )}
          {superaMantenimientoOferta && (
            <div className="flex items-start gap-2 rounded-[10px] bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <span>
                Este presupuesto supera los {fmtMonedaUYU(UMBRAL_MANTENIMIENTO_OFERTA)} —
                corresponde garantía de <strong>mantenimiento de oferta</strong> (el monto lo
                determina la Administración en el pliego).
              </span>
            </div>
          )}
          {!superaFielCumplimiento && !superaMantenimientoOferta && (
            <div className="rounded-[10px] bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
              Por el monto actual de este presupuesto, no correspondería constituir garantías de
              licitación.
            </div>
          )}
        </>
      )}

      <Link
        href="/referencias#guia-obra-publica"
        className="inline-block text-sm font-medium text-[#2563EB] hover:underline"
      >
        Ver guía completa de Obra Pública →
      </Link>
    </div>
  );
}

export const TEXTO_LEGAL_RESPONSABILIDAD_DEFAULT =
  "Conforme al artículo 1844 del Código Civil (Ley 19.726): 10 años por defectos estructurales, " +
  "5 años por vicios de menor entidad y 2 años por defectos de terminación y acabado, contados " +
  "desde la recepción de la obra.";

function CampoGarantia({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#1A3A5C] mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-[10px] border border-slate-200 bg-white p-3.5 text-sm text-slate-700 leading-relaxed placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 resize-y"
      />
    </div>
  );
}

export default function SeccionGarantias({
  fielCumplimiento,
  viciosOcultos,
  responsabilidad,
  onChangeFielCumplimiento,
  onChangeViciosOcultos,
  onChangeResponsabilidad,
  tipoContratacion,
  totalGeneral,
  moneda,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Garantías</h2>
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
            <div className="px-5 py-5 space-y-5" style={{ background: "#F8FAFC" }}>
              {tipoContratacion === "PUBLICA" && (
                <SeccionGarantiasObraPublica totalGeneral={totalGeneral} moneda={moneda} />
              )}
              <CampoGarantia
                label="Garantía de fiel cumplimiento"
                value={fielCumplimiento}
                placeholder="Especificá las condiciones de garantía de fiel cumplimiento"
                onChange={onChangeFielCumplimiento}
              />
              <CampoGarantia
                label="Garantía por vicios ocultos"
                value={viciosOcultos}
                placeholder="Especificá la garantía por vicios ocultos"
                onChange={onChangeViciosOcultos}
              />
              <CampoGarantia
                label="Responsabilidad por defectos de construcción (Art. 1844)"
                value={responsabilidad}
                placeholder={TEXTO_LEGAL_RESPONSABILIDAD_DEFAULT}
                onChange={onChangeResponsabilidad}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
