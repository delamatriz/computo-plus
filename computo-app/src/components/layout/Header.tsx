"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, HelpCircle, ChevronDown, Menu, LogOut, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

interface EventoSistema {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
}

interface Notificaciones {
  eventos: EventoSistema[];
  pendientes: { requierenVerificacion: number; aCotizar: number };
  hayNovedades: boolean;
}

// La app es mono-tenant y hoy no tiene sistema de autenticación (sin
// modelo User, sin sesión, sin login) — la única "cuenta" que existe es
// la fila única de Empresa en la base. El dropdown de usuario refleja
// eso: "Mi cuenta" muestra los datos reales de esa Empresa (vía el
// mismo GET /api/empresa/perfil que ya usa /configuracion) en vez de
// inventar un usuario que no existe.
interface EmpresaHeader {
  nombre: string;
  email: string | null;
}

export function Header({ onMenuClick, showMenuButton = false }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [empresa, setEmpresa] = useState<EmpresaHeader | null>(null);
  const [notificaciones, setNotificaciones] = useState<Notificaciones | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/empresa/perfil")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado) setEmpresa({ nombre: data.nombre, email: data.email ?? null });
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  // Se carga al montar (determina el punto azul aunque el panel esté
  // cerrado) y se reusa al abrir el panel — sin refetch en el click.
  useEffect(() => {
    let cancelado = false;
    fetch("/api/notificaciones")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado) setNotificaciones(data);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  const nombreEmpresa = empresa?.nombre || "Empresa";
  const iniciales =
    nombreEmpresa
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "EM";

  // Cerrar sesión — no hay sesión real que destruir (ver comentario de
  // arriba), así que en vez de simular un logout que no existe, este
  // botón navega a la landing. Cuando exista auth de verdad, acá va la
  // llamada real a signOut().
  const cerrarSesion = () => {
    setUserMenuOpen(false);
    router.push("/inicio");
  };

  const isHome = pathname === "/inicio";

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <header
      className={cn(
        "h-16 flex items-center justify-between px-3 md:px-6 border-b border-border bg-bg-card gap-2",
        "sticky top-0 z-40",
        isHome && "bg-transparent border-transparent"
      )}
      style={{ boxShadow: isHome ? "none" : "0 1px 0 #E2E8F0" }}
    >
      {/* Botón hamburguesa — solo mobile, solo si hay sidebar */}
      {showMenuButton && (
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-[8px] text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors flex-shrink-0"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Logo */}
      <Link href="/inicio" className="flex items-center gap-2.5 select-none group min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-delamatriz.png" alt="De La Matriz" height={32} style={{ height: 32, width: "auto" }} className="flex-shrink-0" />
        <div className="flex items-baseline gap-0.5 min-w-0">
          <span
            className="text-[18px] font-bold tracking-tight text-brand-deep leading-none truncate"
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

      {/* Nav central */}
      <nav className="hidden md:flex items-center gap-1">
        {[
          { href: "/proyectos", label: "Mis Proyectos" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3.5 py-2 rounded-[8px] text-sm font-medium transition-colors whitespace-nowrap",
              pathname.startsWith(item.href)
                ? "bg-brand-pale text-brand-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-base"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Acciones derecha */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-[8px] text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors relative"
          >
            <Bell className="w-4.5 h-4.5" />
            {notificaciones?.hayNovedades && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full border-2 border-white" />
            )}
          </button>

          {notifOpen && (
            <>
              {/* Overlay + stopPropagation — mismo patrón que el dropdown
                  de usuario más abajo (a su vez calcado de
                  CalculadoraFlotante.tsx). */}
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div
                className="absolute right-0 top-full mt-2 w-80 bg-bg-card border border-border rounded-[12px] shadow-modal z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Eventos — cargados a mano en la base, sin formulario de
                    alta en la UI (ver modelo EventoSistema). */}
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Eventos</p>
                  {notificaciones && notificaciones.eventos.length > 0 ? (
                    <ul className="space-y-2.5 max-h-64 overflow-y-auto">
                      {notificaciones.eventos.map((ev) => (
                        <li key={ev.id}>
                          <p className="text-sm font-medium text-text-primary">{ev.titulo}</p>
                          <p className="text-xs text-text-secondary mt-0.5">{ev.descripcion}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">{fmtFecha(ev.fecha)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-muted">Sin novedades</p>
                  )}
                </div>

                {/* Pendientes — conteo calculado al vuelo, no guardado
                    (ver GET /api/notificaciones). */}
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Pendientes</p>
                  {notificaciones && (notificaciones.pendientes.requierenVerificacion > 0 || notificaciones.pendientes.aCotizar > 0) ? (
                    <ul className="space-y-1.5">
                      {notificaciones.pendientes.requierenVerificacion > 0 && (
                        <li>
                          <Link
                            href="/configuracion/revision-precios#a-revisar"
                            onClick={() => setNotifOpen(false)}
                            className="text-sm text-text-primary hover:text-brand-accent transition-colors"
                          >
                            {notificaciones.pendientes.requierenVerificacion} material{notificaciones.pendientes.requierenVerificacion !== 1 ? "es" : ""} requiere{notificaciones.pendientes.requierenVerificacion !== 1 ? "n" : ""} verificación
                          </Link>
                        </li>
                      )}
                      {notificaciones.pendientes.aCotizar > 0 && (
                        <li>
                          <Link
                            href="/configuracion/revision-precios#sin-precio"
                            onClick={() => setNotifOpen(false)}
                            className="text-sm text-text-primary hover:text-brand-accent transition-colors"
                          >
                            {notificaciones.pendientes.aCotizar} material{notificaciones.pendientes.aCotizar !== 1 ? "es" : ""} a cotizar
                          </Link>
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-muted">Sin pendientes</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <Link
          href="/referencias"
          className="w-9 h-9 flex items-center justify-center rounded-[8px] text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
        >
          <HelpCircle className="w-4.5 h-4.5" />
        </Link>

        <div className="w-px h-5 bg-border mx-1" />

        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-[8px] hover:bg-bg-base transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand-deep flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-semibold text-white">{iniciales}</span>
            </div>
            <span className="hidden sm:block text-sm font-medium text-text-primary truncate max-w-[140px]">
              {nombreEmpresa}
            </span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-text-muted transition-transform flex-shrink-0",
                userMenuOpen && "rotate-180"
              )}
            />
          </button>

          {userMenuOpen && (
            <>
              {/* Overlay invisible para cerrar al clickear afuera — mismo
                  patrón que CalculadoraFlotante.tsx (overlay con onClick
                  que cierra + stopPropagation en el panel). */}
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-2 w-72 bg-bg-card border border-border rounded-[12px] shadow-modal z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Mi cuenta */}
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand-deep flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-white">{iniciales}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{nombreEmpresa}</p>
                      <p className="text-xs text-text-muted truncate">{empresa?.email || "Sin email configurado"}</p>
                    </div>
                  </div>
                  <Link
                    href="/configuracion"
                    onClick={() => setUserMenuOpen(false)}
                    className="mt-2.5 inline-block text-xs font-medium text-brand-accent hover:underline"
                  >
                    Editar datos de la empresa
                  </Link>
                </div>

                {/* Plan y uso — sin detalle de consumo de IA todavía (ese
                    sistema de límites no está implementado); espacio
                    reservado para cuando se defina. */}
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
                    <Gauge className="w-3.5 h-3.5" />
                    Plan y uso
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-text-primary">Plan: Empresa</p>
                </div>

                {/* Cerrar sesión — ver comentario de cerrarSesion() arriba:
                    no hay sesión real que destruir todavía. */}
                <button
                  onClick={cerrarSesion}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-text-secondary hover:bg-bg-base transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
