"use client";

import { useEffect, useRef, useState } from "react";
import SeccionAplicarPreciosVigentes from "@/components/configuracion/SeccionAplicarPreciosVigentes";
import SeccionIndiceICCV from "@/components/configuracion/SeccionIndiceICCV";
import { BotonVolverAlProyecto } from "@/components/shared/BotonVolverAlProyecto";
import { AvisoSoloAdministrador } from "@/components/shared/AvisoSoloAdministrador";
import { useRolUsuario } from "@/hooks/useSuperadmin";

interface EmpresaPerfil {
  id: string;
  nombre: string;
  rut: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  logo: string | null;
}

export default function ConfiguracionPage() {
  // Editar el perfil: solo ADMIN y SUPERADMIN (el servidor también lo exige). Un USUARIO lo ve en
  // solo lectura; null (cargando) cuenta como "no".
  const rol = useRolUsuario();
  const puedeEditar = rol === "ADMIN" || rol === "SUPERADMIN";
  const [empresaForm, setEmpresaForm] = useState({
    nombre: "",
    rut: "",
    direccion: "",
    telefono: "",
    email: "",
    web: "",
    logo: "",
  });
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);
  const [empresaGuardada, setEmpresaGuardada] = useState(false);
  const [errorEmpresa, setErrorEmpresa] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const resEmpresa = await fetch("/api/empresa/perfil");
      const dataEmpresa: EmpresaPerfil = await resEmpresa.json();

      setEmpresaForm({
        nombre: dataEmpresa.nombre || "",
        rut: dataEmpresa.rut || "",
        direccion: dataEmpresa.direccion || "",
        telefono: dataEmpresa.telefono || "",
        email: dataEmpresa.email || "",
        web: dataEmpresa.web || "",
        logo: dataEmpresa.logo || "",
      });
      setCargando(false);
    }
    cargar();
  }, []);

  function manejarSeleccionLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const reader = new FileReader();
    reader.onload = () => setEmpresaForm((prev) => ({ ...prev, logo: reader.result as string }));
    reader.readAsDataURL(archivo);
  }

  async function guardarEmpresa() {
    setGuardandoEmpresa(true);
    setEmpresaGuardada(false);
    setErrorEmpresa(null);
    try {
      const res = await fetch("/api/empresa/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empresaForm),
      });
      if (!res.ok) {
        // El servidor manda `mensaje` (RUT duplicado) o `error` (ej. 403 de rol); si no, uno genérico.
        const data = await res.json().catch(() => null);
        setErrorEmpresa(data?.mensaje ?? (res.status === 403 ? data?.error : null) ?? "No se pudieron guardar los cambios. Probá de nuevo.");
        return;
      }
      setEmpresaGuardada(true);
      setTimeout(() => setEmpresaGuardada(false), 2500);
    } catch {
      setErrorEmpresa("No se pudieron guardar los cambios. Probá de nuevo.");
    } finally {
      setGuardandoEmpresa(false);
    }
  }

  if (cargando) {
    return (
      <div className="p-8">
        <BotonVolverAlProyecto />
        <p className="text-slate-500">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <BotonVolverAlProyecto />
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">Configuración</h1>
      <p className="text-slate-500 mb-8">
        Datos de la empresa y mantenimiento de presupuestos existentes.
      </p>

      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1E293B] mb-1">Perfil de la Empresa</h2>
        <p className="text-sm text-slate-500 mb-4">
          Estos datos aparecen en la portada del PDF de presupuesto.
        </p>

        {/* fieldset disabled: todos los campos y botones quedan en solo lectura para un USUARIO. */}
        <fieldset disabled={!puedeEditar} className="contents">
        <div className="flex items-start gap-5 mb-5">
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
              {empresaForm.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={empresaForm.logo} alt="Logo de la empresa" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">Sin logo</span>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={manejarSeleccionLogo}
            />
            {puedeEditar && (
              <button
                onClick={() => logoInputRef.current?.click()}
                className="text-xs font-medium text-[#2563EB] hover:underline"
              >
                Subir logo
              </button>
            )}
          </div>

          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">
                Nombre de la empresa
              </label>
              <input
                type="text"
                value={empresaForm.nombre}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="ej: Constructora ABC SRL"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">RUT</label>
              <input
                type="text"
                value={empresaForm.rut}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, rut: e.target.value }))}
                placeholder="ej: 21.123.456-0012"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Dirección</label>
              <input
                type="text"
                value={empresaForm.direccion}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, direccion: e.target.value }))}
                placeholder="ej: Av. Italia 1234, Montevideo"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Teléfono</label>
              <input
                type="text"
                value={empresaForm.telefono}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, telefono: e.target.value }))}
                placeholder="ej: 099 123 456"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Email</label>
              <input
                type="email"
                value={empresaForm.email}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="ej: contacto@empresa.com.uy"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Sitio web</label>
              <input
                type="text"
                value={empresaForm.web}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, web: e.target.value }))}
                placeholder="ej: www.empresa.com.uy"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        </fieldset>

        {rol !== null && !puedeEditar && <AvisoSoloAdministrador texto="Solo el administrador de tu empresa puede modificar esto." />}
        {puedeEditar && (
        <div className="flex items-center gap-3">
          <button
            onClick={guardarEmpresa}
            disabled={guardandoEmpresa}
            className="bg-[#2563EB] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
          >
            {guardandoEmpresa ? "Guardando..." : "Guardar"}
          </button>
          {empresaGuardada && (
            <span className="text-sm text-emerald-600">Cambios guardados</span>
          )}
          {errorEmpresa && <span className="text-sm text-red-600">{errorEmpresa}</span>}
        </div>
        )}
      </section>

      <SeccionAplicarPreciosVigentes />

      <SeccionIndiceICCV />
    </div>
  );
}
