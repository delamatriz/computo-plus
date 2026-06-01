"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  FolderOpen,
  ChevronRight,
  MoreHorizontal,
  ArrowUpRight,
  Calendar,
  Search,
  LayoutGrid,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Datos de ejemplo ───────────────────────────────── */
const STATS = [
  { label: "Proyectos activos",    value: "7",        sub: "en curso" },
  { label: "Total presupuestado",  value: "U$S 2.4M", sub: "en 7 proyectos" },
  { label: "Avance promedio",      value: "64%",      sub: "todos los proyectos" },
  { label: "Entregados este año",  value: "12",       sub: "proyectos finalizados" },
];

const ESTADOS = {
  BORRADOR:   { label: "Borrador",   color: "#64748B", bg: "#F1F5F9", dot: "#94A3B8" },
  EN_CURSO:   { label: "En curso",   color: "#2563EB", bg: "#EFF6FF", dot: "#2563EB" },
  FINALIZADO: { label: "Finalizado", color: "#10B981", bg: "#ECFDF5", dot: "#10B981" },
  PAUSADO:    { label: "Pausado",    color: "#F59E0B", bg: "#FFFBEB", dot: "#F59E0B" },
};

const PROYECTOS = [
  { id: "1", nombre: "Vivienda unifamiliar — Pocitos",   cliente: "Familia González",       estado: "EN_CURSO"   as keyof typeof ESTADOS, moneda: "USD", total: 185000,  avance: 72,  fecha: "2025-03-15", capitulos: 9  },
  { id: "2", nombre: "Edificio 8 pisos — Cordón",        cliente: "Constructora Delta S.A.", estado: "EN_CURSO"   as keyof typeof ESTADOS, moneda: "USD", total: 1240000, avance: 45,  fecha: "2025-01-20", capitulos: 12 },
  { id: "3", nombre: "Local comercial — Punta Carretas",  cliente: "Retail Partners Uy",     estado: "BORRADOR"   as keyof typeof ESTADOS, moneda: "UYU", total: 3800000, avance: 15,  fecha: "2025-04-02", capitulos: 7  },
  { id: "4", nombre: "Reforma baños — Ciudad Vieja",      cliente: "Hotel Colonial",         estado: "FINALIZADO" as keyof typeof ESTADOS, moneda: "USD", total: 28000,   avance: 100, fecha: "2024-12-10", capitulos: 5  },
  { id: "5", nombre: "Galpón industrial — Zona Franca",   cliente: "LogiTrans Uruguay",      estado: "EN_CURSO"   as keyof typeof ESTADOS, moneda: "USD", total: 520000,  avance: 30,  fecha: "2025-02-28", capitulos: 8  },
  { id: "6", nombre: "Apart 3 dormitorios — Buceo",       cliente: "Sr. Fernández",          estado: "BORRADOR"   as keyof typeof ESTADOS, moneda: "USD", total: 95000,   avance: 8,   fecha: "2025-05-01", capitulos: 10 },
];

const ACCESOS_RAPIDOS = [
  { label: "Biblioteca de rubros", desc: "Gestioná ítems y precios",        href: "/rubros"   },
  { label: "Descompuestos",        desc: "Análisis de precios unitarios",    href: "/recetas"  },
  { label: "Reportes",             desc: "Comparativas y exportaciones",     href: "/reportes" },
];

function fmtTotal(total: number, moneda: string) {
  if (moneda === "USD") return `U$S ${total.toLocaleString("es-UY")}`;
  return `$ ${total.toLocaleString("es-UY")}`;
}

function fmtFecha(d: string) {
  return new Date(d).toLocaleDateString("es-UY", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/* ─── Componente ─────────────────────────────────────── */
export default function DashboardPage() {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [vista, setVista] = useState<"lista" | "grilla">("lista");

  const proyectosFiltrados = PROYECTOS.filter((p) => {
    const matchBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.cliente.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado = filtroEstado === "TODOS" || p.estado === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto" style={{ background: "#F0F4F8", minHeight: "100%" }}>

      {/* ── Header ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C] mb-0.5">Mis proyectos</h1>
          <p className="text-sm text-slate-400">
            {new Date().toLocaleDateString("es-UY", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <Link
          href="/proyectos/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors self-start sm:self-auto"
          style={{ boxShadow: "0 4px 12px 0 rgb(37 99 235 / 0.25)" }}
        >
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </Link>
      </motion.div>

      {/* ── Stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="bg-white rounded-[14px] border border-slate-300 p-5 shadow-sm"
          >
            <div className="text-2xl font-bold mb-0.5 text-[#1A3A5C]">{s.value}</div>
            <p className="text-sm font-medium text-slate-600">{s.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Tabla de proyectos ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="bg-white rounded-[16px] border border-slate-300 mb-6 shadow-sm"
      >
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar proyecto o cliente..."
              className="w-full pl-9 pr-3 py-2 rounded-[8px] border border-slate-300 bg-slate-50 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {["TODOS", "EN_CURSO", "BORRADOR", "FINALIZADO"].map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={cn(
                  "px-2.5 py-1.5 rounded-[6px] text-xs font-medium transition-all",
                  filtroEstado === e
                    ? "bg-[#2563EB] text-white"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                )}
              >
                {e === "TODOS" ? "Todos" : ESTADOS[e as keyof typeof ESTADOS]?.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <div className="flex items-center bg-slate-100 rounded-[8px] border border-slate-200 p-0.5">
              <button
                onClick={() => setVista("lista")}
                className={cn(
                  "p-1.5 rounded-[6px] transition-all",
                  vista === "lista" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setVista("grilla")}
                className={cn(
                  "p-1.5 rounded-[6px] transition-all",
                  vista === "grilla" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Vista lista */}
        {vista === "lista" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Proyecto", "Estado", "Fecha", "Total", "Avance", ""].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider",
                        h === "Total" || h === "" ? "text-right" : "text-left",
                        h === "Fecha" && "hidden lg:table-cell",
                        h === "Estado" && "hidden sm:table-cell",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proyectosFiltrados.map((p, i) => {
                  const estado = ESTADOS[p.estado];
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: 0.2 + i * 0.03 }}
                      className="group hover:bg-slate-50 transition-colors"
                    >
                      {/* Proyecto */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.estado === "FINALIZADO" ? "#16A34A" : "#2563EB" }} />
                          <div>
                            <Link
                              href={`/proyectos/${p.id}`}
                              className="text-sm font-semibold text-[#1A3A5C] hover:text-[#2563EB] transition-colors leading-tight"
                            >
                              {p.nombre}
                            </Link>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {p.cliente} · {p.capitulos} capítulos
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: estado.bg, color: estado.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: estado.dot }} />
                          {estado.label}
                        </span>
                      </td>

                      {/* Fecha */}
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="text-sm text-slate-500 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                          {fmtFecha(p.fecha)}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-bold text-[#2563EB] tabular-nums">
                          {fmtTotal(p.total, p.moneda)}
                        </span>
                      </td>

                      {/* Avance */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 min-w-[110px]">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${p.avance}%`,
                                background: p.estado === "FINALIZADO" ? "#16A34A" : "#2563EB",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-500 w-8 text-right tabular-nums">
                            {p.avance}%
                          </span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/proyectos/${p.id}`}
                            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                          <button className="w-7 h-7 flex items-center justify-center rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>

            {proyectosFiltrados.length === 0 && (
              <div className="text-center py-16">
                <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm font-medium text-slate-500 mb-1">No hay proyectos que coincidan</p>
                <p className="text-xs text-slate-400">Probá con otro filtro o creá un nuevo proyecto</p>
              </div>
            )}
          </div>
        )}

        {/* Vista grilla */}
        {vista === "grilla" && (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {proyectosFiltrados.map((p, i) => {
              const estado = ESTADOS[p.estado];
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: i * 0.04 }}
                >
                  <Link
                    href={`/proyectos/${p.id}`}
                    className="block p-4 rounded-[12px] border border-slate-200 hover:border-[#2563EB]/40 hover:shadow-sm transition-all bg-slate-50 group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="w-2 h-2 rounded-full mt-1.5" style={{ background: p.estado === "FINALIZADO" ? "#16A34A" : "#2563EB" }} />
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: estado.bg, color: estado.color }}
                      >
                        {estado.label}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-[#1A3A5C] group-hover:text-[#2563EB] transition-colors mb-0.5 leading-tight">
                      {p.nombre}
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">{p.cliente}</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[#2563EB]">{fmtTotal(p.total, p.moneda)}</span>
                      <span className="text-xs text-slate-400">{p.avance}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${p.avance}%`, background: p.avance === 100 ? "#10B981" : "#2563EB" }}
                      />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
            <Link
              href="/proyectos/nuevo"
              className="flex flex-col items-center justify-center p-4 rounded-[12px] border-2 border-dashed border-slate-300 hover:border-[#2563EB] hover:bg-blue-50/30 transition-all min-h-[140px] group"
            >
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center mb-2 group-hover:bg-blue-50 transition-colors">
                <Plus className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-colors" />
              </div>
              <p className="text-sm font-semibold text-slate-400 group-hover:text-[#2563EB] transition-colors">
                Nuevo proyecto
              </p>
            </Link>
          </div>
        )}

        {/* Footer tabla */}
        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {proyectosFiltrados.length} de {PROYECTOS.length} proyectos
          </p>
          <Link
            href="/proyectos"
            className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 transition-colors"
          >
            Ver historial completo
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>

      {/* ── Accesos rápidos ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {ACCESOS_RAPIDOS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center justify-between p-4 bg-white rounded-[12px] border border-slate-300 hover:border-[#2563EB]/40 hover:shadow-sm transition-all group shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold text-[#1A3A5C] group-hover:text-[#2563EB] transition-colors">
                {a.label}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{a.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB] transition-colors flex-shrink-0" />
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
