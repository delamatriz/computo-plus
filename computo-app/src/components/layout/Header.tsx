"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, HelpCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";


export function Header() {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isHome = pathname === "/";

  return (
    <header
      className={cn(
        "h-16 flex items-center justify-between px-6 border-b border-border bg-bg-card",
        "sticky top-0 z-40",
        isHome && "bg-transparent border-transparent"
      )}
      style={{ boxShadow: isHome ? "none" : "0 1px 0 #E2E8F0" }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 select-none group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-delamatriz.png" alt="De La Matriz" height={36} style={{ height: 36, width: "auto" }} />
        <div className="flex items-baseline gap-0.5">
          <span
            className="text-[18px] font-bold tracking-tight text-brand-deep leading-none"
            style={{ fontFamily: "DM Sans, sans-serif" }}
          >
            CÓMPUTO
          </span>
          <span
            className="text-[20px] font-bold text-brand-accent leading-none"
            style={{ fontFamily: "DM Sans, sans-serif" }}
          >
            +
          </span>
        </div>
      </Link>

      {/* Nav central — solo visible fuera del home */}
      {!isHome && (
        <nav className="hidden md:flex items-center gap-1">
          {[
            { href: "/dashboard", label: "Proyectos" },
            { href: "/rubros", label: "Rubros" },
            { href: "/recetas", label: "Recetas" },
            { href: "/configuracion", label: "Configuración" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3.5 py-2 rounded-[8px] text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-brand-pale text-brand-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-base"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Acciones derecha */}
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 flex items-center justify-center rounded-[8px] text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors relative">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full border-2 border-white" />
        </button>

        <button className="w-9 h-9 flex items-center justify-center rounded-[8px] text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors">
          <HelpCircle className="w-4.5 h-4.5" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-[8px] hover:bg-bg-base transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-brand-deep flex items-center justify-center">
            <span className="text-[11px] font-semibold text-white">EM</span>
          </div>
          <span className="hidden sm:block text-sm font-medium text-text-primary">
            Empresa
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        </button>
      </div>
    </header>
  );
}
