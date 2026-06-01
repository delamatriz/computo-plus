"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Layers,
  BookOpen,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  HardHat,
  BarChart3,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  {
    section: "Principal",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/proyectos", icon: FolderOpen, label: "Proyectos" },
    ],
  },
  {
    section: "Presupuestación",
    items: [
      { href: "/rubros", icon: Layers, label: "Rubros" },
      { href: "/recetas", icon: BookOpen, label: "Descompuestos" },
      { href: "/categorias", icon: HardHat, label: "Mano de Obra" },
    ],
  },
  {
    section: "Análisis",
    items: [
      { href: "/reportes", icon: BarChart3, label: "Reportes" },
    ],
  },
  {
    section: "Sistema",
    items: [
      { href: "/configuracion", icon: Settings, label: "Configuración" },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="h-full flex flex-col bg-bg-sidebar flex-shrink-0 overflow-hidden relative"
      style={{ boxShadow: "4px 0 24px 0 rgb(0 0 0 / 0.12)" }}
    >
      {/* Header del sidebar */}
      <div className="h-16 flex items-center justify-between px-4 flex-shrink-0 border-b border-white/10">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex items-baseline gap-0.5"
            >
              <span className="text-[16px] font-bold tracking-tight text-white leading-none">
                CÓMPUTO
              </span>
              <span className="text-[18px] font-bold text-brand-accent leading-none">+</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggle}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-[6px] text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0",
            collapsed && "mx-auto"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Botón nuevo proyecto */}
      <div className="px-3 pt-4 pb-2 flex-shrink-0">
        <Link
          href="/proyectos/nuevo"
          className={cn(
            "flex items-center gap-2.5 w-full rounded-[10px] bg-brand-accent hover:bg-brand-light transition-colors text-white font-medium text-sm",
            collapsed ? "justify-center p-2.5" : "px-3.5 py-2.5"
          )}
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Nuevo proyecto</span>}
        </Link>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-5">
        {navItems.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-2 mb-1.5">
                {section.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-[8px] transition-colors text-sm font-medium",
                        collapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                        active
                          ? "bg-white/15 text-white"
                          : "text-white/55 hover:text-white hover:bg-white/8"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4.5 h-4.5 flex-shrink-0",
                          active ? "text-brand-accent" : ""
                        )}
                        strokeWidth={active ? 2.5 : 1.75}
                      />
                      {!collapsed && (
                        <span>{item.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer del sidebar */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
          <p className="text-[10px] text-white/25 leading-relaxed">
            CÓMPUTO+ v0.1 — Uruguay
          </p>
        </div>
      )}
    </motion.aside>
  );
}
