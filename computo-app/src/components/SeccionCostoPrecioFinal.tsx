"use client";

import { AlertTriangle, Layers } from "lucide-react";
import { RESERVA_COLA_TABLA } from "@/lib/layoutTablaPresupuesto";

function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

// Espaciador invisible — reserva el mismo ancho de cola que la tabla de
// capítulos/rubros (COL_PCT + COL_ACCION × 2, ver layoutTablaPresupuesto.ts)
// después del monto, menos el gap-3 (12px) que ya separa el monto de este
// espaciador en el flex de cada tarjeta — así el borde derecho del monto
// queda en la misma columna vertical que el TOTAL de la tabla, en vez de
// alinearse solo contra el chevron de las tarjetas colapsables vecinas
// (que era la referencia anterior, antes de esta corrección).
function EspaciadorChevron() {
  return <span style={{ width: `calc(${RESERVA_COLA_TABLA} - 12px)` }} className="flex-shrink-0" aria-hidden="true" />;
}

// Tarjeta apilada suelta — fondo blanco, borde fino, sombra sutil, sin el
// peso visual de una tarjeta con borde grueso (eso queda reservado para
// "Precio Final", la única realmente "destacada" de la cascada, con su
// monto a propósito más grande que su título — es el número final de
// toda la obra). En el resto (Costo Total acá; Costo Directo, Gastos
// Generales y Leyes Sociales/BPS en sus propios archivos), el monto en
// negrita usa el MISMO tamaño que su título — antes se veía más grande,
// desequilibrando la fila. IVA no entra en esta variante — su monto no
// es negrita, queda con su propio tamaño sin tocar (ver JSX inline en
// TarjetaCostoTotalPrecioFinal).
function TarjetaSuelta({
  label,
  monto,
  moneda,
  destacado = false,
}: {
  label: string;
  monto: number;
  moneda: string;
  destacado?: boolean;
}) {
  if (destacado) {
    return (
      <div className="bg-white border-2 border-[#1A3A5C] rounded-lg px-5 py-4 flex justify-between items-center">
        <span className="text-sm font-bold uppercase tracking-wide text-[#2563EB]">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-[#2563EB]">{fmtMoneda(monto, moneda)}</span>
          <EspaciadorChevron />
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-5 py-3 flex justify-between items-center">
      <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-slate-900">{fmtMoneda(monto, moneda)}</span>
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
      {/* Mismo peso tipográfico que el header de "Gastos Generales y
          Beneficio" (icono + título bold azul oscuro uppercase) — el
          monto va en negro, no azul: el azul acento (#2563EB) queda
          reservado solo para Precio Final y Leyes Sociales/BPS, las
          únicas 2 tarjetas de la cascada que lo llevan. */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-[#2563EB]" />
          <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Costo Directo</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtMoneda(costoDirecto, moneda)}</span>
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
      <TarjetaSuelta label="Costo Total" monto={costoTotal} moneda={moneda} />
      {/* IVA no lleva monto en negrita (sigue font-semibold, no bold) —
          pero mismo tamaño que el resto de la cascada (text-sm), para
          no desequilibrar la fila. */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-3 flex justify-between items-center">
        <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">IVA (22%)</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-900">+ {fmtMoneda(montoIVA, moneda)}</span>
          <EspaciadorChevron />
        </div>
      </div>
      <TarjetaSuelta label="Precio Final" monto={precioFinal} moneda={moneda} destacado />
    </div>
  );
}
