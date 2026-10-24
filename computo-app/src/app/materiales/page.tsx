"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Package, Search, Upload, Loader2, Pencil } from "lucide-react";
import { ListaReferencias, type ReferenciaLink } from "@/components/ListaReferencias";
import { BadgeVerificacion, type FuenteMaterial } from "@/components/BadgeVerificacion";
import ModalImportarPrecios from "@/components/materiales/ModalImportarPrecios";
import SeccionActualizacionDatos from "@/components/materiales/SeccionActualizacionDatos";
import { BotonVolverAlProyecto } from "@/components/shared/BotonVolverAlProyecto";
import { anclaDeFiltro, EVENTO_FILTRO_MATERIALES, type AnclaFiltroMateriales } from "@/lib/filtrosMateriales";
import { detalleListaMTOP, type ListaMTOPVigente } from "@/lib/listaMTOP";
import { requiereVerificacionExplicita } from "@/lib/pendientesMateriales";
import { useRolUsuario, useSuperadmin } from "@/hooks/useSuperadmin";
import { cn } from "@/lib/utils";

// NOTA(multi-tenant): hoy el catálogo es global (compartido por todas las
// empresas), así que editarlo, importar listas y buscar precios es solo
// del SUPERADMIN (las APIs lo exigen desde la Fase 2; acá solo se ocultan
// los controles). El resto ve el catálogo en modo lectura. En la Fase 3
// cada empresa va a tener su PROPIA copia editable aquí mismo (nace de
// una semilla de MTOP/SUNCA oficial), y hará falta una pantalla de admin
// para mantener la plantilla maestra y propagarla sin pisar cambios.
// Antes vivía como sección aparte en /configuracion — acá es solo un
// filtro sobre el mismo catálogo y el mismo editor inline de siempre
// (por id), no un segundo mecanismo de edición por código en batch
// como el que reemplaza.
const CODIGOS_MATERIALES_REFERENCIA = new Set([
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
]);

// El número y el mes de la lista MTOP salen de la base (GET /api/precios-mtop/lista-vigente): la
// lista oficial más reciente cargada en el catálogo global. Sin lista, el texto va sin número.
function referenciasConLista(lista: ListaMTOPVigente | null): ReferenciaLink[] {
  const detalle = detalleListaMTOP(lista);
  return [
    {
      titulo: `Lista de Precios MTOP${detalle ? ` ${detalle}` : ""}`,
      descripcion: "Precios de materiales de construcción — Ministerio de Transporte",
      url: "https://www.gub.uy/ministerio-transporte-obras-publicas/tematica/precios-construccion",
    },
    ...REFERENCIAS_FIJAS,
  ];
}

const REFERENCIAS_FIJAS: ReferenciaLink[] = [
  {
    titulo: "Índice ICCV — INE",
    descripcion: "Índice del Costo de la Construcción de Vivienda",
    url: "https://www.ine.gub.uy",
  },
];

interface MaterialCatalogo {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number;
  cantidadUnidad: string;
  numeroLista: number;
  proveedor: string | null;
  notaProcedencia: string | null;
  fechaUltimaVerificacion: string | null;
  requiereVerificacion: boolean;
  motivoVerificacion: string | null;
  empresaId: string | null;
  actualizadoEn: string;
}

function fmtMon(v: number): string {
  if (!v) return "—";
  // Sin Math.round — los precios de materiales SÍ pueden tener centavos
  // (decisión de producto confirmada), el redondeo visual ocultaba el
  // valor real ya guardado correctamente en la base. Mismo criterio de
  // 2 decimales fijos que fmtMon() del proyecto (rubros).
  return `$ ${v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Parsea el precio tipeado a mano en el lápiz de edición — a propósito
// DISTINTO del criterio de Cantidad/Precio Unitario del rubro (valores
// chicos: m³, m², rendimientos, donde "." sí es decimal). Acá los precios
// suelen estar en el orden de los miles y la propia UI los muestra con
// punto como separador de miles al perder el foco (ver fmtMon) — si "."
// se leyera como decimal mientras se edita, lo tipeado ("1.800") dejaría
// de coincidir con lo que el usuario ve formateado un instante después
// ("$ 1.800"). Por eso acá "." se descarta siempre (nunca decimal) y
// solo "," representa el decimal.
function parsearPrecioTipeado(texto: string): number {
  return parseFloat(texto.replace(/\./g, "").replace(",", "."));
}

function fmtFecha(v: Date): string {
  return v.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Texto de la columna FUENTE. Solo visualización: la base no se toca. Las
// notas internas de carga no se muestran tal cual:
//  - "Estimado por IA (Claude)…" (seeds oct-2026) y "Backfill FEATURE <especialidad>…"
//    → estimación propia.
//  - "Derivado — modelo de regresión…", "Retro-derivado SAU 2022…", "Estimación
//    general de mercado / sin cotización", "ESTIMACIÓN…" y "Kit mensual de
//    consumibles…" → estimación propia.
//  - "Corregido oct-2026: el precio de la lista era por 1.000 unidades…" y
//    "Lista Oficial MTOP (código …)" → precio de la lista MTOP.
//  - "Precio de referencia de mercado…" y "Pendiente de verificar. Precio de
//    tienda publicado…" → fuente de mercado.
// Se evalúan en ese orden (estimación antes que MTOP: un derivado calculado a
// partir de la lista sigue siendo una estimación). Sin proveedor ni nota,
// numeroLista > 0 es una fila de la lista oficial MTOP y 0 un material de
// mercado sin lista.
const NOTA_ESTIMACION_PROPIA =
  /Estimado por IA|Backfill|FEATURE|Derivado|modelo de regresión|Kit mensual de consumibles/;
// Sin distinguir mayúsculas: "Retro-derivado"/"retro-derivado", y "estimación" cubre
// "Estimación general de mercado", "Estimación sin cotización" y "ESTIMACIÓN".
const NOTA_ESTIMACION_PROPIA_I = /retro-derivado|estimación/i;
const NOTA_FUENTE_MTOP = /Corregido\s+\S+-\d{4}|Lista Oficial MTOP/;
const NOTA_FUENTE_MERCADO = /Precio de referencia de mercado|Pendiente de verificar/;

// Precio estimado por CÓMPUTO+ (no es cotización directa): lo que la columna
// FUENTE muestra como "Estimado por CÓMPUTO+" y lo que filtra "Estimados —
// verificar". Un mismo criterio para los dos, así el filtro trae exactamente
// las filas que dicen eso.
function esEstimado(m: MaterialCatalogo): boolean {
  if (m.proveedor || !m.notaProcedencia || CODIGOS_MATERIALES_REFERENCIA.has(m.codigo)) return false;
  return NOTA_ESTIMACION_PROPIA.test(m.notaProcedencia) || NOTA_ESTIMACION_PROPIA_I.test(m.notaProcedencia);
}

function textoFuente(m: MaterialCatalogo): string {
  if (m.proveedor) return m.proveedor;
  // Los precios de plaza (mampostería fuera de la lista MTOP) traen
  // numeroLista = 599, el default del schema, no un número de lista real.
  if (CODIGOS_MATERIALES_REFERENCIA.has(m.codigo)) return "Fuente de mercado";
  if (esEstimado(m)) return "Estimado por CÓMPUTO+";
  if (m.notaProcedencia) {
    if (NOTA_FUENTE_MTOP.test(m.notaProcedencia)) return "Fuente MTOP";
    if (NOTA_FUENTE_MERCADO.test(m.notaProcedencia)) return "Fuente de mercado";
    return m.notaProcedencia;
  }
  return m.numeroLista > 0 ? "Fuente MTOP" : "Fuente de mercado";
}

// Fecha de la columna "Actualizado" — fechaUltimaVerificacion si existe
// (verificación real de precio de mercado, texto normal) o si no,
// actualizadoEn (fecha de carga/última edición del registro — nunca pasó
// por el sistema de verificación, por eso va un poco más clara: no hay que
// confundir "se cargó/corrigió" con "se verificó contra el mercado").
// Filtro "Fuente MTOP": exactamente las filas que la columna FUENTE muestra así.
function esFuenteMTOP(m: MaterialCatalogo): boolean {
  return textoFuente(m) === "Fuente MTOP";
}

// Botón de filtro de la fila de filtros — mismo estilo para todos, cambia el
// color cuando está activo.
const COLOR_FILTRO_ACTIVO = {
  rojo: "bg-red-50 text-red-600 border-red-200",
  ambar: "bg-amber-50 text-amber-600 border-amber-200",
  azul: "bg-blue-50 text-[#2563EB] border-blue-200",
} as const;

function BotonFiltro({
  activo,
  onClick,
  color,
  title,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  color: keyof typeof COLOR_FILTRO_ACTIVO;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex-shrink-0 whitespace-nowrap px-2.5 py-2 rounded-[8px] text-xs font-semibold border transition-colors",
        activo ? COLOR_FILTRO_ACTIVO[color] : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
      )}
    >
      {children}
    </button>
  );
}

function fechaColumna(m: MaterialCatalogo): { texto: string; verificada: boolean } {
  if (m.fechaUltimaVerificacion) {
    return { texto: fmtFecha(new Date(m.fechaUltimaVerificacion)), verificada: true };
  }
  return { texto: fmtFecha(new Date(m.actualizadoEn)), verificada: false };
}

// Fecha general del catálogo — el MAX entre fechaUltimaVerificacion (la
// última vez que un precio se confirmó/corrigió) y actualizadoEn (que
// @updatedAt toca en CUALQUIER escritura, incluida la creación) de TODOS
// los materiales. No es "por material" — ese detalle ya vive en el
// tooltip del badge de cada fila (BadgeVerificacion), esto no lo toca.
function calcularFechaMaxima(materiales: MaterialCatalogo[]): Date | null {
  let max: Date | null = null;
  for (const m of materiales) {
    for (const raw of [m.fechaUltimaVerificacion, m.actualizadoEn]) {
      if (!raw) continue;
      const fecha = new Date(raw);
      if (Number.isNaN(fecha.getTime())) continue;
      if (!max || fecha > max) max = fecha;
    }
  }
  return max;
}

// useSearchParams() exige un límite de Suspense alrededor — ver el export
// default más abajo, que envuelve esto para poder leer ?q=/&from= del
// deep-link desde "Pendiente de verificar" en el drawer del APU.
function MaterialesPageInner() {
  const searchParams = useSearchParams();
  // Descripción exacta del material y id del proyecto de origen — solo
  // presentes cuando se llega acá vía el deep-link de "Pendiente de
  // verificar" (ver irAMaterialPendiente en proyectos/[id]/page.tsx). Se
  // leen una sola vez al montar: si el usuario despeja el buscador a mano
  // después, no queremos que un re-render los vuelva a imponer.
  const qInicial = useRef(searchParams.get("q")).current;
  // null (cargando) cuenta como "no": sin flash de controles de edición.
  const puedeEditar = useSuperadmin() === true;
  // Importar listas de precios: SUPERADMIN (catálogo global, incluida la lista oficial) y ADMIN
  // (solo listas de proveedor, privadas de su empresa). Editar precios sigue siendo del SUPERADMIN.
  const rol = useRolUsuario();
  const esSuperadmin = rol === "SUPERADMIN";
  const puedeImportar = esSuperadmin || rol === "ADMIN";

  const [materiales, setMateriales] = useState<MaterialCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState(qInicial ?? "");
  const [filtroSinPrecio, setFiltroSinPrecio] = useState(false);
  const [filtroPendiente, setFiltroPendiente] = useState(false);
  // "Requieren verificación": solo los marcados explícitamente (el mismo
  // criterio y el mismo número que la campanita — ver lib/pendientesMateriales.ts).
  // No es lo mismo que "Pendiente de verificar" (nunca verificados, mucho más amplio).
  const [filtroRequiere, setFiltroRequiere] = useState(false);
  const [filtroEstimados, setFiltroEstimados] = useState(false);
  const [filtroReferencia, setFiltroReferencia] = useState(false);
  const [filtroFuenteMTOP, setFiltroFuenteMTOP] = useState(false);
  const [filtroMisFuentes, setFiltroMisFuentes] = useState(false);
  // Se aplica una sola vez, apenas cargan los materiales — ver el efecto
  // más abajo que decide si corresponde prender filtroPendiente.
  const filtroAutoAplicado = useRef(false);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);
  // Material cuyo precio está en edición inline (click-to-edit) — mismo
  // patrón que precioEditId en DrawerAPU (proyectos/[id]/page.tsx).
  const [precioEditId, setPrecioEditId] = useState<string | null>(null);
  // Texto crudo tipeado mientras precioEditId está activo — mismo criterio
  // que el fix de Cantidad/Precio Unitario del rubro (commit 05c2953):
  // el input muestra este texto tal cual, sin reconstruirlo desde el
  // número parseado en cada tecla, así "." o "," nunca desaparecen a
  // mitad de tipeo.
  const [precioEditTexto, setPrecioEditTexto] = useState("");
  const [guardandoPrecioId, setGuardandoPrecioId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    fetch("/api/precios-mtop")
      .then((r) => r.json())
      .then((data) => setMateriales(Array.isArray(data) ? data : []))
      .catch(() => setMateriales([]))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const [listaMTOP, setListaMTOP] = useState<ListaMTOPVigente | null>(null);
  useEffect(() => {
    let cancelado = false;
    fetch("/api/precios-mtop/lista-vigente")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelado) setListaMTOP(data?.lista ?? null);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  const proveedoresExistentes = useMemo(() => {
    const set = new Set<string>();
    for (const m of materiales) if (m.proveedor) set.add(m.proveedor);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [materiales]);

  // Guarda el precio corregido inline y actualiza el material local (sin
  // re-fetch de toda la tabla) con lo que devuelve el server — mismo
  // criterio que sincronizarPrecioMTOP en proyectos/[id]/page.tsx: así el
  // badge y la columna "Actualizado" pasan a "Verificado" al instante.
  async function guardarPrecio(id: string, valor: number) {
    setPrecioEditId(null);
    if (!Number.isFinite(valor) || valor <= 0) return;
    const actual = materiales.find((m) => m.id === id);
    if (actual && actual.precioUnitario === valor) return; // sin cambios, no pega al servidor

    setGuardandoPrecioId(id);
    try {
      const res = await fetch(`/api/precios-mtop/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precioUnitario: valor }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setMateriales((prev) =>
        prev.map((m) =>
          m.id !== id
            ? m
            : {
                ...m,
                precioUnitario: data.precioUnitario,
                fechaUltimaVerificacion: data.fechaUltimaVerificacion,
                requiereVerificacion: data.requiereVerificacion,
                motivoVerificacion: data.motivoVerificacion,
                actualizadoEn: data.fechaUltimaVerificacion ?? m.actualizadoEn,
              }
        )
      );
    } catch (err) {
      console.error("[editar precio inline]", err);
    } finally {
      setGuardandoPrecioId(null);
    }
  }

  function esPendiente(m: MaterialCatalogo): boolean {
    return !!(m.proveedor || m.notaProcedencia) && !m.fechaUltimaVerificacion;
  }

  // Deep-link desde la campanita: el ancla de la URL prende el filtro que
  // corresponde, igual que si se lo hubiera tocado a mano — #a-revisar →
  // "Requieren verificación", #sin-precio → "Sin precio". Sin ancla (o con
  // otra) no se toca nada. El ancla no llega al servidor ni a
  // useSearchParams, así que se lee en el cliente: al montar y cuando
  // cambia estando ya en la página (por ejemplo, desde la propia campanita).
  useEffect(() => {
    // Cada ancla deja prendido solo su filtro (los otros pendientes se apagan:
    // si no, mezclados darían una lista que no coincide con el número de la campanita).
    const aplicar = (ancla: AnclaFiltroMateriales | null) => {
      if (!ancla) return;
      setFiltroRequiere(ancla === "a-revisar");
      setFiltroSinPrecio(ancla === "sin-precio");
      setFiltroPendiente(false);
    };
    const delaUrl = () => aplicar(anclaDeFiltro(window.location.hash));
    const delaCampanita = (e: Event) => aplicar((e as CustomEvent<AnclaFiltroMateriales>).detail);
    delaUrl();
    window.addEventListener("hashchange", delaUrl);
    window.addEventListener(EVENTO_FILTRO_MATERIALES, delaCampanita);
    return () => {
      window.removeEventListener("hashchange", delaUrl);
      window.removeEventListener(EVENTO_FILTRO_MATERIALES, delaCampanita);
    };
  }, []);

  // Deep-link desde "Pendiente de verificar" (ver qInicial arriba) — si
  // hay una coincidencia EXACTA de descripción que además está pendiente,
  // prendemos también el filtro "Pendiente de verificar" para que quede
  // una sola fila a la vista. Si hay más de una coincidencia por texto
  // (match parcial, no exacto), no forzamos nada — el buscador ya las
  // muestra todas. Se corre una sola vez, apenas termina de cargar el
  // catálogo (no en cada cambio de "materiales").
  useEffect(() => {
    if (filtroAutoAplicado.current || !qInicial || materiales.length === 0) return;
    filtroAutoAplicado.current = true;
    const qNorm = qInicial.trim().toLowerCase();
    const hayExactoPendiente = materiales.some(
      (m) => m.descripcion.trim().toLowerCase() === qNorm && esPendiente(m)
    );
    if (hayExactoPendiente) setFiltroPendiente(true);
  }, [materiales, qInicial]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return materiales.filter((m) => {
      if (q && !m.descripcion.toLowerCase().includes(q)) return false;
      if (filtroSinPrecio && m.precioUnitario > 0) return false;
      // El filtro solo existe para el SUPERADMIN (puede haberlo prendido un deep-link).
      if (filtroPendiente && puedeEditar && !esPendiente(m)) return false;
      if (filtroRequiere && !requiereVerificacionExplicita(m)) return false;
      if (filtroEstimados && !esEstimado(m)) return false;
      if (filtroReferencia && !CODIGOS_MATERIALES_REFERENCIA.has(m.codigo)) return false;
      if (filtroFuenteMTOP && !esFuenteMTOP(m)) return false;
      if (filtroMisFuentes && !m.empresaId) return false;
      return true;
    });
  }, [
    materiales,
    busqueda,
    filtroSinPrecio,
    filtroPendiente,
    puedeEditar,
    filtroRequiere,
    filtroEstimados,
    filtroReferencia,
    filtroFuenteMTOP,
    filtroMisFuentes,
  ]);

  // Mismo conteo que "materiales requieren verificación" de la campanita.
  const cantidadRequieren = useMemo(() => materiales.filter(requiereVerificacionExplicita).length, [materiales]);

  const fechaMaxima = useMemo(() => calcularFechaMaxima(materiales), [materiales]);
  const cantidadEstimados = useMemo(() => materiales.filter(esEstimado).length, [materiales]);
  const cantidadFuenteMTOP = useMemo(() => materiales.filter(esFuenteMTOP).length, [materiales]);
  const cantidadMisFuentes = useMemo(() => materiales.filter((m) => m.empresaId).length, [materiales]);

  return (
    <div className="p-8 max-w-5xl">
      <BotonVolverAlProyecto />
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">Materiales</h1>
          {/* Vista por rol: el SUPERADMIN mantiene el catálogo global con la lista
              oficial del MTOP; ADMIN y USUARIO lo consultan (el ADMIN además puede
              importar listas de su proveedor, privadas de su empresa). Mientras carga
              el rol (null) se ve la vista de USUARIO: sin controles que después se van. */}
          {esSuperadmin ? (
            <>
              <p className="text-slate-500">
                Catálogo de materiales de construcción y sus precios de referencia — {materiales.length} en total.
              </p>
              <p className="text-sm text-slate-400 mt-2 max-w-2xl">
                Para actualizar el catálogo: descargá la lista oficial del MTOP desde el enlace de abajo e importala
                con el botón <span className="font-medium text-slate-500">Importar lista de precios</span>.
              </p>
              {!cargando && (
                <p className="text-xs text-slate-400 mt-1.5">
                  Catálogo actualizado al: {fechaMaxima ? fmtFecha(fechaMaxima) : "Sin actualizaciones registradas"}
                </p>
              )}
            </>
          ) : (
            <p className="text-slate-500 max-w-2xl">
              Catálogo de materiales con precios de referencia tomados de la fuente oficial MTOP y otras fuentes de
              mercado.
              {!cargando && fechaMaxima && <> Actualizado al {fmtFecha(fechaMaxima)}.</>}
              {puedeImportar && <> También podés importar los precios de tu propio proveedor.</>}
            </p>
          )}
        </div>
        {puedeImportar && (
          <button
            onClick={() => setModalImportarAbierto(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] transition-colors"
          >
            <Upload className="w-4 h-4" />
            {esSuperadmin ? "Importar lista de precios" : "Importar precios de proveedor"}
          </button>
        )}
      </div>

      <div className="mb-8">
        {/* La tarjeta de la Lista MTOP (link al Ministerio) es para mantener el catálogo: solo SUPERADMIN. */}
        <ListaReferencias items={esSuperadmin ? referenciasConLista(listaMTOP) : REFERENCIAS_FIJAS} />
      </div>

      {/* Buscador + filtros en una sola fila: si no entran (pantalla chica, o el
          filtro extra del SUPERADMIN), la fila se desplaza horizontalmente en vez
          de partirse en dos renglones. */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <div className="relative flex-shrink-0 w-56">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por descripción..."
            className="w-full pl-9 pr-3 py-2 rounded-[10px] border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
          />
        </div>
        <BotonFiltro activo={filtroSinPrecio} onClick={() => setFiltroSinPrecio((p) => !p)} color="rojo">
          Sin precio
        </BotonFiltro>
        {puedeEditar && (
          <BotonFiltro activo={filtroPendiente} onClick={() => setFiltroPendiente((p) => !p)} color="ambar">
            Pendiente de verificar
          </BotonFiltro>
        )}
        <BotonFiltro
          activo={filtroRequiere}
          onClick={() => setFiltroRequiere((p) => !p)}
          color="ambar"
          title={
            puedeEditar
              ? "Materiales marcados como que requieren verificación (el mismo número que la campanita). 'Pendiente de verificar' es más amplio: todos los que nunca se verificaron."
              : "Materiales marcados como que requieren verificación (el mismo número que la campanita)."
          }
        >
          Requieren verificación{materiales.length > 0 ? ` (${cantidadRequieren})` : ""}
        </BotonFiltro>
        <BotonFiltro
          activo={filtroEstimados}
          onClick={() => setFiltroEstimados((p) => !p)}
          color="ambar"
          title="Precios calculados internamente por CÓMPUTO+ — no son cotizaciones directas"
        >
          Estimados — verificar{materiales.length > 0 ? ` (${cantidadEstimados})` : ""}
        </BotonFiltro>
        <BotonFiltro
          activo={filtroReferencia}
          onClick={() => setFiltroReferencia((p) => !p)}
          color="azul"
          title="Materiales de mampostería y básicos que no están en la lista oficial MTOP — precio de plaza"
        >
          Precios de plaza ({CODIGOS_MATERIALES_REFERENCIA.size})
        </BotonFiltro>
        <BotonFiltro activo={filtroFuenteMTOP} onClick={() => setFiltroFuenteMTOP((p) => !p)} color="azul">
          Fuente MTOP{materiales.length > 0 ? ` (${cantidadFuenteMTOP})` : ""}
        </BotonFiltro>
        <BotonFiltro
          activo={filtroMisFuentes}
          onClick={() => setFiltroMisFuentes((p) => !p)}
          color="azul"
          title="Materiales importados por tu empresa desde tus propias listas de precios"
        >
          Mis fuentes ({cantidadMisFuentes})
        </BotonFiltro>
      </div>

      {/* Una leyenda por filtro activo (se pueden combinar). */}
      {(filtroSinPrecio || (puedeEditar && filtroPendiente) || filtroRequiere || filtroEstimados || filtroReferencia) && (
        <div className="-mt-2 mb-4 space-y-1 text-xs text-slate-400 max-w-3xl">
          {filtroSinPrecio && (
            <p>
              <span className="font-medium text-slate-500">Sin precio:</span> Materiales sin precio de referencia
              cargado. Cotizalos con tu proveedor antes de usarlos en un presupuesto.
            </p>
          )}
          {puedeEditar && filtroPendiente && (
            <p>
              <span className="font-medium text-slate-500">Pendiente de verificar:</span> Materiales que aún no
              pasaron por el proceso de verificación de precios. Revisalos antes de usarlos en un presupuesto.
            </p>
          )}
          {filtroRequiere && (
            <p>
              <span className="font-medium text-slate-500">Requieren verificación:</span> El sistema detectó que estos
              precios pueden estar desactualizados. Verificalos con cotizaciones recientes antes de presupuestar.
            </p>
          )}
          {filtroEstimados && (
            <p>
              <span className="font-medium text-slate-500">Estimados — verificar:</span> Precios calculados
              internamente por CÓMPUTO+ a partir de referencias de mercado. No son cotizaciones directas. Confirmá con
              tu proveedor antes de usar en presupuestos.
            </p>
          )}
          {filtroReferencia && (
            <p>
              <span className="font-medium text-slate-500">Precios de plaza:</span> Materiales de mampostería y
              básicos que no están en la lista oficial MTOP. Sus precios se tomaron del mercado local. Verificalos
              periódicamente con tu proveedor.
            </p>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-[16px] border border-slate-200 bg-white overflow-hidden">
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando materiales...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <Package className="w-5 h-5 text-[#2563EB]" />
            </div>
            <p className="text-sm text-slate-500 max-w-sm">
              {materiales.length === 0
                ? "Todavía no hay materiales cargados."
                : "Ningún material coincide con la búsqueda o los filtros elegidos."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                    Descripción
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                    Unidad
                  </th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                    Precio
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                    Fuente
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                    Actualizado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => {
                  const fuente: FuenteMaterial = {
                    proveedor: m.proveedor,
                    notaProcedencia: m.notaProcedencia,
                    nombreProducto: null,
                    urlReferencia: null,
                    fechaUltimaVerificacion: m.fechaUltimaVerificacion,
                    requiereVerificacion: m.requiereVerificacion,
                    motivoVerificacion: m.motivoVerificacion,
                  };
                  const fecha = fechaColumna(m);
                  const fuenteTexto = textoFuente(m);
                  return (
                    <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700">{m.descripcion}</span>
                          <BadgeVerificacion fuente={fuente} ocultarPendiente={!puedeEditar} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{m.unidad}</td>
                      <td className="px-4 py-2.5 text-right">
                        {!puedeEditar ? (
                          <span className="tabular-nums font-medium text-slate-700">{fmtMon(m.precioUnitario)}</span>
                        ) : precioEditId === m.id ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            value={precioEditTexto}
                            onChange={(e) => setPrecioEditTexto(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => guardarPrecio(m.id, parsearPrecioTipeado(precioEditTexto))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setPrecioEditId(null);
                            }}
                            placeholder="0.00"
                            className="w-24 text-right text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 tabular-nums"
                          />
                        ) : (
                          <div className="relative group inline-flex items-center gap-1.5 justify-end w-full">
                            {guardandoPrecioId === m.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setPrecioEditId(m.id);
                                  setPrecioEditTexto(m.precioUnitario ? String(m.precioUnitario) : "");
                                }}
                                title="Editar precio"
                                className="opacity-40 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-[#2563EB] transition-opacity"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            <span className="tabular-nums font-medium text-slate-700">{fmtMon(m.precioUnitario)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-slate-500 block max-w-[260px] whitespace-normal break-words" title={fuenteTexto}>
                          {fuenteTexto}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            // Mismo tamaño y renglón para toda la columna; la fecha sin verificar
                            // va apenas más clara (antes slate-300, casi ilegible sobre blanco).
                            "text-xs tabular-nums whitespace-nowrap",
                            fecha.verificada ? "text-slate-600" : "text-slate-500"
                          )}
                          title={fecha.verificada ? undefined : "Precio de referencia de fuente de mercado"}
                        >
                          {fecha.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!cargando && materiales.length > 0 && (
        <p className="text-xs text-slate-400 mt-2">
          Mostrando {filtrados.length} de {materiales.length}.
        </p>
      )}

      {/* Antes vivía en /configuracion — movida acá porque es contenido
          específico de este catálogo, sin cambios funcionales (ver
          NOTA(multi-tenant) en el propio componente). */}
      <div className="mt-8">
        <SeccionActualizacionDatos esSuperadmin={puedeEditar} />
      </div>

      {puedeImportar && modalImportarAbierto && (
        <ModalImportarPrecios
          esSuperadmin={puedeEditar}
          proveedoresExistentes={proveedoresExistentes}
          onClose={() => setModalImportarAbierto(false)}
          onImportado={cargar}
        />
      )}
    </div>
  );
}

export default function MaterialesPage() {
  return (
    <Suspense fallback={null}>
      <MaterialesPageInner />
    </Suspense>
  );
}
