"use client";

import { Hammer, Package, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { EncabezadosAPU, textoRendimientoMO } from "@/components/shared/EncabezadosAPU";

// Descompuesto (solo lectura) de un rubro de Mis rubros — lo usan /mi-biblioteca
// y la pestaña "Mis rubros" del presupuesto (PanelMisRubros).

// ── Tipos (respuesta de GET /api/mi-biblioteca) ────────────────────────

export interface MaterialEmpresa {
  id: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnit: number;
  precioTotal: number;
  precioMTOPId: string | null;
}

export interface EquipoEmpresa {
  id: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  costoUnit: number;
  costoTotal: number;
}

export interface ManoObraEmpresa {
  id: string;
  categoria: string;
  cantidad: number;
  jornal: number;
  costoTotal: number;
  jornadasHoras: number | null;
}

export interface APUEmpresa {
  id: string;
  materiales: MaterialEmpresa[];
  equipos: EquipoEmpresa[];
  manoObra: ManoObraEmpresa[];
  costoMateriales: number;
  costoEquipos: number;
  costoManoObra: number;
  costoTotal: number;
}

export interface SubrubroEmpresa {
  id: string;
  nombre: string;
  unidad: string;
  precioUY: number;
  codigo: string | null;
  createdAt: string;
  apus: APUEmpresa[];
}

// ── Helpers ────────────────────────────────────────────────────────────

export const fmtMoneda = (v: number) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtNum = (v: number, dec = 2) =>
  new Intl.NumberFormat("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: dec }).format(v);

// ── Descompuesto ───────────────────────────────────────────────────────

// Anchos de las columnas numéricas de FilaInsumo — los encabezados usan los mismos.
const ANCHO_DETALLE = "w-36";
const ANCHO_PRECIO = "hidden sm:inline w-24";
const ANCHO_TOTAL = "w-24";

function SeccionAPU({
  titulo,
  icono,
  columnas,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  columnas: React.ComponentProps<typeof EncabezadosAPU>["columnas"];
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icono}
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{titulo}</h3>
      </div>
      <EncabezadosAPU columnas={columnas} />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FilaInsumo({ descripcion, detalle, precio, subtotal, aviso }: { descripcion: string; detalle: string; precio: string; subtotal: number; aviso?: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 text-sm">
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-slate-700 truncate">{descripcion}</span>
        {aviso && (
          <span title={aviso} className="flex-shrink-0 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-px">
            precio fijo
          </span>
        )}
      </div>
      <span className={cn("flex-shrink-0 text-slate-400 text-xs text-right", ANCHO_DETALLE)}>{detalle}</span>
      <span className={cn("flex-shrink-0 text-xs text-right text-slate-500", ANCHO_PRECIO)}>{precio}</span>
      <span className={cn("flex-shrink-0 font-semibold text-slate-700 text-xs text-right", ANCHO_TOTAL)}>{fmtMoneda(subtotal)}</span>
    </div>
  );
}

export function Descompuesto({ apu, unidad, precioUY }: { apu: APUEmpresa; unidad: string; precioUY: number }) {
  return (
    <div className="px-5 py-5 space-y-6 border-t border-slate-100">
      {apu.materiales.length > 0 && (
        <SeccionAPU
          titulo="Materiales"
          icono={<Package className="w-3.5 h-3.5 text-slate-400" />}
          columnas={[
            { label: "Descripción" },
            { label: "Cantidad", ancho: ANCHO_DETALLE, title: "Cantidad de material por unidad de rubro" },
            { label: "Precio unit.", ancho: ANCHO_PRECIO },
            { label: "Total", ancho: ANCHO_TOTAL, title: "Cantidad × precio unitario" },
          ]}
        >
          {apu.materiales.map((m) => (
            <FilaInsumo
              key={m.id}
              descripcion={m.descripcion}
              detalle={`${fmtNum(m.cantidad, 4)} ${m.unidad}`}
              precio={fmtMoneda(m.precioUnit)}
              subtotal={m.precioTotal}
              aviso={m.precioMTOPId ? undefined : "Sin vínculo a la Lista MTOP / catálogo: precio cargado a mano en el proyecto."}
            />
          ))}
        </SeccionAPU>
      )}
      {apu.manoObra.length > 0 && (
        <SeccionAPU
          titulo="Mano de obra"
          icono={<Hammer className="w-3.5 h-3.5 text-slate-400" />}
          columnas={[
            { label: "Categoría" },
            { label: "Rendimiento", ancho: ANCHO_DETALLE, title: `Unidades de rubro (${unidad}) producidas por jornada` },
            { label: "Jornal", ancho: ANCHO_PRECIO, title: "Jornal de referencia por jornada completa" },
            { label: "Total", ancho: ANCHO_TOTAL, title: `Costo de mano de obra por ${unidad}` },
          ]}
        >
          {apu.manoObra.map((mo) => (
            <FilaInsumo
              key={mo.id}
              descripcion={mo.categoria}
              detalle={textoRendimientoMO(mo.cantidad, unidad, mo.jornadasHoras ?? 8)}
              precio={fmtMoneda(mo.jornal)}
              subtotal={mo.costoTotal}
            />
          ))}
        </SeccionAPU>
      )}
      {apu.equipos.length > 0 && (
        <SeccionAPU
          titulo="Equipos"
          icono={<Wrench className="w-3.5 h-3.5 text-slate-400" />}
          columnas={[
            { label: "Descripción" },
            { label: "Cantidad", ancho: ANCHO_DETALLE, title: "Cantidad de equipo por unidad de rubro" },
            { label: "Costo unit.", ancho: ANCHO_PRECIO },
            { label: "Total", ancho: ANCHO_TOTAL, title: "Cantidad × costo unitario" },
          ]}
        >
          {apu.equipos.map((eq) => (
            <FilaInsumo
              key={eq.id}
              descripcion={eq.descripcion}
              detalle={`${fmtNum(eq.cantidad, 4)} ${eq.unidad}`}
              precio={fmtMoneda(eq.costoUnit)}
              subtotal={eq.costoTotal}
            />
          ))}
        </SeccionAPU>
      )}

      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-1.5">
        {[
          ["Materiales", apu.costoMateriales],
          ["Mano de obra (con aportes patronales)", apu.costoManoObra],
          ["Equipos", apu.costoEquipos],
        ].map(([label, valor]) => (
          <div key={label as string} className="flex items-center justify-between text-xs text-slate-500">
            <span>{label}</span>
            <span className="font-medium text-slate-700">{fmtMoneda(valor as number)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1.5 mt-1.5 border-t border-slate-200">
          <span>Costo directo</span>
          <span className="font-medium text-slate-700">{fmtMoneda(apu.costoTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Utilidad</span>
          <span className="font-medium text-slate-700">{fmtMoneda(precioUY - apu.costoTotal)}</span>
        </div>
        <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-200">
          <span className="text-sm font-bold text-[#1A3A5C]">Precio unitario</span>
          <span className="text-base font-bold text-[#2563EB]">
            {fmtMoneda(precioUY)} <span className="text-xs font-medium text-slate-400">/ {unidad}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
