"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  FolderOpen,
  TrendingUp,
  Building2,
  ChevronRight,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  FileEdit,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Search,
  Filter,
  LayoutGrid,
  List,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Datos de ejemplo ───────────────────────────────── */
const STATS = [
  {
    label: "Proyectos activos",
    value: "7",
    sub: "+2 este mes",
    icon: FolderOpen,
    color: "#2563EB",
    bg: "#EFF6FF",
    trend: "+28%",
  },
  {
    label: "Total presupuestado",
    value: "U$S 2.4M",
    sub: "en 7 proyectos",
    icon: DollarSign,
    color: "#10B981",
    bg: "#ECFDF5",
    trend: "+18%",
  },
  {
    label: "Avance promedio",
    value: "64%",
    sub: "todos los proyectos",
    icon: TrendingUp,
    color: "#F59E0B",
    bg: "#FFFBEB",
    trend: "+5%",
  },
  {
    label: "Entregados este año",
    value: "12",
    sub: "proyectos finalizados",
    icon: CheckCircle2,
    color: "#8B5CF6",
    bg: "#F5F3FF",
    trend: "+4",
  },
];

const ESTADOS = {
  BORRADOR:    { label: "Borrador",    color: "#64748B", bg: "#F1F5F9", dot: "#94A3B8"  },
  EN_CURSO:    { label: "En curso",    color: "#2563EB", bg: "#EFF6FF", dot: "#2563EB"  },
  FINALIZADO:  { label: "Finalizado",  color: "#10B981", bg: "#ECFDF5", dot: "#10B981"  },
  PAUSADO:     { label: "Pausado",     color: "#F59E0B", bg: "#FFFBEB", dot: "#F59E0B"  },
};

const TIPOS_COLOR: Record<string, string> = {
  VIVIENDA:    "#2563EB",
  APARTAMENTO: "#8B5CF6",
  EDIFICIO:    "#3B82F6",
  COMERCIAL:   "#F59E0B",
  INDUSTRIAL:  "#EF4444",
  REFORMA:     "#10B981",
};

const PROYECTOS = [
  {
    id: "1",
    nombre: "Vivienda unifamiliar — Pocitos",
    cliente: "Familia González",
    tipo: "VIVIENDA",
    estado: "EN_CURSO" as keyof typeof ESTADOS,
    moneda: "USD",
    total: 185000,
    avance: 72,
    fecha: "2025-03-15",
    capitulos: 9,
  },
  {
    id: "2",
    nombre: "Edificio 8 pisos — Cordón",
    cliente: "Constructora Delta S.A.",
    tipo: "EDIFICIO",
    estado: "EN_CURSO" as keyof typeof ESTADOS,
    moneda: "USD",
    total: 1240000,
    avance: 45,
    fecha: "2025-01-20",
    capitulos: 12,
  },
  {
    id: "3",
    nombre: "Local comercial — Punta Carretas",
    cliente: "Retail Partners Uy",
    tipo: "COMERCIAL",
    estado: "BORRADOR" as keyof typeof ESTADOS,
    moneda: "UYU",
    total: 3800000,
    avance: 15,
    fecha: "2025-04-02",
    capitulos: 7,
  },
  {
    id: "4",
    nombre: "Reforma baños — Ciudad Vieja",
    cliente: "Hotel Colonial",
    tipo: "REFORMA",
    estado: "FINALIZADO" as keyof typeof ESTADOS,
    moneda: "USD",
    total: 28000,
    avance: 100,
    fecha: "2024-12-10",
    capitulos: 5,
  },
  {
    id: "5",
    nombre: "Galpón industrial — Zona Franca",
    cliente: "LogiTrans Uruguay",
    tipo: "INDUSTRIAL",
    estado: "EN_CURSO" as keyof typeof ESTADOS,
    moneda: "USD",
    total: 520000,
    avance: 30,
    fecha: "2025-02-28",
    capitulos: 8,
  },
  {
    id: "6",
    nombre: "Apart 3 dormitorios — Buceo",
    cliente: "Sr. Fernández",
    tipo: "APARTAMENTO",
    estado: "BORRADOR" as keyof typeof ESTADOS,
    moneda: "USD",
    total: 95000,
    avance: 8,
    fecha: "2025-05-01",
    capitulos: 10,
  },
];

const ACCESOS_RAPIDOS = [
  {
    icon: BookOpen,
    label: "Biblioteca de rubros",
    desc: "Gestioná ítems y precios",
    href: "/rubros",
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  {
    icon: Building2,
    label: "Recetas APU",
    desc: "Análisis de precios unitarios",
    href: "/recetas",
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
  {
    icon: BarChart3,
    label: "Reportes",
    desc: "Comparativas y exportaciones",
    href: "/reportes",
    color: "#10B981",
    bg: "#ECFDF5",
  },
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
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

  const proyectosFiltrados = PROYECTOS.filter((p) => {
    const matchBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.cliente.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado =
      filtroEstado === "TODOS" || p.estado === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">

      {/* ── Header ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-0.5">
            Mis proyectos
          </h1>
          <p className="text-sm text-text-muted">
            {new Date().toLocaleDateString("es-UY", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <Link
          href="/proyectos/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-brand-accent hover:bg-brand-light text-white text-sm font-semibold transition-colors self-start sm:self-auto"
          style={{ boxShadow: "0 4px 12px 0 rgb(37 99 235 / 0.25)" }}
        >
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </Link>
      </motion.div>

      {/* ── Stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="bg-bg-card rounded-[14px] border border-border p-5 hover:border-brand-muted transition-colors"
              style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-[8px] flex items-center justify-center"
                  style={{ background: s.bg }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: s.color }} strokeWidth={2} />
                </div>
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                  {s.trend}
                </span>
              </div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: s.color }}>
                {s.value}
              </div>
              <p className="text-xs text-text-muted font-medium">{s.label}</p>
              <p className="text-xs text-text-muted mt-0.5">{s.sub}</p>
            </motion.div>
          );
        })}
      </div>

      {/* ── Tabla de proyectos ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="bg-bg-card rounded-[16px] border border-border mb-6"
        style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}
      >
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar proyecto o cliente..."
              className="w-full pl-9 pr-3 py-2 rounded-[8px] border border-border bg-bg-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-accent transition-all"
            />
          </div>

          {/* Filtro estado */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {["TODOS", "EN_CURSO", "BORRADOR", "FINALIZADO"].map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={cn(
                  "px-2.5 py-1.5 rounded-[6px] text-xs font-medium transition-all",
                  filtroEstado === e
                    ? "bg-brand-accent text-white"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-base"
                )}
              >
                {e === "TODOS" ? "Todos" : ESTADOS[e as keyof typeof ESTADOS]?.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Switcher vista */}
            <div className="flex items-center bg-bg-base rounded-[8px] border border-border p-0.5">
              <button
                onClick={() => setVista("lista")}
                className={cn(
                  "p-1.5 rounded-[6px] transition-all",
                  vista === "lista" ? "bg-bg-card text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
                )}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setVista("grilla")}
                className={cn(
                  "p-1.5 rounded-[6px] transition-all",
                  vista === "grilla" ? "bg-bg-card text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
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
                <tr className="border-b border-border">
                  {["Proyecto", "Estado", "Fecha", "Total", "Avance", ""].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider",
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
              <tbody className="divide-y divide-border">
                {proyectosFiltrados.map((p, i) => {
                  const estado = ESTADOS[p.estado];
                  const tipoColor = TIPOS_COLOR[p.tipo] ?? "#64748B";
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: 0.2 + i * 0.03 }}
                      className="group hover:bg-bg-base transition-colors"
                    >
                      {/* Proyecto */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
                            style={{ background: tipoColor + "18" }}
                          >
                            <Building2
                              className="w-3.5 h-3.5"
                              style={{ color: tipoColor }}
                              strokeWidth={2}
                            />
                          </div>
                          <div>
                            <Link
                              href={`/proyectos/${p.id}`}
                              className="text-sm font-semibold text-text-primary hover:text-brand-accent transition-colors leading-tight"
                            >
                              {p.nombre}
                            </Link>
                            <p className="text-xs text-text-muted mt-0.5">
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
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: estado.dot }}
                          />
                          {estado.label}
                        </span>
                      </td>

                      {/* Fecha */}
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="text-sm text-text-secondary flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                          {fmtFecha(p.fecha)}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-bold text-brand-accent tabular-nums">
                          {fmtTotal(p.total, p.moneda)}
                        </span>
                      </td>

                      {/* Avance */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 min-w-[110px]">
                          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${p.avance}%`,
                                background: p.avance === 100 ? "#10B981" : "#2563EB",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-text-secondary w-8 text-right tabular-nums">
                            {p.avance}%
                          </span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/proyectos/${p.id}`}
                            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-text-muted hover:text-brand-accent hover:bg-brand-pale transition-colors"
                            title="Abrir proyecto"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
                            title="Más opciones"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>

            {/* Fila vacía */}
            {proyectosFiltrados.length === 0 && (
              <div className="text-center py-16">
                <FolderOpen className="w-10 h-10 text-text-muted mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm font-medium text-text-secondary mb-1">
                  No hay proyectos que coincidan
                </p>
                <p className="text-xs text-text-muted">
                  Probá con otro filtro o crea un nuevo proyecto
                </p>
              </div>
            )}
          </div>
        )}

        {/* Vista grilla */}
        {vista === "grilla" && (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {proyectosFiltrados.map((p, i) => {
              const estado = ESTADOS[p.estado];
              const tipoColor = TIPOS_COLOR[p.tipo] ?? "#64748B";
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: i * 0.04 }}
                >
                  <Link
                    href={`/proyectos/${p.id}`}
                    className="block p-4 rounded-[12px] border border-border hover:border-brand-muted hover:shadow-md transition-all bg-bg-base group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="w-9 h-9 rounded-[8px] flex items-center justify-center"
                        style={{ background: tipoColor + "18" }}
                      >
                        <Building2
                          className="w-4 h-4"
                          style={{ color: tipoColor }}
                          strokeWidth={2}
                        />
                      </div>
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: estado.bg, color: estado.color }}
                      >
                        {estado.label}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-brand-accent transition-colors mb-0.5 leading-tight">
                      {p.nombre}
                    </h4>
                    <p className="text-xs text-text-muted mb-3">{p.cliente}</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-brand-accent">
                        {fmtTotal(p.total, p.moneda)}
                      </span>
                      <span className="text-xs text-text-muted">{p.avance}%</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${p.avance}%`,
                          background: p.avance === 100 ? "#10B981" : "#2563EB",
                        }}
                      />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
            {/* Tarjeta nuevo */}
            <Link
              href="/proyectos/nuevo"
              className="flex flex-col items-center justify-center p-4 rounded-[12px] border-2 border-dashed border-border hover:border-brand-accent hover:bg-brand-pale/30 transition-all min-h-[140px] group"
            >
              <div className="w-9 h-9 rounded-full bg-brand-pale flex items-center justify-center mb-2 group-hover:bg-brand-muted transition-colors">
                <Plus className="w-4.5 h-4.5 text-brand-accent" />
              </div>
              <p className="text-sm font-semibold text-text-muted group-hover:text-brand-accent transition-colors">
                Nuevo proyecto
              </p>
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {proyectosFiltrados.length} de {PROYECTOS.length} proyectos
          </p>
          <Link
            href="/proyectos"
            className="text-xs font-medium text-brand-accent hover:text-brand-light flex items-center gap-1 transition-colors"
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
        {ACCESOS_RAPIDOS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-4 p-4 bg-bg-card rounded-[12px] border border-border hover:border-brand-muted transition-all group"
              style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.05)" }}
            >
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{ background: a.bg }}
              >
                <Icon className="w-5 h-5" style={{ color: a.color }} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary group-hover:text-brand-accent transition-colors">
                  {a.label}
                </p>
                <p className="text-xs text-text-muted">{a.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-brand-accent transition-colors" />
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
}
