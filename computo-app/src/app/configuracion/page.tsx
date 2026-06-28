"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ImageUp, Sparkles } from "lucide-react";

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

interface CategoriaLaboral {
  id: string;
  nombre: string;
  categoria: string;
  jornal: number;
}

interface Configuracion {
  id: string;
  convenioFechaVigente: string | null;
}

interface CategoriaExtraida {
  nombre: string;
  jornal: number;
}

interface MaterialReferencia {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number;
}

const CODIGOS_MATERIALES_REFERENCIA = [
  "TICH-0800",
  "TICH-1200",
  "TICH-1700",
  "LAD-COMUN",
  "LAD-PRIMERA",
  "LAD-CHORIZO",
  "BLOQUE-1219",
  "BLOQUE-1919",
  "CAL-HID",
  "PIEDRA-BRUTA",
  "MAD-ENCOFRADO",
  "TEJA-COLONIAL",
];

interface ResultadoExtraccion {
  categorias: CategoriaExtraida[];
  fechaVigencia?: string;
  porcentajeAjuste?: number;
}

function calcularAvisoConvenio(fechaStr: string | null): {
  tipo: "amber" | "red" | null;
  mensaje: string;
} {
  if (!fechaStr) return { tipo: null, mensaje: "" };

  const fecha = new Date(fechaStr);
  const hoy = new Date();

  const onceMesesMs = 11 * 30 * 24 * 60 * 60 * 1000;
  const vencePronto = hoy.getTime() - fecha.getTime() >= onceMesesMs;

  const primeroAbrilAnioActual = new Date(hoy.getFullYear(), 3, 1);
  const yaPasoAbril = hoy >= primeroAbrilAnioActual;
  const convenioDesactualizado = yaPasoAbril && fecha < primeroAbrilAnioActual;

  if (convenioDesactualizado) {
    return {
      tipo: "red",
      mensaje:
        "El convenio SUNCA puede estar desactualizado — revisá las nuevas escalas en sunca.uy",
    };
  }

  if (vencePronto) {
    return {
      tipo: "amber",
      mensaje:
        "El convenio SUNCA vence pronto — verificá si hay nuevas escalas en sunca.uy",
    };
  }

  return { tipo: null, mensaje: "" };
}

export default function ConfiguracionPage() {
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
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [categorias, setCategorias] = useState<CategoriaLaboral[]>([]);
  const [jornales, setJornales] = useState<Record<string, string>>({});
  const [fechaConvenio, setFechaConvenio] = useState<string>("");
  const [configId, setConfigId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const [materialesRef, setMaterialesRef] = useState<MaterialReferencia[]>([]);
  const [preciosRef, setPreciosRef] = useState<Record<string, string>>({});
  const [guardandoMateriales, setGuardandoMateriales] = useState(false);
  const [materialesGuardados, setMaterialesGuardados] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [extrayendo, setExtrayendo] = useState(false);
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null);
  const [resumenExtraccion, setResumenExtraccion] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const [resEmpresa, resCategorias, resConfig, resMateriales] = await Promise.all([
        fetch("/api/empresa/perfil"),
        fetch("/api/categorias-laborales"),
        fetch("/api/configuracion"),
        fetch(`/api/precios-mtop?codigos=${CODIGOS_MATERIALES_REFERENCIA.join(",")}`),
      ]);
      const dataEmpresa: EmpresaPerfil = await resEmpresa.json();
      const dataCategorias: CategoriaLaboral[] = await resCategorias.json();
      const dataConfig: Configuracion = await resConfig.json();
      const dataMateriales: MaterialReferencia[] = await resMateriales.json();

      setEmpresaForm({
        nombre: dataEmpresa.nombre || "",
        rut: dataEmpresa.rut || "",
        direccion: dataEmpresa.direccion || "",
        telefono: dataEmpresa.telefono || "",
        email: dataEmpresa.email || "",
        web: dataEmpresa.web || "",
        logo: dataEmpresa.logo || "",
      });

      setCategorias(dataCategorias);
      setJornales(
        Object.fromEntries(dataCategorias.map((c) => [c.id, String(c.jornal)]))
      );
      setConfigId(dataConfig.id);
      setFechaConvenio(
        dataConfig.convenioFechaVigente
          ? dataConfig.convenioFechaVigente.slice(0, 10)
          : ""
      );
      setMaterialesRef(dataMateriales);
      setPreciosRef(
        Object.fromEntries(dataMateriales.map((m) => [m.codigo, String(m.precioUnitario)]))
      );
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

    await fetch("/api/empresa/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(empresaForm),
    });

    setGuardandoEmpresa(false);
    setEmpresaGuardada(true);
    setTimeout(() => setEmpresaGuardada(false), 2500);
  }

  async function guardarMaterialesRef() {
    setGuardandoMateriales(true);
    setMaterialesGuardados(false);

    const materiales = materialesRef
      .map((m) => ({ codigo: m.codigo, precioUnitario: Number(preciosRef[m.codigo]) }))
      .filter((m) => Number.isFinite(m.precioUnitario));

    await fetch("/api/precios-mtop", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materiales }),
    });

    setMaterialesRef((prev) =>
      prev.map((m) => ({
        ...m,
        precioUnitario: Number(preciosRef[m.codigo] ?? m.precioUnitario),
      }))
    );

    setGuardandoMateriales(false);
    setMaterialesGuardados(true);
    setTimeout(() => setMaterialesGuardados(false), 2500);
  }

  async function guardarCambios() {
    setGuardando(true);
    setGuardado(false);

    const categoriasModificadas = categorias
      .map((c) => ({ id: c.id, jornal: Number(jornales[c.id]) }))
      .filter((c) => !Number.isNaN(c.jornal));

    await Promise.all([
      fetch("/api/categorias-laborales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorias: categoriasModificadas }),
      }),
      configId
        ? fetch("/api/configuracion", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              convenioFechaVigente: fechaConvenio || null,
            }),
          })
        : Promise.resolve(),
    ]);

    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  }

  function manejarSeleccionImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setErrorExtraccion(null);
    setResumenExtraccion(null);

    const reader = new FileReader();
    reader.onload = () => setImagenPreview(reader.result as string);
    reader.readAsDataURL(archivo);
  }

  async function extraerJornalesConIA() {
    if (!imagenPreview) return;

    setExtrayendo(true);
    setErrorExtraccion(null);
    setResumenExtraccion(null);

    try {
      const res = await fetch("/api/configuracion/extraer-jornales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen: imagenPreview }),
      });

      if (!res.ok) {
        setErrorExtraccion(
          "No pude extraer los jornales con certeza. Intentá con una imagen más clara o ingresá los valores manualmente."
        );
        return;
      }

      const resultado: ResultadoExtraccion = await res.json();

      let coincidencias = 0;
      setJornales((prev) => {
        const actualizados = { ...prev };
        for (const extraida of resultado.categorias) {
          const categoria = categorias.find(
            (c) => c.nombre.toLowerCase() === extraida.nombre.toLowerCase()
          );
          if (categoria) {
            actualizados[categoria.id] = String(extraida.jornal);
            coincidencias += 1;
          }
        }
        return actualizados;
      });

      if (resultado.fechaVigencia) {
        setFechaConvenio(resultado.fechaVigencia);
      }

      setResumenExtraccion(
        `Se detectaron ${coincidencias} categoría${coincidencias === 1 ? "" : "s"}. Revisá los valores antes de guardar.`
      );
    } catch (err) {
      console.error(err);
      setErrorExtraccion(
        "No pude extraer los jornales con certeza. Intentá con una imagen más clara o ingresá los valores manualmente."
      );
    } finally {
      setExtrayendo(false);
    }
  }

  const aviso = calcularAvisoConvenio(fechaConvenio || null);

  if (cargando) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">Configuración</h1>
      <p className="text-slate-500 mb-8">
        Jornal base, aportes BPS, márgenes y moneda por defecto.
      </p>

      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1E293B] mb-1">Perfil de la Empresa</h2>
        <p className="text-sm text-slate-500 mb-4">
          Estos datos aparecen en la portada del PDF de presupuesto.
        </p>

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
            <button
              onClick={() => logoInputRef.current?.click()}
              className="text-xs font-medium text-[#2563EB] hover:underline"
            >
              Subir logo
            </button>
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">RUT</label>
              <input
                type="text"
                value={empresaForm.rut}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, rut: e.target.value }))}
                placeholder="ej: 21.123.456-0012"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Dirección</label>
              <input
                type="text"
                value={empresaForm.direccion}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, direccion: e.target.value }))}
                placeholder="ej: Av. Italia 1234, Montevideo"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Teléfono</label>
              <input
                type="text"
                value={empresaForm.telefono}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, telefono: e.target.value }))}
                placeholder="ej: 099 123 456"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Email</label>
              <input
                type="email"
                value={empresaForm.email}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="ej: contacto@empresa.com.uy"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Sitio web</label>
              <input
                type="text"
                value={empresaForm.web}
                onChange={(e) => setEmpresaForm((prev) => ({ ...prev, web: e.target.value }))}
                placeholder="ej: www.empresa.com.uy"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
              />
            </div>
          </div>
        </div>

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
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1E293B] mb-1">
          Categorías Laborales — Convenio SUNCA
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Jornales por categoría, según el convenio colectivo vigente.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={manejarSeleccionImagen}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 border border-slate-300 text-[#1E293B] text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-50 transition-colors mb-5"
        >
          <ImageUp className="w-4 h-4" />
          Actualizar desde imagen del convenio
        </button>

        {imagenPreview && (
          <div className="mb-5 border border-slate-200 rounded-lg p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagenPreview}
              alt="Foto del convenio SUNCA"
              className="max-h-64 rounded-lg mb-3"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={extraerJornalesConIA}
                disabled={extrayendo}
                className="inline-flex items-center gap-2 bg-[#1A3A5C] text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#15304c] disabled:opacity-60 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                {extrayendo ? "Extrayendo jornales..." : "Extraer jornales con IA"}
              </button>
            </div>

            {errorExtraccion && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2.5 mt-3 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{errorExtraccion}</span>
              </div>
            )}

            {resumenExtraccion && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2.5 mt-3 text-sm">
                {resumenExtraccion}
              </div>
            )}
          </div>
        )}

        <div className="mb-5">
          <label className="block text-sm font-medium text-[#1E293B] mb-1.5">
            Fecha del convenio vigente
          </label>
          <input
            type="date"
            value={fechaConvenio}
            onChange={(e) => setFechaConvenio(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
          />
        </div>

        {aviso.tipo === "amber" && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 mb-5 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{aviso.mensaje}</span>
          </div>
        )}
        {aviso.tipo === "red" && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2.5 mb-5 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{aviso.mensaje}</span>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 font-medium">Nombre</th>
              <th className="py-2 font-medium w-40">Jornal</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 text-[#1E293B]">{c.nombre}</td>
                <td className="py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={jornales[c.id] ?? ""}
                    onChange={(e) =>
                      setJornales((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    className="w-32 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={guardarCambios}
            disabled={guardando}
            className="bg-[#2563EB] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
          {guardado && (
            <span className="text-sm text-emerald-600">Cambios guardados</span>
          )}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1E293B] mb-1">
          Precios de Referencia de Materiales
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Materiales de mampostería que no están en la Lista Oficial MTOP N°599 — precio de referencia editable.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 font-medium">Descripción</th>
              <th className="py-2 font-medium w-24">Unidad</th>
              <th className="py-2 font-medium w-40">Precio (UYU)</th>
            </tr>
          </thead>
          <tbody>
            {materialesRef.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 text-[#1E293B]">{m.descripcion}</td>
                <td className="py-2 text-slate-500">{m.unidad}</td>
                <td className="py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={preciosRef[m.codigo] ?? ""}
                    onChange={(e) =>
                      setPreciosRef((prev) => ({ ...prev, [m.codigo]: e.target.value }))
                    }
                    className="w-32 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={guardarMaterialesRef}
            disabled={guardandoMateriales}
            className="bg-[#2563EB] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
          >
            {guardandoMateriales ? "Guardando..." : "Guardar cambios"}
          </button>
          {materialesGuardados && (
            <span className="text-sm text-emerald-600">Cambios guardados</span>
          )}
        </div>
      </section>
    </div>
  );
}
