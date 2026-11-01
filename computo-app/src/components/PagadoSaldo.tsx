import { cn } from "@/lib/utils";

// Pagado / saldo de un subcontrato u orden de compra, con los pagos de Flujo
// de Caja vinculados a esa entidad. Solo cuenta los pagos en la misma moneda
// del monto; si hay pagos en otra moneda se avisa aparte.

function fmt(v: number, moneda: string): string {
  return `${moneda === "USD" ? "US$" : "$"} ${Math.round(v).toLocaleString("es-UY")}`;
}

export default function PagadoSaldo({
  monto,
  moneda,
  pagos,
}: {
  monto: number;
  moneda: string;
  pagos: Record<string, number> | undefined;
}) {
  const pagado = pagos?.[moneda] ?? 0;
  const otras = Object.entries(pagos ?? {}).filter(([m, v]) => m !== moneda && v !== 0);
  const saldo = monto - pagado;
  return (
    <div className="text-[11px] text-right leading-tight space-y-0.5" title="Pagos vinculados en Flujo de Caja">
      <p className="text-slate-500">
        Pagado <span className="font-semibold tabular-nums text-emerald-700">{fmt(pagado, moneda)}</span>
      </p>
      <p className="text-slate-500">
        {saldo < -0.5 ? "Pagado de más" : "Saldo"}{" "}
        <span className={cn("font-semibold tabular-nums", saldo < -0.5 ? "text-red-600" : "text-[#1A3A5C]")}>
          {fmt(Math.abs(saldo), moneda)}
        </span>
      </p>
      {otras.map(([m, v]) => (
        <p key={m} className="text-amber-700">+ {fmt(v, m)} pagados en {m === "USD" ? "dólares" : "pesos"}</p>
      ))}
    </div>
  );
}
