"use client";

import { useState } from "react";

// IVA de compras de materiales del proyecto (Proyecto.descuentaIvaCompras).
// Los precios de materiales se cargan como los da la barraca, con IVA. Una
// empresa contribuyente de IVA lo recupera con la factura de compra: al costo
// entra el precio ÷ 1,22 y el 22% va una sola vez, en la línea de IVA de
// arriba. Una empresa literal E o monotributista no lo descuenta.
//
// Cambiarlo pasa por una vista previa (POST /descuento-iva con dryRun) que
// muestra cuánto se mueve el Precio Final antes de escribir nada — mismo
// flujo que "Aplicar aportes patronales a rubros existentes".

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

  const diferencia = vista ? vista.despues.precioFinal - vista.antes.precioFinal : 0;
  const pct = vista && vista.antes.precioFinal > 0 ? (diferencia / vista.antes.precioFinal) * 100 : 0;

  return (
    <div className="px-5 -mt-1 text-xs text-slate-500">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          {descuentaIvaCompras
            ? "Materiales: el IVA de compra se descuenta con la factura (al costo entra el precio ÷ 1,22)."
            : "Materiales: el IVA de compra queda dentro del costo (no se descuenta)."}
        </span>
        {!soloLectura && !vista && (
          <button
            type="button"
            onClick={verCambio}
            disabled={consultando}
            className="font-medium text-[#2563EB] hover:text-[#1D4ED8] disabled:opacity-50"
          >
            {consultando ? "Calculando…" : descuentaIvaCompras ? "No descontar" : "Descontar IVA de compras"}
          </button>
        )}
      </div>

      {vista && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-3 space-y-2 text-slate-600">
          {vista.actualizarian === 0 ? (
            <p>
              {activar
                ? "No hay rubros con desglose para recalcular. Los rubros nuevos ya van a descontar el IVA."
                : "No hay rubros con desglose para recalcular. Los rubros nuevos van a dejar el IVA dentro del costo."}
            </p>
          ) : (
            <p>
              Precio Final: <span className="tabular-nums">{fmt(vista.antes.precioFinal, moneda)}</span> →{" "}
              <span className="font-semibold text-slate-900 tabular-nums">{fmt(vista.despues.precioFinal, moneda)}</span>{" "}
              <span className="tabular-nums">
                ({pct >= 0 ? "+" : ""}
                {pct.toLocaleString("es-UY", { maximumFractionDigits: 1 })}%)
              </span>
              . Se recalculan {vista.actualizarian} {vista.actualizarian === 1 ? "rubro" : "rubros"}.
            </p>
          )}
          {vista.protegidos.length > 0 && (
            <p>
              {vista.protegidos.length} {vista.protegidos.length === 1 ? "rubro tiene" : "rubros tienen"} precio pactado
              en la última entrega y no se {vista.protegidos.length === 1 ? "toca" : "tocan"}.
            </p>
          )}
          {vista.sinApu > 0 && (
            <p>
              {vista.sinApu} {vista.sinApu === 1 ? "rubro sin desglose queda" : "rubros sin desglose quedan"} con su
              precio cargado a mano.
            </p>
          )}
          {vista.requiereConfirmacion && (
            <label className="flex items-start gap-2 text-amber-700">
              <input
                type="checkbox"
                checked={confirmaContrato}
                onChange={(e) => setConfirmaContrato(e.target.checked)}
                className="mt-0.5"
              />
              <span>Este proyecto ya tiene contrato, órdenes de compra o certificaciones. Entiendo que cambian los precios.</span>
            </label>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={aplicar}
              disabled={aplicando || (vista.requiereConfirmacion && !confirmaContrato)}
              className="rounded-md bg-[#2563EB] px-3 py-1.5 font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              {aplicando ? "Aplicando…" : "Aplicar"}
            </button>
            <button
              type="button"
              onClick={() => { setVista(null); setConfirmaContrato(false); }}
              disabled={aplicando}
              className="font-medium text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </div>
  );
}
