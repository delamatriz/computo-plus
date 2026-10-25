"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSession, signOut } from "next-auth/react";
import { Bell, HelpCircle, ChevronDown, Menu, LogOut, Gauge, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEstadoCuenta } from "@/lib/accesoCliente";
import { conProyectoDeOrigen, proyectoIdDesdeParams, proyectoIdDesdePath } from "@/lib/proyectoActual";
import { avisarFiltroMateriales } from "@/lib/filtrosMateriales";
import { AvisoPrueba } from "@/components/acceso/AvisoPrueba";

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

// Preguntas frecuentes del dropdown de ayuda ("?") — contenido extraído
// (no inventado) de /referencias/page.tsx, aprobado por Luis. "link"
// navega directo a la sección real de Referencias (anchors ya existen
// ahí: #tutorial-flujo-principal, #glosario, #estructura-del-sistema,
// #guia-obra-publica); "respuesta" expande in-place (acordeón), sin
// navegar — algunas respuesta además ofrecen un link opcional a la
// sección con más detalle (ej. el glosario completo).
interface PreguntaFrecuente {
  pregunta: string;
  tipo: "link" | "respuesta";
  href?: string;
  hrefLabel?: string;
  respuesta?: string;
}

const PREGUNTAS_FRECUENTES: PreguntaFrecuente[] = [
  {
    pregunta: "¿Cómo mido un plano y lo paso al presupuesto?",
    tipo: "link",
    href: "/referencias#tutorial-flujo-principal",
  },
  {
    pregunta: "¿Qué son Capítulo, Rubro y APU?",
    tipo: "respuesta",
    respuesta:
      "Capítulo es la agrupación mayor de trabajo (ej. Estructura, Mampostería). Rubro es un ítem puntual dentro de un capítulo, con unidad, cantidad y precio unitario. APU es el desglose del precio de ese rubro: materiales, mano de obra, equipos y beneficio.",
    href: "/referencias#glosario",
    hrefLabel: "Ver glosario completo",
  },
  {
    pregunta: "¿Qué encuentro en cada pantalla del menú?",
    tipo: "link",
    href: "/referencias#estructura-del-sistema",
  },
  {
    pregunta: "¿Diferencia entre la guía de Leyes Sociales del menú y la calculadora de mi presupuesto?",
    tipo: "respuesta",
    respuesta:
      "La del menú es una guía general con ejemplos de cálculo (AUC, BPS, fondos). La de tu presupuesto calcula el aporte real sobre la mano de obra de ESA obra puntual, con los números concretos.",
  },
  {
    pregunta: "¿Dónde consigo precios oficiales de materiales y jornales actualizados?",
    tipo: "respuesta",
    respuesta:
      "Materiales tiene el catálogo con precios de referencia actualizados y el link al Índice ICCV del INE. Mano de Obra tiene el link al Convenio SUNCA vigente.",
  },
  {
    pregunta: "¿Qué cambia si presupuesto para el Estado (Obra Pública)?",
    tipo: "link",
    href: "/referencias#guia-obra-publica",
  },
  {
    pregunta: "¿Cómo creo un rubro nuevo que no está en la biblioteca?",
    tipo: "respuesta",
    respuesta:
      "Cargá el rubro dentro de un proyecto, armá su descompuesto (APU) —a mano o con la sugerencia automática— y aplicá el precio. Después guardalo con el marcador «Guardar en Mis rubros» de la fila del rubro: queda en Mis rubros para tus próximos proyectos.",
  },
  {
    // Una línea por símbolo: la respuesta se muestra con whitespace-pre-line.
    pregunta: "¿Qué significan los íconos y colores del presupuesto?",
    tipo: "respuesta",
    respuesta: [
      "🔒 Candado — precio de entrega anterior. No se toca el candado: tocá la cantidad o el precio del rubro para mantenerlo o actualizarlo.",
      "⏰ Reloj ámbar — hay materiales con precio sin verificar en este rubro.",
      "⚠ Triángulo ámbar — hay insumos sin precio cargado.",
      "🔄 Flecha circular ámbar — el precio del catálogo cambió, hacé clic para actualizar.",
      "🔄 Cambios sin aplicar (ámbar) — el APU tiene cambios que no se aplicaron al precio del rubro, hacé clic para aplicarlos.",
      "✅ Verificado (verde) — precio confirmado contra el mercado.",
      "⏰ Sin verificar (ámbar) — precio de referencia, confirmá con tu proveedor.",
      "⚠ Precio desactualizado (ámbar) — el precio varió significativamente, revisá en Materiales.",
      "? Sin precio — no hay precio de referencia, cotizá con tu proveedor.",
      "? Precio estimado (gris) — precio de referencia calculado, confirmá con tu proveedor antes de usar.",
    ].join("\n"),
  },
];

interface AvisoEmpresa {
  id: string;
  titulo: string;
  descripcion: string;
  fechaCreacion: string;
}

interface Notificaciones {
  eventos: EventoSistema[];
  // Avisos de plataforma no leídos por la empresa (vacío para el SUPERADMIN)
  avisos: AvisoEmpresa[];
  pendientes: { requierenVerificacion: number; aCotizar: number };
  hayNovedades: boolean;
}

// El dropdown de usuario muestra los datos de la Empresa (vía el mismo
// GET /api/empresa/perfil que ya usa /configuracion). Hay login con
// NextAuth (oct-2026), pero la app sigue teniendo una sola Empresa.
interface EmpresaHeader {
  nombre: string;
  email: string | null;
}

export function Header({ onMenuClick, showMenuButton = false }: HeaderProps) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // Los avisos se marcan leídos al abrir el panel; se siguen mostrando en esta sesión del panel
  // (así se alcanzan a leer) pero dejan de sumar al badge.
  const [avisosVistos, setAvisosVistos] = useState(false);
  const [ayudaOpen, setAyudaOpen] = useState(false);
  const [preguntaAbierta, setPreguntaAbierta] = useState<number | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaHeader | null>(null);
  const [notificaciones, setNotificaciones] = useState<Notificaciones | null>(null);
  // Solo muestra el acceso al panel /admin; quien decide es el servidor
  // (la página y las /api/admin/* leen el rol de la base).
  const [esSuperadmin, setEsSuperadmin] = useState(false);
  const { cuenta } = useEstadoCuenta();

  useEffect(() => {
    getSession()
      .then((s) => setEsSuperadmin(s?.user?.rol === "SUPERADMIN"))
      .catch(() => {});
  }, []);

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

  // Al abrir el panel, los avisos no leídos quedan leídos para toda la empresa. Se mandan los ids
  // que se están mostrando; si falla, el badge igual se apaga y reaparecen en la próxima carga.
  function marcarAvisosLeidos() {
    const ids = notificaciones?.avisos?.map((a) => a.id) ?? [];
    if (avisosVistos || ids.length === 0) return;
    setAvisosVistos(true);
    fetch("/api/notificaciones/marcar-leido", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avisoIds: ids }),
    }).catch(() => {});
  }

  const nombreEmpresa = empresa?.nombre || "Empresa";
  const iniciales =
    nombreEmpresa
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "EM";

  // Cerrar sesión — borra la cookie de sesión de NextAuth y vuelve a la
  // landing ("/"), que es pública y tiene el modal de login.
  const cerrarSesion = () => {
    setUserMenuOpen(false);
    void signOut({ callbackUrl: "/" });
  };

  const isHome = pathname === "/inicio";
  // Desde la campanita se sale a pantallas de referencia: se lleva el proyecto
  // en el que se estaba para poder volver (botón "Volver al proyecto" allá).
  const proyectoIdActual = proyectoIdDesdePath(pathname);
  // Badge de la campanita: materiales que requieren verificación + a cotizar
  // (los dos números del panel). Sin pendientes no se muestra; desde 100, "99+".
  const avisosNoLeidos = avisosVistos ? 0 : notificaciones?.avisos?.length ?? 0;
  const totalPendientes =
    (notificaciones?.pendientes.requierenVerificacion ?? 0) + (notificaciones?.pendientes.aCotizar ?? 0) + avisosNoLeidos;
  const textoBadge = totalPendientes > 99 ? "99+" : String(totalPendientes);
  // A dónde lleva cada pendiente: la cola de revisión resuelve precios del
  // catálogo global y es solo para el SUPERADMIN (a los demás les muestra un
  // aviso de acceso restringido); el resto va al catálogo de Materiales. Si
  // el rol todavía no cargó, va a Materiales (sirve para todos). El ancla
  // viaja en los dos casos: en la cola ubica la sección y en Materiales
  // prende el filtro correspondiente (ver el efecto de #a-revisar/#sin-precio
  // en app/materiales/page.tsx).
  // Estando en Materiales o en la cola de revisión no hay proyecto en la ruta:
  // se toma de ?from= para no perderlo. Solo se llama con el panel abierto
  // (después de hidratar), por eso puede leer window sin desfasar el HTML.
  const destinoPendiente = (ancla: "a-revisar" | "sin-precio") =>
    conProyectoDeOrigen(
      `${esSuperadmin ? "/configuracion/revision-precios" : "/materiales"}#${ancla}`,
      proyectoIdActual ?? proyectoIdDesdeParams(new URLSearchParams(window.location.search))
    );
  const alElegirPendiente = (ancla: "a-revisar" | "sin-precio") => {
    setNotifOpen(false);
    // Ya en Materiales no hay carga de página: se le avisa al catálogo.
    if (!esSuperadmin && pathname === "/materiales") avisarFiltroMateriales(ancla);
  };

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <>
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
          // /inicio también marca activo a "Mis Proyectos" — coincidencia
          // exacta, para no matchear otra ruta que empiece igual; /proyectos
          // cubre sus subrutas.
          { href: "/proyectos", label: "Mis Proyectos", rutasActivas: ["/proyectos", "/inicio"] },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3.5 py-2 rounded-[8px] text-sm font-medium transition-colors whitespace-nowrap",
              item.rutasActivas.some((ruta) => (ruta === "/inicio" ? pathname === ruta : pathname.startsWith(ruta)))
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
        <div className="hidden lg:flex">
          <AvisoPrueba cuenta={cuenta} />
        </div>
        <div className="relative">
          <button
            onClick={() => {
              const abriendo = !notifOpen;
              setNotifOpen(abriendo);
              if (abriendo) marcarAvisosLeidos();
            }}
            aria-label={totalPendientes > 0 ? `Notificaciones: ${totalPendientes} pendiente${totalPendientes === 1 ? "" : "s"}` : "Notificaciones"}
            className="w-9 h-9 flex items-center justify-center rounded-[8px] text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors relative"
          >
            <Bell className="w-4.5 h-4.5" />
            {totalPendientes > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 border-2 border-white text-white text-[10px] font-bold leading-none tabular-nums flex items-center justify-center"
              >
                {textoBadge}
              </span>
            ) : (
              notificaciones?.hayNovedades && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full border-2 border-white" />
              )
            )}
          </button>

          {notifOpen && (
            <>
              {/* Overlay + stopPropagation — mismo patrón que el dropdown
                  de usuario más abajo (a su vez calcado de
                  CalculadoraFlotante.tsx). */}
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div
                className="fixed left-3 right-3 top-[72px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 bg-bg-card border border-border rounded-[12px] shadow-modal z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Avisos de plataforma para la empresa (ver modelo Aviso): solo aparecen los no
                    leídos; se marcan leídos al abrir el panel. */}
                {notificaciones && notificaciones.avisos?.length > 0 && (
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Avisos</p>
                    <ul className="space-y-2.5 max-h-64 overflow-y-auto">
                      {notificaciones.avisos.map((av) => (
                        <li key={av.id}>
                          <p className="text-sm font-medium text-text-primary">{av.titulo}</p>
                          <p className="text-xs text-text-secondary mt-0.5">{av.descripcion}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">{fmtFecha(av.fechaCreacion)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

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
                            href={destinoPendiente("a-revisar")}
                            onClick={() => alElegirPendiente("a-revisar")}
                            className="text-sm text-text-primary hover:text-brand-accent transition-colors"
                          >
                            {notificaciones.pendientes.requierenVerificacion} material{notificaciones.pendientes.requierenVerificacion !== 1 ? "es" : ""} requiere{notificaciones.pendientes.requierenVerificacion !== 1 ? "n" : ""} verificación
                          </Link>
                        </li>
                      )}
                      {notificaciones.pendientes.aCotizar > 0 && (
                        <li>
                          <Link
                            href={destinoPendiente("sin-precio")}
                            onClick={() => alElegirPendiente("sin-precio")}
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

        <div className="relative">
          <button
            onClick={() => setAyudaOpen(!ayudaOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-[8px] text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
          >
            <HelpCircle className="w-4.5 h-4.5" />
          </button>

          {ayudaOpen && (
            <>
              {/* Mismo patrón que el dropdown de notificaciones de arriba:
                  overlay + stopPropagation para cerrar al clickear afuera. */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => {
                  setAyudaOpen(false);
                  setPreguntaAbierta(null);
                }}
              />
              <div
                className="fixed left-3 right-3 top-[72px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 bg-bg-card border border-border rounded-[12px] shadow-modal z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Preguntas frecuentes
                  </p>
                </div>
                <ul className="max-h-96 overflow-y-auto divide-y divide-border">
                  {PREGUNTAS_FRECUENTES.map((item, i) =>
                    item.tipo === "link" ? (
                      <li key={item.pregunta}>
                        <Link
                          href={item.href!}
                          onClick={() => setAyudaOpen(false)}
                          className="block px-4 py-3 text-sm text-text-primary hover:bg-bg-base hover:text-brand-accent transition-colors"
                        >
                          {item.pregunta}
                        </Link>
                      </li>
                    ) : (
                      <li key={item.pregunta}>
                        <button
                          onClick={() => setPreguntaAbierta(preguntaAbierta === i ? null : i)}
                          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm text-text-primary hover:bg-bg-base transition-colors"
                        >
                          {item.pregunta}
                          <ChevronDown
                            className={cn(
                              "w-3.5 h-3.5 text-text-muted flex-shrink-0 transition-transform",
                              preguntaAbierta === i && "rotate-180"
                            )}
                          />
                        </button>
                        {preguntaAbierta === i && (
                          <div className="px-4 pb-3 -mt-1">
                            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                              {item.respuesta}
                            </p>
                            {item.href && (
                              <Link
                                href={item.href}
                                onClick={() => setAyudaOpen(false)}
                                className="inline-block mt-1.5 text-sm font-medium text-brand-accent hover:underline"
                              >
                                {item.hrefLabel ?? "Ver más"} →
                              </Link>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  )}
                </ul>
                <Link
                  href="/referencias"
                  onClick={() => setAyudaOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-brand-accent hover:bg-bg-base transition-colors border-t border-border"
                >
                  Ver todas las referencias →
                </Link>
              </div>
            </>
          )}
        </div>

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

                {esSuperadmin && (
                  <Link
                    href="/admin"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-text-secondary hover:bg-bg-base transition-colors border-b border-border"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Administración
                  </Link>
                )}

                {/* Cerrar sesión — ver cerrarSesion() arriba. */}
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
    {/* Debajo de lg el header no tiene lugar para el chip → franja debajo. */}
    <div className="lg:hidden">
      <AvisoPrueba cuenta={cuenta} variante="barra" />
    </div>
    </>
  );
}
