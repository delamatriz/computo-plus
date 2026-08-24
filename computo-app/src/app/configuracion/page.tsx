"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ImageUp, Sparkles } from "lucide-react";
import { convenioPosiblementeDesactualizado, mensajeAvisoConvenio } from "@/lib/convenioSunca";
import SeccionActualizacionDatos from "@/components/configuracion/SeccionActualizacionDatos";
import SeccionAplicarPreciosVigentes from "@/components/configuracion/SeccionAplicarPreciosVigentes";

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
  convenioImagenUrl: string | null;
}

interface CategoriaExtraida {
  categoriaRomano: string | null;
  nombreEnImagen: string;
  jornal: number;
}

interface MaterialReferencia {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number;
  actualizadoEn: string;
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
  recargoAlturaPct?: number | null;
  fechaVigencia?: string;
  porcentajeAjuste?: number;
}

interface PropuestaCategoria {
  categoriaId: string;
  nombre: string;
  jornalAntes: number;
  jornalDespues: number;
}

// Mapea el número de categoría del laudo (identificado por nombre en la
// imagen, nunca por posición de fila) al código interno de CategoriaLaboral.
const ROMANO_A_CODIGO_LAUDO: Record<string, string> = {
  I: "sunca_cat_i",
  II: "sunca_cat_ii",
  III: "sunca_cat_iii",
  IV: "sunca_cat_iv",
  V: "sunca_cat_v",
  VI: "sunca_cat_vi",
  VII: "sunca_cat_vii",
  VIII: "sunca_cat_viii",
  IX: "sunca_cat_ix",
  X: "sunca_cat_x",
  XI: "sunca_cat_xi",
  XII: "sunca_cat_xii",
};

// Flujo simplificado (obra mediana) — Peón = Cat. I, Medio Oficial = Cat. V,
// Oficial = Cat. VII, siempre anclado al número de categoría, nunca a la
// posición de la fila en la imagen.
const ROMANO_A_CODIGO_SIMPLIFICADO: Record<string, string> = {
  I: "peon",
  V: "medio_oficial",
  VII: "oficial",
};

function formatearJornal(n: number): string {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// actualizadoEn es un timestamp real (Prisma @updatedAt, se toca en cada
// guardado manual desde esta pantalla) — a diferencia de las fechas "solo
// día" de otras partes de la app, se formatea en huso local sin necesidad
// de forzar UTC.
function formatearFechaActualizacion(iso: string): string {
  return new Date(iso).toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" });
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
  const [propuestaExtraccion, setPropuestaExtraccion] = useState<PropuestaCategoria[] | null>(null);
  const [filasNoIdentificadas, setFilasNoIdentificadas] = useState<CategoriaExtraida[]>([]);
  const [notaAltura, setNotaAltura] = useState<string | null>(null);

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

    // La foto del convenio recién se sube a Blob acá, al confirmar — no
    // apenas se selecciona el archivo (manejarSeleccionImagen). Así una
    // imagen subida por error o nunca confirmada no queda guardada.
    let convenioImagenUrl: string | undefined;
    if (imagenPreview) {
      try {
        const resImagen = await fetch("/api/configuracion/convenio-imagen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagen: imagenPreview }),
        });
        if (resImagen.ok) {
          const data = await resImagen.json();
          convenioImagenUrl = data.url;
        } else {
          console.error("[guardarCambios] no se pudo subir la imagen del convenio");
        }
      } catch (err) {
        console.error("[guardarCambios] error al subir la imagen del convenio", err);
      }
    }

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
              ...(convenioImagenUrl !== undefined && { convenioImagenUrl }),
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
    setPropuestaExtraccion(null);
    setFilasNoIdentificadas([]);
    setNotaAltura(null);

    const reader = new FileReader();
    reader.onload = () => setImagenPreview(reader.result as string);
    reader.readAsDataURL(archivo);
  }

  async function extraerJornalesConIA() {
    if (!imagenPreview) return;

    setExtrayendo(true);
    setErrorExtraccion(null);
    setResumenExtraccion(null);
    setPropuestaExtraccion(null);
    setFilasNoIdentificadas([]);
    setNotaAltura(null);

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

      const identificadas = resultado.categorias.filter(
        (c): c is CategoriaExtraida & { categoriaRomano: string } => c.categoriaRomano !== null
      );
      const noIdentificadas = resultado.categorias.filter((c) => c.categoriaRomano === null);

      const jornalPorRomano: Record<string, number> = {};
      for (const c of identificadas) {
        jornalPorRomano[c.categoriaRomano] = c.jornal;
      }

      const propuestas: PropuestaCategoria[] = [];
      const yaPropuestas = new Set<string>();

      function agregarPropuesta(codigo: string, jornalDespues: number) {
        const categoria = categorias.find((cat) => cat.categoria === codigo);
        if (!categoria || yaPropuestas.has(categoria.id)) return;
        const jornalAntes = Number(jornales[categoria.id] ?? categoria.jornal);
        if (jornalAntes === jornalDespues) return;
        yaPropuestas.add(categoria.id);
        propuestas.push({
          categoriaId: categoria.id,
          nombre: categoria.nombre,
          jornalAntes,
          jornalDespues,
        });
      }

      // Categorías completas del laudo — mapeadas por número de categoría
      // (Cat. I..XII), nunca por la posición de la fila en la imagen.
      for (const [romano, jornal] of Object.entries(jornalPorRomano)) {
        const codigo = ROMANO_A_CODIGO_LAUDO[romano];
        if (codigo) agregarPropuesta(codigo, jornal);
      }

      // Flujo simplificado (Peón = Cat. I, Medio Oficial = Cat. V,
      // Oficial = Cat. VII) — anclado al mismo número de categoría.
      for (const [romano, codigo] of Object.entries(ROMANO_A_CODIGO_SIMPLIFICADO)) {
        const jornal = jornalPorRomano[romano];
        if (jornal != null) agregarPropuesta(codigo, jornal);
      }

      // Compensación por trabajo en altura — solo Oficial y Medio Oficial,
      // nunca Peón. Si la imagen no muestra el porcentaje, no se toca.
      let notaAlturaTexto: string | null = null;
      if (resultado.recargoAlturaPct != null) {
        const factor = 1 + resultado.recargoAlturaPct / 100;
        const jornalOficialBase =
          jornalPorRomano["VII"] ?? categorias.find((c) => c.categoria === "oficial")?.jornal;
        const jornalMedioOficialBase =
          jornalPorRomano["V"] ?? categorias.find((c) => c.categoria === "medio_oficial")?.jornal;

        if (jornalOficialBase != null) {
          agregarPropuesta("oficial_altura", Math.round(jornalOficialBase * factor * 100) / 100);
        }
        if (jornalMedioOficialBase != null) {
          agregarPropuesta(
            "medio_oficial_altura",
            Math.round(jornalMedioOficialBase * factor * 100) / 100
          );
        }
      } else {
        notaAlturaTexto =
          "No se detectó el porcentaje de compensación por trabajo en altura en la imagen — se mantiene el valor actual.";
      }

      if (resultado.fechaVigencia) {
        setFechaConvenio(resultado.fechaVigencia);
      }

      setPropuestaExtraccion(propuestas);
      setFilasNoIdentificadas(noIdentificadas);
      setNotaAltura(notaAlturaTexto);

      if (propuestas.length === 0) {
        setResumenExtraccion("No se detectaron cambios respecto a los valores actuales.");
      }
    } catch (err) {
      console.error(err);
      setErrorExtraccion(
        "No pude extraer los jornales con certeza. Intentá con una imagen más clara o ingresá los valores manualmente."
      );
    } finally {
      setExtrayendo(false);
    }
  }

  function aplicarPropuestaExtraccion() {
    if (!propuestaExtraccion || propuestaExtraccion.length === 0) return;

    setJornales((prev) => {
      const actualizados = { ...prev };
      for (const p of propuestaExtraccion) {
        actualizados[p.categoriaId] = String(p.jornalDespues);
      }
      return actualizados;
    });

    setResumenExtraccion(
      `Se aplicaron ${propuestaExtraccion.length} cambio${propuestaExtraccion.length === 1 ? "" : "s"} a la tabla. Revisá los valores y hacé clic en "Guardar cambios" para confirmarlos.`
    );
    setPropuestaExtraccion(null);
  }

  function descartarPropuestaExtraccion() {
    setPropuestaExtraccion(null);
    setResumenExtraccion(null);
  }

  const convenioDesactualizado = convenioPosiblementeDesactualizado(fechaConvenio || null);

  // Más reciente entre los actualizadoEn de los materiales de referencia
  // (no hay un campo único para "la lista completa" — cada fila se
  // actualiza por separado desde "Guardar cambios" acá abajo).
  const fechaUltimaActualizacionMateriales =
    materialesRef.length > 0
      ? materialesRef.reduce((masReciente, m) => (m.actualizadoEn > masReciente ? m.actualizadoEn : masReciente), materialesRef[0].actualizadoEn)
      : null;

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

            {notaAltura && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 mt-3 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{notaAltura}</span>
              </div>
            )}

            {filasNoIdentificadas.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 mt-3 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  No se pudo identificar con certeza a qué categoría corresponden{" "}
                  {filasNoIdentificadas.length === 1 ? "esta fila" : "estas filas"} de la imagen —
                  revisalas manualmente: {filasNoIdentificadas.map((f) => `"${f.nombreEnImagen}" ($${formatearJornal(f.jornal)})`).join(", ")}.
                </span>
              </div>
            )}

            {propuestaExtraccion && propuestaExtraccion.length > 0 && (
              <div className="border border-slate-200 rounded-lg mt-3 overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 text-sm font-medium text-[#1E293B] border-b border-slate-200">
                  Cambios detectados — revisá antes de aplicar
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 px-3 font-medium">Categoría</th>
                      <th className="py-2 px-3 font-medium">Antes</th>
                      <th className="py-2 px-3 font-medium"></th>
                      <th className="py-2 px-3 font-medium">Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propuestaExtraccion.map((p) => (
                      <tr key={p.categoriaId} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 px-3 text-[#1E293B]">{p.nombre}</td>
                        <td className="py-2 px-3 text-slate-500 tabular-nums">${formatearJornal(p.jornalAntes)}</td>
                        <td className="py-2 px-3 text-slate-400">→</td>
                        <td className="py-2 px-3 font-semibold text-[#2563EB] tabular-nums">${formatearJornal(p.jornalDespues)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center gap-3 px-3 py-3 bg-slate-50 border-t border-slate-200">
                  <button
                    onClick={aplicarPropuestaExtraccion}
                    className="bg-[#2563EB] text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#1d4ed8] transition-colors"
                  >
                    Aplicar cambios
                  </button>
                  <button
                    onClick={descartarPropuestaExtraccion}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Descartar
                  </button>
                </div>
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

        {convenioDesactualizado && fechaConvenio && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 mb-5 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>⚠️ {mensajeAvisoConvenio(fechaConvenio)}</span>
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
        <p className="text-sm text-slate-500 mb-1">
          Materiales de mampostería que no están en la Lista Oficial MTOP N°599 — precio de referencia editable.
        </p>
        <p className="text-xs text-slate-400 mb-4">
          Última actualización:{" "}
          {fechaUltimaActualizacionMateriales
            ? formatearFechaActualizacion(fechaUltimaActualizacionMateriales)
            : "Nunca actualizado"}
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

      <SeccionActualizacionDatos />
      <SeccionAplicarPreciosVigentes />
    </div>
  );
}
