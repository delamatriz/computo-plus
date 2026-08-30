"use client";

import { AlertTriangle, Layers } from "lucide-react";

function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

// Espaciador invisible — mismo ancho + separación que el chevron de las
// tarjetas colapsables vecinas (Gastos Generales y Beneficio, Leyes
// Sociales/BPS: `gap-3` + `w-4 h-4`), para que el monto de las tarjetas
// SIN chevron quede en la misma columna vertical que el de las que sí
// tienen uno, en vez de correrse hacia la derecha.
function EspaciadorChevron() {
  return <span className="w-4 h-4 flex-shrink-0" aria-hidden="true" />;
}

// Tarjeta apilada suelta — mismo estilo que ya usaban Total/IVA antes de
// esta feature: fondo blanco, borde fino, sombra sutil, sin el peso visual
// de una tarjeta con borde grueso (eso queda reservado para "Precio Final").
function TarjetaSuelta({
  label,
  monto,
  moneda,
  prefijo,
  destacado = false,
  pesoMedio = false,
}: {
  label: string;
  monto: number;
  moneda: string;
  prefijo?: string;
  destacado?: boolean;
  pesoMedio?: boolean;
}) {
  if (destacado) {
    return (
      <div className="bg-white border-2 border-[#1A3A5C] rounded-lg px-5 py-4 flex justify-between items-center">
        <span className="text-sm font-semibold uppercase tracking-wide text-[#2563EB]">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-[#2563EB]">{fmtMoneda(monto, moneda)}</span>
          <EspaciadorChevron />
        </div>
      </div>
    );
  }
  if (pesoMedio) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-3 flex justify-between items-center">
        <span className="text-sm font-medium text-slate-700 uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-slate-900">{fmtMoneda(monto, moneda)}</span>
          <EspaciadorChevron />
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-5 py-3 flex justify-between items-center">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-base font-medium text-slate-700">
          {prefijo}
          {fmtMoneda(monto, moneda)}
        </span>
        <EspaciadorChevron />
      </div>
    </div>
  );
}

// 1ra tarjeta de la cascada — Costo Directo agregado del proyecto (Σ
// Materiales + Mano de Obra con Aportes Patronales + Equipos de cada
// rubro). "Gastos Generales y Beneficio" (componente aparte, con su propio
// desglose colapsable) va justo después de esta, y antes de
// TarjetaCostoTotalPrecioFinal — ver proyectos/[id]/page.tsx.
export function TarjetaCostoDirecto({
  moneda,
  costoDirecto,
  metodoCostoDirecto,
  rubrosSinApu,
}: {
  moneda: string;
  costoDirecto: number;
  // "estimado" si al menos un rubro no tiene APU propio (ver
  // calcularCostoDirectoAgregado en costoAgregado.ts) — ese rubro entra
  // completo como Costo Directo, sin poder separar cuánto sería Utilidad.
  metodoCostoDirecto: "apu" | "estimado";
  rubrosSinApu: number;
}) {
  return (
    <div className="flex flex-col gap-2 mt-2">
      {metodoCostoDirecto === "estimado" && (
        <div className="flex items-start gap-2 rounded-[8px] bg-amber-50 border border-amber-200 px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            {rubrosSinApu} rubro{rubrosSinApu !== 1 ? "s" : ""} sin Análisis de Precio Unitario — se usó su precio
            cargado a mano como Costo Directo completo, sin poder separar cuánto de eso sería Utilidad.
          </p>
        </div>
      )}
      {/* Misma jerarquía visual que el header de "Gastos Generales y
          Beneficio" (icono + título bold azul oscuro uppercase, monto
          bold azul brillante) — antes usaba TarjetaSuelta default, que
          la dejaba con menos peso visual que la tarjeta siguiente en la
          misma cascada. */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-[#2563EB]" />
          <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Costo Directo</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-[#2563EB] tabular-nums">{fmtMoneda(costoDirecto, moneda)}</span>
          <EspaciadorChevron />
        </div>
      </div>
    </div>
  );
}

// Últimas 3 tarjetas de la cascada — Costo Total = Costo Directo + el
// monto combinado de "Gastos Generales y Beneficio" (Costos Indirectos +
// Utilidad, ya sumados en ese componente) — sin ninguna línea intermedia
// adicional (no existe "Base Imponible" como concepto separado).
export function TarjetaCostoTotalPrecioFinal({
  moneda,
  costoDirecto,
  montoGastosGeneralesYBeneficio,
}: {
  moneda: string;
  costoDirecto: number;
  montoGastosGeneralesYBeneficio: number;
}) {
  const costoTotal = costoDirecto + montoGastosGeneralesYBeneficio;
  const montoIVA = costoTotal * 0.22;
  const precioFinal = costoTotal * 1.22;

  return (
    <div className="flex flex-col gap-2 mt-2">
      <TarjetaSuelta label="Costo Total" monto={costoTotal} moneda={moneda} pesoMedio />
      <TarjetaSuelta label="IVA (22%)" monto={montoIVA} moneda={moneda} prefijo="+ " />
      <TarjetaSuelta label="Precio Final" monto={precioFinal} moneda={moneda} destacado />
    </div>
  );
}
