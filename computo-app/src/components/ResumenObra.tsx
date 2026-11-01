"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { presupuestoContratado } from "@/lib/presupuestoContratado";

// Resumen de la obra al tope de Gestión de Obra: de qué proyecto se trata,
// cuánto vale y en qué estado está, sin tener que ir a buscarlo. Proyecto,
// presupuesto y forma de realización llegan de la página (ya en memoria);
// comitente, contratista y contrato firmado se leen de
// /api/proyectos/[id]/contrato (las mismas "Partes" que Contrato de Obra).

const TIPO_OBRA_LABEL: Record<string, string> = {
  REPARACIONES: "Reparaciones",
  REFORMA: "Reforma / Ampliación",
  VIVIENDA: "Vivienda unifamiliar",
  PH: "Propiedad Horizontal",
  COMERCIAL: "Local comercial",
  INDUSTRIAL: "Industrial",
};

const ESTADO_LABEL: Record<string, string> = {
  EN_CURSO: "En curso",
  FINALIZADO: "Finalizado",
  ANTEPROYECTO: "Anteproyecto",
  PAUSADO: "Pausado",
};

const ESTADO_CLASES: Record<string, string> = {
  EN_CURSO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FINALIZADO: "bg-slate-100 text-slate-600 border-slate-200",
  ANTEPROYECTO: "bg-violet-50 text-violet-700 border-violet-200",
  PAUSADO: "bg-amber-50 text-amber-700 border-amber-200",
};

interface Props {
  proyectoId: string;
  nombre: string;
  tipo: string;
  estado: string;
  fechaInicio: string | null; // ya formateada
  plazoObraMeses: number | null;
  presupuesto: number; // Precio Final (con IVA)
  sumaRubros: number; // Σ cantidad × precioUnit, sin IVA
  moneda: string;
  formaRealizacion: string | null;
  cuantia: ReactNode;
  tipoContratacion: string;
}

interface DatosContrato {
  comitente: string | null;
  contratista: string | null;
  montoContrato: number | null;
  monedaContrato: string;
}

function fmtMoneda(v: number, moneda: string): string {
  return `${moneda === "USD" ? "US$" : "$"} ${Math.round(v).toLocaleString("es-UY")}`;
}

export default function ResumenObra(props: Props) {
  const { proyectoId, nombre, tipo, estado, fechaInicio, plazoObraMeses, presupuesto, moneda } = props;
  const [contrato, setContrato] = useState<DatosContrato | null>(null);
  // Hasta que responde /contrato no se sabe si hay contrato: no mostrar el
  // fallback (suma de rubros) para cambiarlo un segundo después.
  const [contratoCargado, setContratoCargado] = useState(false);

  useEffect(() => {
    let vigente = true;
    fetch(`/api/proyectos/${proyectoId}/contrato`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vigente || !d) return;
        const c = d.partes?.cliente;
        setContrato({
          comitente: c?.razonSocial?.trim() || c?.nombre?.trim() || null,
          contratista: d.partes?.empresa?.nombre ?? null,
          montoContrato: d.contrato?.monto ?? null,
          monedaContrato: d.contrato?.moneda ?? moneda,
        });
      })
      .catch((err) => console.error("[resumen-obra] error cargando contrato", err))
      .finally(() => {
        if (vigente) setContratoCargado(true);
      });
    return () => {
      vigente = false;
    };
  }, [proyectoId, moneda]);

  // Misma definición que Certificaciones, Liquidación y Control de Costos.
  const contratado = presupuestoContratado(
    contrato ? { monto: contrato.montoContrato, moneda: contrato.monedaContrato } : null,
    props.sumaRubros,
    moneda
  );

  const sinDefinir = <span className="font-normal text-slate-400">A definir</span>;

  return (
    <div className="bg-white border border-slate-300 rounded-[16px] shadow-sm px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Resumen de la obra</p>
          <h2 className="text-lg font-bold text-[#1A3A5C] leading-tight mt-0.5 break-words">{nombre}</h2>
          <p className="text-sm text-slate-600 mt-0.5">{TIPO_OBRA_LABEL[tipo] ?? tipo}</p>
        </div>
        <span
          className={cn(
            "text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0",
            ESTADO_CLASES[estado] ?? ESTADO_CLASES.EN_CURSO
          )}
        >
          {ESTADO_LABEL[estado] ?? estado}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-slate-100">
        <Dato label="Presupuesto contratado" destacado>
          {!contratoCargado ? (
            <span className="font-normal text-slate-400">…</span>
          ) : contratado.monto > 0 ? (
            fmtMoneda(contratado.monto, moneda)
          ) : (
            sinDefinir
          )}
          {contratoCargado && contratado.monto > 0 && (
            <span className="block text-[11px] font-normal text-slate-500">
              {contratado.fuente === "contrato" ? "Monto del contrato firmado" : "Suma de rubros, sin IVA (sin contrato)"}
            </span>
          )}
        </Dato>
        <Dato label="Presupuesto de obra">
          {presupuesto > 0 ? fmtMoneda(presupuesto, moneda) : sinDefinir}
          {presupuesto > 0 && <span className="block text-[11px] font-normal text-slate-500">Precio final, con IVA</span>}
        </Dato>
        <Dato label="Comitente">{contrato?.comitente ?? sinDefinir}</Dato>
        <Dato label="Contratista">{contrato?.contratista ?? sinDefinir}</Dato>
        <Dato label="Fecha de inicio">{fechaInicio ?? sinDefinir}</Dato>
        <Dato label="Plazo de obra">
          {plazoObraMeses ? `${plazoObraMeses} ${plazoObraMeses === 1 ? "mes" : "meses"}` : sinDefinir}
        </Dato>
        <Dato label="Forma de realización">{props.formaRealizacion ?? sinDefinir}</Dato>
        <Dato label="Tipo de contratación">{props.tipoContratacion}</Dato>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100">
        <Dato label="Cuantía (calculada del presupuesto)">{props.cuantia}</Dato>
      </div>
    </div>
  );
}

function Dato({ label, children, destacado }: { label: string; children: ReactNode; destacado?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      <div className={cn("text-sm font-semibold break-words", destacado ? "text-[#2563EB]" : "text-[#1A3A5C]")}>{children}</div>
    </div>
  );
}
