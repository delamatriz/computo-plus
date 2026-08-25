"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// "Mis Proyectos" también vive como píldora en el nav central del Header
// (hidden md:flex — ver Header.tsx), pero ese nav desaparece por debajo
// de md y el único acceso mobile pasa a ser este drawer (mismo Sidebar,
// reusado con mobileOpen). No había ningún ítem acá que llevara a
// /proyectos — el link quedaba inalcanzable en mobile puro. Mismo
// destino/comportamiento que la píldora de desktop (startsWith para el
// estado activo, ver el check de `active` más abajo).
//
// Sin íconos a propósito — navegación solo texto para consistencia
// visual en todo el Sidebar (antes cada ítem tenía un ícono propio).
// `dividerBefore` en Materiales dibuja una línea divisoria fina antes
// de ese ítem, separando el cluster de proyecto (Mis Proyectos/
// Metrajes/Catálogo de Rubros) del cluster de recursos de referencia
// (Materiales/Mano de Obra/Leyes Sociales) sin agregar un label de
// sub-sección — la sección "Presupuestación" ya cubre a los 6.
const navItems = [
  {
    section: "Presupuestación",
    items: [
      { href: "/dashboard", label: "Panel de control" },
      { href: "/proyectos", label: "Mis Proyectos" },
      { href: "/metrajes", label: "Metrajes" },
      { href: "/rubros", label: "Catálogo de Rubros" },
      { href: "/materiales", label: "Materiales", dividerBefore: true },
      { href: "/mano-de-obra", label: "Mano de Obra" },
      { href: "/leyes-sociales", label: "Leyes Sociales" },
    ],
  },
  {
    section: "Sistema",
    items: [
      { href: "/configuracion", label: "Configuración" },
      { href: "/biblioteca", label: "Biblioteca" },
      { href: "/referencias", label: "Referencias" },
      { href: "/sugerencias", label: "Sugerencias" },
    ],
  },
];

// Sin ícono, el Sidebar colapsado (rail angosto, solo desktop — ver
// sidebarCollapsed en AppShell.tsx) se quedaba sin nada que mostrar por
// ítem. Mismo criterio que ya usa el avatar de Header.tsx (iniciales
// en vez de ícono): monograma de 2 letras — primera+última palabra si
// el label tiene más de una, o las primeras 2 letras si es una sola.
function monograma(label: string): string {
  const palabras = label.trim().split(/\s+/);
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Si queda fijo/visible como columna en desktop (lg+) o si se
   * comporta como drawer también en desktop (fixed + translate-x-full
   * en reposo, siempre) — ver AppShell.tsx. Páginas como /inicio no
   * quieren la columna fija (landing centrada, sin nav docked), pero sí
   * necesitan el drawer mobile para poder navegar desde el celular. */
  dockedOnDesktop?: boolean;
}

export function Sidebar({
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose,
  dockedOnDesktop = true,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay — solo mobile, cuando el drawer está abierto */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "flex flex-col bg-bg-sidebar overflow-hidden",
        "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        dockedOnDesktop && "lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 lg:h-full lg:flex-shrink-0"
      )}
      onClick={(e) => {
        // Cerrar el drawer mobile al tocar un ítem del menú
        const target = e.target as HTMLElement;
        if (target.closest("a") && onMobileClose) onMobileClose();
      }}
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

      {/* Portales de entrada — Cálculo rápido + Nuevo proyecto, apilados como par */}
      <div className="px-3 pt-4 pb-2 flex-shrink-0 flex flex-col gap-2">
        <Link
          href="/calcular"
          title={collapsed ? "Cálculo rápido" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-[10px] bg-[#3B82F6] hover:bg-[#60A5FA] transition-colors text-white font-medium text-sm",
            collapsed ? "justify-center p-2.5" : "px-3.5 py-3"
          )}
        >
          <Calculator className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Cálculo rápido</span>}
        </Link>
        <Link
          href="/proyectos/nuevo"
          title={collapsed ? "Nuevo proyecto" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-[10px] bg-brand-accent hover:bg-brand-light transition-colors text-white font-medium text-sm",
            collapsed ? "justify-center p-2.5" : "px-3.5 py-3"
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
                const active = pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Fragment key={item.href}>
                    {item.dividerBefore && (
                      <li key={`${item.href}-divider`} aria-hidden="true" className="py-1.5">
                        <div className="border-t border-white/10" />
                      </li>
                    )}
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center rounded-[8px] transition-colors text-sm font-medium",
                          collapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                          active
                            ? "bg-white/15 text-white"
                            : "text-white/55 hover:text-white hover:bg-white/8"
                        )}
                      >
                        {collapsed ? (
                          <span
                            className={cn(
                              "text-[11px] font-bold tracking-wide",
                              active && "text-brand-accent"
                            )}
                          >
                            {monograma(item.label)}
                          </span>
                        ) : (
                          <span>{item.label}</span>
                        )}
                      </Link>
                    </li>
                  </Fragment>
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
    </>
  );
}
