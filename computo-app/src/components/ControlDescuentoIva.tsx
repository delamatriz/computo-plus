"use client";

import { useState } from "react";
import { Info } from "lucide-react";

// IVA de compras de materiales del proyecto (Proyecto.descuentaIvaCompras).
// Los precios de materiales se cargan como los da la barraca, con IVA. Una
// empresa contribuyente de IVA lo recupera con la factura de compra: al costo
// entra el precio ÷ 1,22 y el 22% va una sola vez, en la línea de IVA de
// arriba. Una empresa literal E o monotributista no lo descuenta.
//
// Cambiarlo pasa por una vista previa (POST /descuento-iva con dryRun) que
// muestra cuánto se mueve el Precio Final antes de escribir nada — mismo
// flujo que "Aplicar aportes patronales a rubros existentes". Los textos
// están pensados para quien no conoce el mecanismo: qué significa, cuándo
// corresponde y qué cambia en este proyecto.

interface Vista {
  actualizarian: number;
  protegidos: { rubroId: string; codigo: string; descripcion: string }[];
  sinApu: number;
  antes: { costoTotal: number; precioFinal: number };
  despues: { costoTotal: number; precioFinal: number };
  requiereConfirmacion: boolean;
}

function fmt(v: number, moneda: string): string {
  const n = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${n}` : `$ ${n}`;
}

export default function ControlDescuentoIva({
  proyectoId,
  descuentaIvaCompras,
  moneda,
  soloLectura,
}: {
  proyectoId: string;
  descuentaIvaCompras: boolean;
  moneda: string;
  soloLectura: boolean;
}) {
  const [vista, setVista] = useState<Vista | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [confirmaContrato, setConfirmaContrato] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activar = !descuentaIvaCompras;

  async function pedir(dryRun: boolean) {
    const res = await fetch(`/api/proyectos/${proyectoId}/descuento-iva`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activar, dryRun, confirmarContrato: confirmaContrato }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok || d?.error) throw new Error(d?.mensaje ?? "No se pudo completar. Probá de nuevo.");
    return d;
  }

  async function verCambio() {
    setError(null);
    setConsultando(true);
    try {
      setVista(await pedir(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo calcular la vista previa.");
    } finally {
      setConsultando(false);
    }
  }

  async function aplicar() {
    setError(null);
    setAplicando(true);
    try {
      await pedir(false);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar el cambio.");
      setAplicando(false);
    }
  }

  function cancelar() {
    setVista(null);
    setConfirmaContrato(false);
  }

  const diferencia = vista ? vista.despues.precioFinal - vista.antes.precioFinal : 0;
  const pct = vista && vista.antes.precioFinal > 0 ? (diferencia / vista.antes.precioFinal) * 100 : 0;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600">
      {/* Estado actual, en una línea */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
          <p>
            {/* Mismas palabras que el botón de la vista previa ("Sí, materiales
                sin IVA / con IVA"), para que se lea de un vistazo cómo está
                calculado el Precio Final de arriba. */}
            <span className="font-semibold text-slate-700">
              {descuentaIvaCompras ? "Materiales sin IVA." : "Materiales con IVA."}{" "}
            </span>
            {descuentaIvaCompras
              ? "El IVA que pagás en la barraca lo recuperás con la factura de compra: no está en el costo y se cobra una sola vez, en la línea de IVA de arriba."
              : "El costo incluye el IVA que pagás en la barraca."}
          </p>
        </div>
        {!soloLectura && !vista && (
          <button
            type="button"
            onClick={verCambio}
            disabled={consultando}
            className="text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] disabled:opacity-50 whitespace-nowrap"
          >
            {consultando ? "Calculando…" : "Cambiar"}
          </button>
        )}
      </div>

      {/* Panel de cambio: qué significa, cuándo corresponde y qué cambia acá */}
      {vista && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
          <p className="font-semibold text-slate-800">
            {activar ? "¿Calcular los materiales sin IVA?" : "¿Calcular los materiales con IVA?"}
          </p>

          <p>
            Los precios de los materiales son los de la barraca, que ya traen IVA.{" "}
            {activar
              ? "Si tu empresa es contribuyente de IVA, ese IVA lo recuperás con la factura de compra: no es un costo tuyo. Al descontarlo, cada material se cuenta sin IVA (precio ÷ 1,22) y el IVA aparece una sola vez, al final del presupuesto."
              : "Si tu empresa es literal E o monotributista, ese IVA no lo recuperás: es parte de tu costo y el material se cuenta entero."}
          </p>

          {activar && (
            <p className="text-slate-500">
              No corresponde si tu empresa es literal E o monotributista: en ese caso dejalo como está.
            </p>
          )}

          {/* Qué cambia en este proyecto */}
          <div className="rounded-md bg-slate-50 px-4 py-3 space-y-1.5">
            {vista.actualizarian > 0 ? (
              <p>
                <span className="font-semibold text-slate-700">En este proyecto: </span>
                el Precio Final pasa de <span className="tabular-nums">{fmt(vista.antes.precioFinal, moneda)}</span> a{" "}
                <span className="font-semibold text-slate-900 tabular-nums">{fmt(vista.despues.precioFinal, moneda)}</span>{" "}
                <span className="tabular-nums">
                  ({pct >= 0 ? "+" : ""}
                  {pct.toLocaleString("es-UY", { maximumFractionDigits: 1 })}%)
                </span>
                .
              </p>
            ) : (
              <p>
                <span className="font-semibold text-slate-700">En este proyecto: </span>
                el Precio Final no cambia ahora, porque los rubros que tiene no tienen materiales cargados en su detalle
                (su precio se cargó directo). Se aplica a los rubros que agregues de acá en adelante.
              </p>
            )}
            {vista.actualizarian > 0 && vista.sinApu > 0 && (
              <p className="text-slate-500">
                {vista.sinApu} {vista.sinApu === 1 ? "rubro con el precio cargado directo no cambia" : "rubros con el precio cargado directo no cambian"}.
              </p>
            )}
            {vista.protegidos.length > 0 && (
              <p className="text-slate-500">
                {vista.protegidos.length}{" "}
                {vista.protegidos.length === 1
                  ? "rubro con precio ya entregado al cliente no cambia"
                  : "rubros con precio ya entregado al cliente no cambian"}
                .
              </p>
            )}
          </div>

          {vista.requiereConfirmacion && (
            <label className="flex items-start gap-2 text-amber-700">
              <input
                type="checkbox"
                checked={confirmaContrato}
                onChange={(e) => setConfirmaContrato(e.target.checked)}
                className="mt-1"
              />
              <span>Este proyecto ya tiene contrato, órdenes de compra o certificaciones. Entiendo que cambian los precios.</span>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={aplicar}
              disabled={aplicando || (vista.requiereConfirmacion && !confirmaContrato)}
              className="rounded-md bg-[#2563EB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              {aplicando ? "Aplicando…" : activar ? "Sí, materiales sin IVA" : "Sí, materiales con IVA"}
            </button>
            <button
              type="button"
              onClick={cancelar}
              disabled={aplicando}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </div>
  );
}
