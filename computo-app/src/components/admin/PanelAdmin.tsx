"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Building2, Loader2, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { PLANES, ROLES_ASIGNABLES, type Plan } from "@/lib/roles";
import { cn } from "@/lib/utils";

// Panel /admin (solo SUPERADMIN): alta de empresas y de usuarios, estado de
// cada empresa (prueba / activa / desactivada) y eventos del sistema (topes de
// gasto, etc.). Las rutas /api/admin/* vuelven a chequear el rol en cada pedido.

interface EmpresaAdmin {
  id: string;
  nombre: string;
  slug: string | null;
  plan: string;
  rut: string;
  createdAt: string;
  /** Estado efectivo (una prueba con la fecha pasada llega como VENCIDA). */
  estado: EstadoEmpresa;
  fechaVencimientoPrueba: string | null;
  origen: string | null;
  _count: { users: number; proyectos: number };
}

type EstadoEmpresa = "PRUEBA" | "ACTIVA" | "VENCIDA" | "DESACTIVADA";
/** Estados que se eligen a mano; VENCIDA es automático. */
const ESTADOS_ELEGIBLES = ["PRUEBA", "ACTIVA", "DESACTIVADA"] as const;

const ESTILO_ESTADO: Record<EstadoEmpresa, { etiqueta: string; clase: string }> = {
  ACTIVA: { etiqueta: "Activa", clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PRUEBA: { etiqueta: "Prueba", clase: "bg-amber-50 text-amber-800 border-amber-200" },
  VENCIDA: { etiqueta: "Vencida", clase: "bg-red-50 text-red-700 border-red-200" },
  DESACTIVADA: { etiqueta: "Desactivada", clase: "bg-slate-100 text-slate-600 border-slate-200" },
};

interface EventoAdmin {
  id: string;
  tipo: string;
  funcion: string | null;
  detalle: string | null;
  createdAt: string;
  empresa: { id: string; nombre: string } | null;
}

const ETIQUETA_EVENTO: Record<string, string> = {
  WORKSPACE_SPEND_LIMIT: "Tope del workspace de pruebas",
  ORG_SPEND_LIMIT: "Tope de la organización",
  BILLING_ERROR: "Facturación de Anthropic",
  ANTHROPIC_KEY_PRUEBA_NO_CONFIGURADA: "Falta la clave de pruebas",
  EMPRESA_ELIMINADA: "Empresa eliminada",
  LIMPIEZA_AUTOMATICA: "Limpieza automática",
  SUSCRIPCION_MP: "Suscripción MercadoPago",
};

const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
const fmtFechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

interface UsuarioAdmin {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  creadoEn: string;
  empresa: { id: string; nombre: string };
}

const ETIQUETA_PLAN: Record<Plan, string> = {
  basico: "Básico",
  premium: "Premium",
  profesional: "Profesional",
  enterprise: "Enterprise",
};

const ETIQUETA_ROL: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  USUARIO: "Usuario",
};

// "Constructora del Sur S.A." → "constructora-del-sur-s-a"
function slugDesdeNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function enviar<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error ?? `Error ${res.status}` };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}

const INPUT =
  "w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-[#1E293B] placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition";
const LABEL = "block text-xs font-semibold text-[#1A3A5C] mb-1";
const BOTON =
  "h-9 px-4 rounded-lg bg-[#1A3A5C] hover:bg-[#2563EB] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5";

function Aviso({ error, exito }: { error: string | null; exito: string | null }) {
  if (error) return <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>;
  if (exito) return <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{exito}</p>;
  return null;
}

export function PanelAdmin() {
  const [empresas, setEmpresas] = useState<EmpresaAdmin[] | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [eventos, setEventos] = useState<{ eventos: EventoAdmin[]; porTipo: { tipo: string; total: number }[] } | null>(null);
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState<string | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  // Modal de eliminación: hay que escribir el nombre exacto para habilitar el botón.
  const [aEliminar, setAEliminar] = useState<EmpresaAdmin | null>(null);
  const [confirmacion, setConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  // ── Form empresa ──
  const [eNombre, setENombre] = useState("");
  const [eSlug, setESlug] = useState("");
  const [eSlugTocado, setESlugTocado] = useState(false);
  const [ePlan, setEPlan] = useState<Plan>("basico");
  const [eRut, setERut] = useState("");
  const [eEnviando, setEEnviando] = useState(false);
  const [eError, setEError] = useState<string | null>(null);
  const [eExito, setEExito] = useState<string | null>(null);

  // ── Form usuario ──
  const [uNombre, setUNombre] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uRol, setURol] = useState<(typeof ROLES_ASIGNABLES)[number]>("ADMIN");
  const [uEmpresaId, setUEmpresaId] = useState("");
  const [uEnviando, setUEnviando] = useState(false);
  const [uError, setUError] = useState<string | null>(null);
  const [uExito, setUExito] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/admin/empresas"), fetch("/api/admin/usuarios")])
      .then(async ([re, ru]) => {
        if (!re.ok || !ru.ok) throw new Error(`Error ${re.ok ? ru.status : re.status}`);
        const [de, du] = await Promise.all([re.json(), ru.json()]);
        setEmpresas(de.empresas);
        setUsuarios(du.usuarios);
      })
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : "Error al cargar"));
    fetch("/api/admin/eventos-admin")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setEventos(data))
      .catch(() => {});
  }, []);

  function abrirEliminar(emp: EmpresaAdmin) {
    setAEliminar(emp);
    setConfirmacion("");
    setErrorEliminar(null);
  }

  function cerrarEliminar() {
    if (eliminando) return;
    setAEliminar(null);
  }

  const modalAbierto = !!aEliminar;
  useEffect(() => {
    if (!modalAbierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !eliminando) setAEliminar(null);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [modalAbierto, eliminando]);

  async function eliminarEmpresa() {
    if (!aEliminar || confirmacion !== aEliminar.nombre) return;
    setEliminando(true);
    setErrorEliminar(null);
    try {
      const res = await fetch(`/api/admin/empresas/${aEliminar.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorEliminar(data?.error ?? `Error ${res.status}`);
      } else {
        const id = aEliminar.id;
        setEmpresas((prev) => prev?.filter((x) => x.id !== id) ?? prev);
        setUsuarios((prev) => prev?.filter((u) => u.empresa.id !== id) ?? prev);
        setAEliminar(null);
        fetch("/api/admin/eventos-admin")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d && setEventos(d))
          .catch(() => {});
      }
    } catch {
      setErrorEliminar("No se pudo conectar con el servidor");
    }
    setEliminando(false);
  }

  async function cambiarEstado(emp: EmpresaAdmin, estado: (typeof ESTADOS_ELEGIBLES)[number]) {
    if (estado === emp.estado) return;
    if (estado === "DESACTIVADA" && !window.confirm(`¿Desactivar «${emp.nombre}»? Sus usuarios no van a poder entrar.`)) return;
    setErrorEstado(null);
    setCambiandoEstadoId(emp.id);
    try {
      const res = await fetch(`/api/admin/empresas/${emp.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorEstado(`«${emp.nombre}»: ${data?.error ?? `Error ${res.status}`}`);
      } else {
        setEmpresas((prev) =>
          prev?.map((x) =>
            x.id === emp.id ? { ...x, estado: data.empresa.estado, fechaVencimientoPrueba: data.empresa.fechaVencimientoPrueba } : x
          ) ?? prev
        );
      }
    } catch {
      setErrorEstado("No se pudo conectar con el servidor");
    }
    setCambiandoEstadoId(null);
  }

  async function crearEmpresa(e: React.FormEvent) {
    e.preventDefault();
    setEError(null);
    setEExito(null);
    setEEnviando(true);
    const r = await enviar<{ empresa: EmpresaAdmin }>("/api/admin/empresas", { nombre: eNombre, slug: eSlug, plan: ePlan, rut: eRut });
    setEEnviando(false);
    if (!r.ok) return setEError(r.error);
    setEmpresas((prev) => [...(prev ?? []), r.data.empresa]);
    setEExito(`Empresa «${r.data.empresa.nombre}» creada.`);
    setENombre("");
    setESlug("");
    setESlugTocado(false);
    setEPlan("basico");
    setERut("");
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setUError(null);
    setUExito(null);
    setUEnviando(true);
    const r = await enviar<{ usuario: UsuarioAdmin }>("/api/admin/usuarios", {
      nombre: uNombre,
      email: uEmail,
      password: uPassword,
      rol: uRol,
      empresaId: uEmpresaId,
    });
    setUEnviando(false);
    if (!r.ok) return setUError(r.error);
    setUsuarios((prev) => [...(prev ?? []), r.data.usuario]);
    setEmpresas((prev) =>
      prev?.map((emp) => (emp.id === r.data.usuario.empresa.id ? { ...emp, _count: { ...emp._count, users: emp._count.users + 1 } } : emp)) ?? prev
    );
    setUExito(`Usuario ${r.data.usuario.email} creado en «${r.data.usuario.empresa.nombre}».`);
    setUNombre("");
    setUEmail("");
    setUPassword("");
    setURol("ADMIN");
  }

  return (
    <div className="min-h-full bg-[#F0F4F8]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2.5 mb-1">
          <ShieldCheck className="w-6 h-6 text-[#2563EB]" />
          <h1 className="text-2xl font-semibold text-[#1A3A5C]">Administración</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Empresas y usuarios de la plataforma.
          {empresas && usuarios && (
            <span className="text-[#1A3A5C] font-medium">
              {" "}
              {empresas.length} empresa{empresas.length !== 1 ? "s" : ""} · {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}
            </span>
          )}
        </p>

        {errorCarga && <div className="mb-6"><Aviso error={`No se pudieron cargar los datos (${errorCarga}).`} exito={null} /></div>}

        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* ── Empresas ── */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#1A3A5C]" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#1A3A5C]">Empresas</h2>
            </div>

            <form onSubmit={crearEmpresa} className="px-5 py-4 space-y-3 border-b border-slate-100" noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="e-nombre" className={LABEL}>Nombre</label>
                  <input
                    id="e-nombre"
                    className={INPUT}
                    value={eNombre}
                    placeholder="Constructora del Sur"
                    onChange={(e) => {
                      setENombre(e.target.value);
                      if (!eSlugTocado) setESlug(slugDesdeNombre(e.target.value));
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="e-slug" className={LABEL}>Slug</label>
                  <input
                    id="e-slug"
                    className={cn(INPUT, "font-mono")}
                    value={eSlug}
                    placeholder="constructora-del-sur"
                    onChange={(e) => {
                      setESlug(e.target.value.toLowerCase());
                      setESlugTocado(true);
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="e-plan" className={LABEL}>Plan</label>
                  <select id="e-plan" className={INPUT} value={ePlan} onChange={(e) => setEPlan(e.target.value as Plan)}>
                    {PLANES.map((p) => (
                      <option key={p} value={p}>{ETIQUETA_PLAN[p]}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="e-rut" className={LABEL}>
                    RUT <span className="font-normal text-slate-400">(opcional — si queda vacío, se completa después)</span>
                  </label>
                  <input id="e-rut" className={INPUT} value={eRut} placeholder="214567890019" onChange={(e) => setERut(e.target.value)} />
                </div>
              </div>
              <Aviso error={eError} exito={eExito} />
              <div className="flex justify-end">
                <button type="submit" className={BOTON} disabled={eEnviando || !eNombre.trim() || !eSlug.trim()}>
                  {eEnviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Agregar empresa
                </button>
              </div>
            </form>

            {errorEstado && <div className="px-5 pt-3"><Aviso error={errorEstado} exito={null} /></div>}
            <ul className="divide-y divide-slate-100">
              {empresas === null && !errorCarga && (
                <li className="px-5 py-4 text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Cargando…</li>
              )}
              {empresas?.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">Todavía no hay empresas.</li>}
              {empresas?.map((emp) => (
                <li key={emp.id} className="px-5 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1E293B] truncate">{emp.nombre}</p>
                      <p className="text-xs text-slate-400 font-mono truncate">{emp.slug ?? "sin slug"}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-500">
                      <span className="tabular-nums">{emp._count.users} usuario{emp._count.users !== 1 ? "s" : ""}</span>
                      <span className="tabular-nums">{emp._count.proyectos} proyecto{emp._count.proyectos !== 1 ? "s" : ""}</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB] font-semibold">
                        {ETIQUETA_PLAN[emp.plan as Plan] ?? emp.plan}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn("px-2 py-0.5 rounded-full border font-semibold", ESTILO_ESTADO[emp.estado].clase)}>
                      {ESTILO_ESTADO[emp.estado].etiqueta}
                    </span>
                    {(emp.estado === "PRUEBA" || emp.estado === "VENCIDA") && emp.fechaVencimientoPrueba && (
                      <span className="text-slate-500">
                        {emp.estado === "PRUEBA" ? "vence el" : "venció el"} {fmtFecha(emp.fechaVencimientoPrueba)}
                      </span>
                    )}
                    {emp.origen && <span className="text-slate-400">· origen: {emp.origen}</span>}
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => abrirEliminar(emp)}
                        title={`Eliminar ${emp.nombre}`}
                        aria-label={`Eliminar ${emp.nombre}`}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {cambiandoEstadoId === emp.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                      <label htmlFor={`estado-${emp.id}`} className="sr-only">Estado de {emp.nombre}</label>
                      <select
                        id={`estado-${emp.id}`}
                        className="h-7 px-2 rounded-md border border-slate-200 bg-white text-xs text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
                        value={emp.estado}
                        disabled={cambiandoEstadoId === emp.id}
                        onChange={(e) => cambiarEstado(emp, e.target.value as (typeof ESTADOS_ELEGIBLES)[number])}
                      >
                        {emp.estado === "VENCIDA" && <option value="VENCIDA" disabled>Vencida (automático)</option>}
                        <option value="PRUEBA">{emp.estado === "VENCIDA" ? "Prueba (nuevos días)" : "Prueba"}</option>
                        <option value="ACTIVA">Activa</option>
                        <option value="DESACTIVADA">Desactivada</option>
                      </select>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Usuarios ── */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1A3A5C]" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#1A3A5C]">Usuarios</h2>
            </div>

            <form onSubmit={crearUsuario} className="px-5 py-4 space-y-3 border-b border-slate-100" noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="u-empresa" className={LABEL}>Empresa</label>
                  <select id="u-empresa" className={INPUT} value={uEmpresaId} onChange={(e) => setUEmpresaId(e.target.value)}>
                    <option value="">Elegí una empresa…</option>
                    {empresas?.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="u-nombre" className={LABEL}>Nombre</label>
                  <input id="u-nombre" className={INPUT} value={uNombre} placeholder="Ana Pérez" onChange={(e) => setUNombre(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="u-rol" className={LABEL}>Rol</label>
                  <select id="u-rol" className={INPUT} value={uRol} onChange={(e) => setURol(e.target.value as (typeof ROLES_ASIGNABLES)[number])}>
                    {ROLES_ASIGNABLES.map((r) => (
                      <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="u-email" className={LABEL}>Email</label>
                  <input id="u-email" type="email" autoComplete="off" className={INPUT} value={uEmail} placeholder="ana@empresa.com" onChange={(e) => setUEmail(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="u-password" className={LABEL}>
                    Contraseña <span className="font-normal text-slate-400">(mín. 8)</span>
                  </label>
                  <input id="u-password" type="password" autoComplete="new-password" className={INPUT} value={uPassword} onChange={(e) => setUPassword(e.target.value)} />
                </div>
              </div>
              <Aviso error={uError} exito={uExito} />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className={BOTON}
                  disabled={uEnviando || !uEmpresaId || !uNombre.trim() || !uEmail.trim() || uPassword.length < 8}
                >
                  {uEnviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Agregar usuario
                </button>
              </div>
            </form>

            <ul className="divide-y divide-slate-100">
              {usuarios === null && !errorCarga && (
                <li className="px-5 py-4 text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Cargando…</li>
              )}
              {usuarios?.map((u) => (
                <li key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1E293B] truncate">{u.nombre}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email} · {u.empresa.nombre}</p>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0",
                      u.rol === "SUPERADMIN" ? "bg-[#1A3A5C] text-white" : "bg-[#2563EB]/10 text-[#2563EB]"
                    )}
                  >
                    {ETIQUETA_ROL[u.rol] ?? u.rol}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Eventos del sistema ── */}
        <section className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#1A3A5C]" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#1A3A5C]">Eventos del sistema</h2>
            <span className="text-xs text-slate-400 normal-case">últimos 50</span>
          </div>
          {eventos === null ? (
            <p className="px-5 py-4 text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Cargando…</p>
          ) : eventos.eventos.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">Sin eventos: no se alcanzó ningún tope de gasto.</p>
          ) : (
            <>
              <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-slate-100">
                {eventos.porTipo.map((t) => (
                  <span key={t.tipo} className="px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-600">
                    {ETIQUETA_EVENTO[t.tipo] ?? t.tipo}: <span className="font-semibold tabular-nums">{t.total}</span>
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                      <th className="px-5 py-2 font-semibold">Fecha</th>
                      <th className="px-3 py-2 font-semibold">Tipo</th>
                      <th className="px-3 py-2 font-semibold">Empresa</th>
                      <th className="px-3 py-2 font-semibold">Función</th>
                      <th className="px-5 py-2 font-semibold">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eventos.eventos.map((ev) => (
                      <tr key={ev.id} className="align-top">
                        <td className="px-5 py-2.5 whitespace-nowrap text-slate-500 tabular-nums">{fmtFechaHora(ev.createdAt)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-medium text-[#1E293B]">{ETIQUETA_EVENTO[ev.tipo] ?? ev.tipo}</td>
                        <td className="px-3 py-2.5 text-slate-600">{ev.empresa?.nombre ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{ev.funcion ?? "—"}</td>
                        <td className="px-5 py-2.5 text-xs text-slate-500 min-w-[16rem]">{ev.detalle ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {aEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[rgba(10,20,35,0.5)]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cerrarEliminar();
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-eliminar" className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </span>
              <div className="min-w-0">
                <h2 id="titulo-eliminar" className="text-base font-semibold text-[#1E293B]">Eliminar empresa</h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  Esta acción es irreversible. Se eliminarán todos los proyectos, usuarios y datos de{" "}
                  <strong className="text-[#1E293B]">{aEliminar.nombre}</strong>.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {aEliminar._count.users} usuario{aEliminar._count.users !== 1 ? "s" : ""} · {aEliminar._count.proyectos} proyecto
                  {aEliminar._count.proyectos !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <label htmlFor="confirmar-eliminar" className="block text-xs font-semibold text-[#1A3A5C] mt-5 mb-1.5">
              Escribí <span className="font-mono text-red-700">{aEliminar.nombre}</span> para confirmar
            </label>
            <input
              id="confirmar-eliminar"
              autoFocus
              autoComplete="off"
              className={INPUT}
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
            />
            {errorEliminar && <div className="mt-3"><Aviso error={errorEliminar} exito={null} /></div>}
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={cerrarEliminar}
                disabled={eliminando}
                className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={eliminarEmpresa}
                disabled={eliminando || confirmacion !== aEliminar.nombre}
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {eliminando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar empresa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
