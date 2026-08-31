"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import * as XLSX from "xlsx-js-style";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Download,
  FileSpreadsheet,
  FileSignature,
  Pencil,
  X,
  LayoutList,
  Trash2,
  Loader2,
  AlertTriangle,
  Info,
  RefreshCw,
  HardHat,
  ClipboardCheck,
  Lock,
  LockOpen,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { costoUnitEfectivo, manoObraIncluida, sumEquipos, sumManoObra, tieneMaterialPiedra, recalcularMaterialesPorPiedra, calcularPrecioUnitario, montoAportesPatronales, sumarAportesPatronalesPct, APORTES_PATRONALES_PCT_LEGAL_DEFAULT } from "@/lib/apu-calc";
import { computarMaterialesGlobales } from "@/lib/materialesGlobales";
import { COL_ICONO, GRID_CAPITULO, GRID_RUBRO } from "@/lib/layoutTablaPresupuesto";
import { calcularCostoDirectoAgregado, calcularCostosIndirectosAgregados, calcularUtilidadAgregada } from "@/lib/costoAgregado";
import { convenioPosiblementeDesactualizado, mensajeAvisoConvenio } from "@/lib/convenioSunca";
import SeccionLeyesSociales, { LeyesSocialesData } from "@/components/SeccionLeyesSociales";
import SeccionResumenPresupuesto, { GastoGeneralItem } from "@/components/SeccionResumenPresupuesto";
import SeccionGastosGeneralesUtilidades, {
  CategoriaGastoGeneral,
  ModoGastosGenerales,
} from "@/components/SeccionGastosGeneralesUtilidades";
import { TarjetaCostoDirecto, TarjetaCostoTotalPrecioFinal } from "@/components/SeccionCostoPrecioFinal";
import SeccionGarantias from "@/components/SeccionGarantias";
import SeccionCertificaciones from "@/components/SeccionCertificaciones";
import SeccionComparativoOfertas from "@/components/SeccionComparativoOfertas";
import SeccionCronograma from "@/components/SeccionCronograma";
import SeccionPartidasFaltantes from "@/components/SeccionPartidasFaltantes";
import SeccionComputoGlobalMateriales from "@/components/SeccionComputoGlobalMateriales";
import SeccionMemoriaDescriptiva from "@/components/SeccionMemoriaDescriptiva";
import SeccionActualizacionPrecios from "@/components/SeccionActualizacionPrecios";
import SeccionDocumentacionLlamado from "@/components/SeccionDocumentacionLlamado";
import { SelectorCapitulosEstandar, type CapituloSeleccionable } from "@/components/SelectorCapitulosEstandar";
import { BadgeVerificacion, type FuenteMaterial } from "@/components/BadgeVerificacion";

// SeccionMetrajesPresupuesto (vía SeccionPlanos/VisorPlano) importa react-pdf
// (pdf.js), que revienta con "DOMMatrix is not defined" si su módulo se
// evalúa en el servidor. Esta página es "use client" pero de todos modos se
// renderiza una vez en el servidor para el HTML inicial — con ssr:false
// nunca se evalúa ahí, solo en el browser (mismo criterio que ya usaba la
// vieja página /proyectos/[id]/metrajes).
const SeccionMetrajesPresupuesto = dynamic(
  () => import("@/components/metrajes/SeccionMetrajesPresupuesto"),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm p-4 mb-6">
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
    ),
  }
);

/* ─── Tipo Proyecto ───────────────────────────────────────── */
interface ProyectoData {
  id: string;
  nombre: string;
  cliente: string;
  tipo: string;
  // Descripción de los trabajos — la misma que alimenta "Sugerir con IA"
  // en el asistente de "Nuevo proyecto" (ver SelectorCapitulosEstandar),
  // reusada acá para el selector de capítulos por título.
  descripcion?: string;
  tipoContratacion?: string;
  estado: keyof typeof ESTADOS;
  moneda: string;
  area: number;
  direccion: string;
  memoriaDescriptiva?: string | null;
  createdAt?: string | null;
  fechaBaseIndice?: string | null;
  ultimaActualizacionIndice?: string | null;
  generandoRubros?: boolean;
  incluyeIVA?: boolean;
  timbresCJP?: number;
  gastosGeneralesItems?: GastoGeneralItem[];
  // Default de GG%/Utilidad% para rubros nuevos, y desglose del modo
  // Detallado — ver SeccionGastosGeneralesUtilidades.tsx. null/undefined en
  // los %s = comportamiento histórico (15/10).
  gastosGeneralesPctDefault?: number | null;
  utilidadPctDefault?: number | null;
  modoGastosGenerales?: ModoGastosGenerales;
  gastosGeneralesDetallado?: CategoriaGastoGeneral[] | null;
  // Se carga desde /editar — acá es de solo lectura, mostrada al pie del
  // presupuesto junto a donde eventualmente va a vivir el Plazo de obra
  // calculado (ver placeholder más abajo, todavía sin implementar).
  fechaInicio?: string | null;
  plazoObra?: number | null;
  diasLaborales?: number | null;
  // "Forma de realización de la obra" — igual que fechaInicio, se carga
  // desde /editar, acá es de solo lectura. La Cuantía (Menor/Mayor) que se
  // muestra junto a esto NO vive en este campo — se recalcula siempre a
  // partir del presupuesto vigente (ver computarCuantiaObra más abajo).
  modalidadEjecucion?: string | null;
  garantiaFielCumplimiento?: string | null;
  garantiaViciosOcultos?: string | null;
  garantiaResponsabilidad?: string | null;
  fechaUltimaEntrega?: string | null;
}

/* ─── Tipos base ──────────────────────────────────────────── */
interface Rubro {
  id: string;
  descripcion: string;
  unidad: string;
  cantidad: number | null;
  precioUnit: number | null;
  // Snapshot de precioUnit al último "Entregar" — null = rubro nuevo,
  // agregado después de esa entrega (ver lib/recalcularPrecioRubro.ts).
  precioCongelado?: number | null;
  trabajoEnAltura?: boolean;
}

interface Capitulo {
  id: string;
  nombre: string;
  codigo?: string;
  color?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  rubros: Rubro[];
  // Fase 2, Etapa 4/5 — FK al catálogo canónico. Ya viene en la respuesta
  // de /api/proyectos/[id] hoy (Prisma incluye todos los escalares), solo
  // faltaba declararlo acá para poder leerlo.
  capituloCatalogoId?: string | null;
  // Título al que pertenece — todo capítulo tiene siempre uno (ver model
  // Titulo en schema.prisma). Opcional/nullable acá solo por el tipado
  // laxo del fetch inicial, nunca es null en la práctica.
  tituloId?: string | null;
}

// Agrupador opcional de capítulos dentro de un proyecto — un Proyecto
// puede tener varios Títulos, cada uno con varios Capítulos adentro. Sin
// estado propio: todo el proyecto se entrega/congela junto (ver
// "Entregar"), un Título es puro agrupamiento visual/de export.
interface Titulo {
  id: string;
  nombre: string;
  orden: number;
  color?: string;
}

interface SubrubroEstandar {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUY: number;
  fechaBase: string;
  aportesSociales: number;
  tieneApuEstandar?: boolean;
  // Fase 2 — FK al catálogo canónico (ver FASE2-DISENO-UNIFICACION-TAXONOMIAS.md)
  capituloId?: string | null;
  subcapituloId?: string | null;
  // Fase 2, Etapa 6a — nombre del subcapítulo resuelto vía subcapituloId
  // (relación), en vez de leer el string subcapitulo directo.
  subcapituloNombre?: string | null;
}

// Fase 2 — catálogo canónico (CapituloCatalogo/SubcapituloCatalogo),
// tal como lo devuelve /api/catalogo-capitulos.
interface SubcapituloCatalogoInfo {
  id: string;
  nombre: string;
}
interface CapituloCatalogoInfo {
  id: string;
  nombre: string;
  subcapitulos: SubcapituloCatalogoInfo[];
}

// Unidades estándar para el selector de unidad del rubro — evita texto
// libre que termine con la misma unidad escrita distinto (ej. "m²" vs "M2").
const UNIDADES_ESTANDAR = ["M2", "M3", "ML", "KG", "TN", "GL", "U", "JORNADA"];

// toUpperCase() no convierte "²"/"³" (no son letras) — se reemplazan
// explícitamente para reconocer "m²" como "M2".
function normalizarUnidad(unidad: string): string {
  return unidad.toUpperCase().replace(/²/g, "2").replace(/³/g, "3");
}

// CAPITULOS_SAU/obtenerMapeoSAU viven en src/lib/capitulosSau.ts. Desde la
// Etapa 6b ya no se consumen acá (el fallback por alias se eliminó junto
// con las columnas string de SubrubroEstandar) — el único consumidor que
// queda es resolverCapituloCatalogoId() en el servidor, al crear un
// capítulo real (Etapa 5, Paso 1).

/* ─── Tipos APU ───────────────────────────────────────────── */
interface ComponenteInsumo {
  id: string;
  descripcion: string;
  unidad: string;
  rendimientoPorUnidad: number;
  precioUnit?: number;
}

interface InsumoAPU {
  id: string;
  descripcion: string;
  unidad: string;
  rendimiento: number;
  precioUnit: number;
  dosificacion?: string;
  componentes?: ComponenteInsumo[];
  codigoMTOP?: string;       // código de la lista oficial si fue seleccionado
  precioMTOPOrig?: number;   // precio original MTOP para detectar modificaciones
  precioEstimadoIA?: boolean; // precio recién estimado por IA, aún no confirmado por el usuario
  // Propagado desde PrecioMTOP.motivoVerificacion al clonar desde la
  // biblioteca — ver BadgeVerificacion. null/undefined = sin motivo
  // conocido (cae al mensaje genérico "Precio incompleto").
  motivoVerificacion?: string | null;
  // Mismo origen que motivoVerificacion, agregados después — sin estos,
  // BadgeVerificacion no puede distinguir "Pendiente de verificar" (sin
  // motivo, sin fecha) de "genuinamente verificado" (sin motivo, con
  // fecha) acá en DrawerAPU.
  proveedor?: string | null;
  fechaUltimaVerificacion?: string | null;
}

interface PrecioMTOPResult {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number;
  numeroLista: number;
}

interface PrecioEquipoResult {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioHora: number;
}

interface ManoObraAPU {
  id: string;
  categoria: string;
  jornadaHs: number;
  rendimiento: number;
  jornalRef: number;
  equipoRelacionadoId?: string | null; // vincula esta línea al armado/desarme de un equipo
}

/* ─── Categoría laboral SUNCA ─────────────────────────────── */
interface CategoriaLaboral {
  id: string;
  nombre: string;
  categoria: string;
  jornal: number;
}

type ModoCosteoEquipo = "ALQUILADO" | "PROPIO_CON_COSTO" | "PROPIO_SIN_COSTO";

interface EquipoAPU {
  id: string;
  descripcion: string;
  unidad: string;
  rendimiento: number;
  costoUnit: number;
  modoCosteo?: ModoCosteoEquipo;
  costoUnitPropio?: number | null;
  // "sin_costo_referencia" si no matcheó ningún PrecioEquipo al clonar
  // desde la biblioteca — ver BadgeVerificacion.
  motivoVerificacion?: string | null;
}

interface APU {
  materiales: InsumoAPU[];
  manoObra: ManoObraAPU[];
  equipos: EquipoAPU[];
  gastosGeneralesPct: number;
  utilidadPct: number;
  // % de Aportes Patronales BPS (Empresa paga), aplicado solo sobre Mano de
  // Obra dentro de Costo Directo — congelado al crearse el APU, igual que
  // gastosGeneralesPct/utilidadPct (ver montoAportesPatronales en apu-calc.ts).
  aportesPatronalesPct: number;
  // % de piedra bruta sobre 1 m3 en hormigón ciclópeo — solo relevante si
  // hay un material "Piedra bruta" en la lista (ver tieneMaterialPiedra).
  porcentajePiedra?: number;
}

/* ─── Datos de prueba ─────────────────────────────────────── */
const PROYECTO = {
  id: "1",
  nombre: "Vivienda unifamiliar — Pocitos",
  cliente: "Familia González",
  tipo: "Vivienda unifamiliar",
  descripcion: "",
  tipoContratacion: "PRIVADA",
  estado: "EN_CURSO" as const,
  moneda: "USD",
  area: 120,
  direccion: "Bulevar España 2345, Montevideo",
  memoriaDescriptiva: null as string | null,
  createdAt: null as string | null,
  fechaInicio: null as string | null,
  fechaBaseIndice: null as string | null,
  ultimaActualizacionIndice: null as string | null,
  garantiaFielCumplimiento: null as string | null,
  garantiaViciosOcultos: null as string | null,
  garantiaResponsabilidad: null as string | null,
  modalidadEjecucion: null as string | null,
};

const ESTADOS = {
  EN_CURSO:   { label: "En curso",   color: "#2563EB", bg: "#EFF6FF" },
  BORRADOR:   { label: "Borrador",   color: "#64748B", bg: "#F1F5F9" },
  FINALIZADO: { label: "Finalizado", color: "#16A34A", bg: "#F0FDF4" },
  PAUSADO:    { label: "Pausado",    color: "#D97706", bg: "#FFFBEB" },
};

const CAPITULOS_INICIALES: Capitulo[] = [
  {
    id: "c01",
    nombre: "Trabajos preliminares",
    rubros: [
      { id: "r001", descripcion: "Limpieza de terreno",  unidad: "m²", cantidad: 120, precioUnit: 8  },
      { id: "r002", descripcion: "Replanteo",            unidad: "m²", cantidad: 120, precioUnit: 5  },
      { id: "r003", descripcion: "Obrador provisorio",   unidad: "gl", cantidad: 1,   precioUnit: null },
    ],
  },
  {
    id: "c02",
    nombre: "Movimiento de tierra y fundaciones",
    rubros: [
      { id: "r004", descripcion: "Excavación manual",          unidad: "m³", cantidad: 45,  precioUnit: 38  },
      { id: "r005", descripcion: "Fundación corrida H°A°",     unidad: "m³", cantidad: 12,  precioUnit: 420 },
      { id: "r006", descripcion: "Relleno y compactación",     unidad: "m³", cantidad: 20,  precioUnit: 22  },
    ],
  },
  {
    id: "c03",
    nombre: "Estructura",
    rubros: [
      { id: "r007", descripcion: "Pilar sección 25×25 cm",    unidad: "ml", cantidad: 48,  precioUnit: 185 },
      { id: "r008", descripcion: "Viga de arriostre",          unidad: "ml", cantidad: 62,  precioUnit: 95  },
      { id: "r009", descripcion: "Losa maciza e=12 cm",        unidad: "m²", cantidad: 95,  precioUnit: 210 },
    ],
  },
  { id: "c04", nombre: "Mampostería y muros",      rubros: [] },
  { id: "c05", nombre: "Cubierta",                 rubros: [] },
  { id: "c06", nombre: "Revoques y enlucidos",     rubros: [] },
  { id: "c07", nombre: "Revestimientos y pisos",   rubros: [] },
  { id: "c08", nombre: "Carpintería",              rubros: [] },
  { id: "c09", nombre: "Instalación sanitaria",    rubros: [] },
  { id: "c10", nombre: "Instalación eléctrica",    rubros: [] },
  { id: "c11", nombre: "Instalación de gas",       rubros: [] },
  { id: "c12", nombre: "Instalaciones embutidas",  rubros: [] },
  { id: "c13", nombre: "Calefacción",              rubros: [] },
  { id: "c14", nombre: "Pintura",                  rubros: [] },
  { id: "c15", nombre: "Vidriería",                rubros: [] },
  { id: "c16", nombre: "Herrería y metálica",      rubros: [] },
  { id: "c17", nombre: "Obras exteriores y paisajismo", rubros: [] },
  { id: "c18", nombre: "Honorarios profesionales", rubros: [] },
  { id: "c19", nombre: "Imprevistos",              rubros: [] },
];

const APU_INICIALES: Record<string, APU> = {
  r001: {
    materiales: [{ id: "m1", descripcion: "Bolsa de residuos", unidad: "u", rendimiento: 0.5, precioUnit: 3 }],
    manoObra:   [{ id: "mo1", categoria: "Peón", jornadaHs: 8, rendimiento: 80, jornalRef: 950 }],
    equipos:    [],
    gastosGeneralesPct: 0,
    utilidadPct: 10,
    aportesPatronalesPct: APORTES_PATRONALES_PCT_LEGAL_DEFAULT,
  },
  r005: {
    materiales: [
      { id: "m1", descripcion: "Hormigón H-21 elaborado", unidad: "m³", rendimiento: 1.05, precioUnit: 180, dosificacion: "1:2:3", componentes: [
        { id: "c1", descripcion: "Cemento Portland", unidad: "kg",  rendimientoPorUnidad: 350,  precioUnit: 45   },
        { id: "c2", descripcion: "Arena gruesa",     unidad: "m³",  rendimientoPorUnidad: 0.55, precioUnit: 1800 },
        { id: "c3", descripcion: "Pedregullo 20mm",  unidad: "m³",  rendimientoPorUnidad: 0.85, precioUnit: 2200 },
        { id: "c4", descripcion: "Agua",             unidad: "lt",  rendimientoPorUnidad: 180,  precioUnit: 8    },
      ]},
      { id: "m2", descripcion: "Hierro Ø12 mm",           unidad: "kg", rendimiento: 85,   precioUnit: 2.8, dosificacion: "85 kg/m³" },
      { id: "m3", descripcion: "Encofrado de madera",     unidad: "m²", rendimiento: 3.2,  precioUnit: 18, componentes: [
        { id: "e1", descripcion: "Tabla de encofrado 1\"x6\"", unidad: "m²", rendimientoPorUnidad: 1.1,  precioUnit: 320 },
        { id: "e2", descripcion: "Puntal metálico",            unidad: "u",  rendimientoPorUnidad: 0.8,  precioUnit: 180 },
        { id: "e3", descripcion: "Clavos 3\"",                 unidad: "kg", rendimientoPorUnidad: 0.15, precioUnit: 120 },
        { id: "e4", descripcion: "Desmoldante",                unidad: "lt", rendimientoPorUnidad: 0.12, precioUnit: 280 },
      ]},
    ],
    manoObra: [
      { id: "mo1", categoria: "Oficial", jornadaHs: 8, rendimiento: 1.2, jornalRef: 1200 },
      { id: "mo2", categoria: "Peón",    jornadaHs: 8, rendimiento: 1.2, jornalRef: 950  },
    ],
    equipos: [{ id: "e1", descripcion: "Vibrador de inmersión", unidad: "día", rendimiento: 0.8, costoUnit: 45 }],
    gastosGeneralesPct: 0,
    utilidadPct: 10,
    aportesPatronalesPct: APORTES_PATRONALES_PCT_LEGAL_DEFAULT,
  },
};

/* ─── Helpers ─────────────────────────────────────────────── */
function totalRubro(r: Rubro): number {
  if (r.cantidad == null || r.precioUnit == null) return 0;
  return r.cantidad * r.precioUnit;
}

function totalCapitulo(cap: Capitulo): number {
  return cap.rubros.reduce((s, r) => s + totalRubro(r), 0);
}

/** Un capítulo se considera "vacío" si no tiene ningún rubro cargado */
function capituloVacio(cap: Capitulo): boolean {
  return cap.rubros.length === 0;
}

/** Costo total de mano de obra del proyecto — recorre capitulos → rubros →
 * apuData[rubro.id] y acumula sumManoObra(apu.manoObra, apu.equipos) por la
 * cantidad del rubro. Usa valores VIVOS del APU, no precioCongelado (que es
 * un precio unitario ya mezclado materiales+MO+equipos, sin componente de
 * mano de obra aislable) — mismo patrón que computarMaterialesGlobales,
 * para mano de obra en vez de materiales. */
function computarCostoManoObraTotal(capitulos: Capitulo[], apuData: Record<string, APU>): number {
  let total = 0;
  for (const cap of capitulos) {
    for (const rubro of cap.rubros) {
      const apu = apuData[rubro.id];
      if (!apu || rubro.cantidad == null) continue;
      total += sumManoObra(apu.manoObra, apu.equipos) * rubro.cantidad;
    }
  }
  return total;
}

interface DesgloseMOCapitulo {
  capituloId: string;
  nombre: string;
  codigo?: string;
  monto: number;
}

/** Mismo cálculo que computarCostoManoObraTotal, agrupado por capítulo en
 *  vez de sumado en un solo número — para el desglose expandible de
 *  "Monto imponible mano de obra" en Leyes Sociales. Sobre datos ya
 *  cargados en memoria (capitulos + apuData), sin consulta nueva. */
function computarMOTotalPorCapitulo(capitulos: Capitulo[], apuData: Record<string, APU>): DesgloseMOCapitulo[] {
  return capitulos
    .map((cap) => {
      let monto = 0;
      for (const rubro of cap.rubros) {
        const apu = apuData[rubro.id];
        if (!apu || rubro.cantidad == null) continue;
        monto += sumManoObra(apu.manoObra, apu.equipos) * rubro.cantidad;
      }
      return { capituloId: cap.id, nombre: cap.nombre, codigo: cap.codigo, monto };
    })
    .filter((d) => d.monto > 0);
}

// Tope de jornales de Medio Oficial que separa Menor de Mayor cuantía
// (clasificación BPS) — hardcodeado a propósito, mismo criterio que otros
// valores legales de la app: se actualiza a mano el día que cambie la ley.
const TOPE_JORNALES_MENOR_CUANTIA = 85;

interface CuantiaObra {
  jornales: number;
  clasificacion: "Menor cuantía" | "Mayor cuantía";
}

/** Cuantía de la obra (clasificación BPS, informativa, sin validación de
 * topes) — costo total de mano de obra del presupuesto ÷ jornal SUNCA
 * vigente de "Medio Oficial" (Cat. V, el mismo jornal de referencia de toda
 * la app — NO un jornal BPS aparte). Devuelve null si todavía no hay jornal
 * de Medio Oficial cargado (nada para dividir). Nunca se persiste — se
 * recalcula siempre a partir del presupuesto vigente, así que cambia si se
 * edita un rubro. */
function computarCuantiaObra(
  capitulos: Capitulo[],
  apuData: Record<string, APU>,
  categoriasLaborales: CategoriaLaboral[]
): CuantiaObra | null {
  const jornalMedioOficial = categoriasLaborales.find((c) => c.categoria === "medio_oficial")?.jornal;
  if (!jornalMedioOficial) return null;
  const costoManoObra = computarCostoManoObraTotal(capitulos, apuData);
  const jornales = costoManoObra / jornalMedioOficial;
  return {
    jornales,
    clasificacion: jornales < TOPE_JORNALES_MENOR_CUANTIA ? "Menor cuantía" : "Mayor cuantía",
  };
}

// Etiquetas de "Forma de realización de la obra" — mismos valores que
// MODALIDADES_EJECUCION en /editar (única fuente donde se elige).
const MODALIDAD_EJECUCION_LABEL: Record<string, string> = {
  POR_CONTRATO: "Por Contrato",
  POR_ADMINISTRACION: "Por Administración",
  PARTE_Y_PARTE: "Parte por Administración y parte por Contrato",
};

// Tarjeta de sección sin diseñar/implementar todavía, dentro de "Gestión de
// Obra" — visualmente apagada (fondo gris, borde punteado, ícono/título sin
// color de marca) y con badge "Próximamente" explícito, para que no genere
// la expectativa de que ya funciona (a diferencia de las tarjetas
// funcionales de al lado, que sí usan los tokens de marca #1A3A5C/#2563EB).
function TarjetaProximamente({
  icono: Icono,
  titulo,
  descripcion,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="mt-6 bg-slate-50 rounded-[16px] border border-dashed border-slate-300 px-5 py-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
        <Icono className="w-5 h-5 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">{titulo}</h2>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 uppercase tracking-wide">
            Próximamente
          </span>
        </div>
        <p className="text-sm text-slate-400">{descripcion}</p>
      </div>
    </div>
  );
}

/** Genera y descarga el Excel del presupuesto completo (capítulos, rubros y totales) */
function descargarExcelPresupuesto(proyecto: ProyectoData, capitulos: Capitulo[], titulos: Titulo[]) {
  const fecha = new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
  const wb = XLSX.utils.book_new();

  const AZUL_OSCURO = "1A3A5C";
  const GRIS_CLARO = "F1F5F9";

  const styTituloCap = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: AZUL_OSCURO } },
    alignment: { vertical: "center" },
  };
  const styEncabezadoCols = {
    font: { bold: true },
    fill: { patternType: "solid", fgColor: { rgb: GRIS_CLARO } },
    alignment: { vertical: "center" },
  };
  const stySubtotal = {
    font: { bold: true },
    fill: { patternType: "solid", fgColor: { rgb: GRIS_CLARO } },
    alignment: { vertical: "center" },
  };
  const styTotalGeneral = {
    font: { bold: true, sz: 13, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: AZUL_OSCURO } },
    alignment: { vertical: "center" },
  };
  const styBold = { font: { bold: true } };
  // Título — un escalón más fuerte que styTituloCap (fuente más grande,
  // fondo más oscuro), mismo criterio que BloqueTitulo en el PDF.
  const styTituloGrupo = {
    font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "0F2942" } },
    alignment: { vertical: "center" },
  };
  const stySubtotalTitulo = {
    font: { bold: true },
    fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
    alignment: { vertical: "center" },
  };

  const datos: (string | number | null)[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const styledCells: { addr: string; s: Record<string, unknown> }[] = [];

  const NUM_COLS = 6; // N° | DESCRIPCIÓN | UNIDAD | CANTIDAD | PRECIO UNIT. | TOTAL
  const COLS = ["A", "B", "C", "D", "E", "F"];

  function pushRow(row: (string | number | null)[]) {
    datos.push(row);
    return datos.length - 1; // índice (0-based) de la fila recién agregada
  }

  function styleRow(rowIdx: number, style: Record<string, unknown>, fromCol = 0, toCol = NUM_COLS - 1) {
    for (let c = fromCol; c <= toCol; c++) {
      styledCells.push({ addr: `${COLS[c]}${rowIdx + 1}`, s: style });
    }
  }

  // Header del proyecto
  let r = pushRow([`PRESUPUESTO — ${proyecto.nombre}`]);
  styleRow(r, styBold);
  merges.push({ s: { r, c: 0 }, e: { r, c: NUM_COLS - 1 } });

  pushRow([`Cliente: ${proyecto.cliente || "—"}`]);
  pushRow([`Dirección: ${proyecto.direccion || "—"}`]);
  pushRow([`Tipo de obra: ${proyecto.tipo || "—"}`]);
  pushRow([`Fecha: ${fecha}`]);
  pushRow([`Moneda: ${proyecto.moneda}`]);
  pushRow([]);

  r = pushRow(["N°", "DESCRIPCIÓN", "UNIDAD", "CANTIDAD", "PRECIO UNIT.", "TOTAL"]);
  styleRow(r, styEncabezadoCols);

  let nroGlobal = 1;
  let totalGeneral = 0;

  const capitulosConRubros = capitulos.filter((cap) =>
    cap.rubros.some((rubro) => rubro.descripcion.trim().length > 0)
  );

  // Emite encabezado + rubros + subtotal de un capítulo — extraído a función
  // para invocarla tanto anidada bajo un título como suelta, sin duplicar la
  // lógica. nroGlobal es compartido por closure y sigue corrido sin importar
  // el agrupamiento (solo se renumeran capítulos/títulos, nunca los rubros).
  function emitirCapitulo(cap: Capitulo): number {
    let rCap = pushRow([cap.nombre]);
    styleRow(rCap, styTituloCap);
    merges.push({ s: { r: rCap, c: 0 }, e: { r: rCap, c: NUM_COLS - 1 } });

    let subtotalCap = 0;
    for (const rubro of cap.rubros.filter((rr) => rr.descripcion.trim() !== "")) {
      const cantidad = rubro.cantidad ?? 0;
      const precioUnit = rubro.precioUnit ?? 0;
      const totalRubro = cantidad * precioUnit;
      subtotalCap += totalRubro;

      pushRow([
        nroGlobal++,
        rubro.descripcion,
        rubro.unidad,
        rubro.cantidad != null ? parseFloat(cantidad.toFixed(2)) : null,
        rubro.precioUnit != null ? parseFloat(precioUnit.toFixed(2)) : null,
        rubro.cantidad != null && rubro.precioUnit != null ? parseFloat(totalRubro.toFixed(2)) : null,
      ]);
    }

    rCap = pushRow(["", "", "", "", `SUBTOTAL ${cap.nombre}`, parseFloat(subtotalCap.toFixed(2))]);
    styleRow(rCap, stySubtotal);

    return subtotalCap;
  }

  // Un título vacío (sin capítulos con rubros reales) no consume numeración
  // ni imprime fila — mismo criterio que BloqueTitulo en el PDF. Todo
  // proyecto tiene siempre ≥1 título (implícito o explícito) — con ≤1 con
  // contenido se exporta plano, sin ningún rastro de título, igual que un
  // proyecto simple de toda la vida; con 2+ se agrupa (mismo criterio que
  // la tabla en pantalla, ver modoMultiTitulo más arriba en el componente).
  const titulosConCapitulos = titulos
    .map((titulo) => ({ titulo, caps: capitulosConRubros.filter((c) => c.tituloId === titulo.id) }))
    .filter((t) => t.caps.length > 0);

  if (titulosConCapitulos.length >= 2) {
    titulosConCapitulos.forEach(({ titulo, caps }, tIdx) => {
      const numero = tIdx + 1;
      r = pushRow([`${numero} · ${titulo.nombre}`]);
      styleRow(r, styTituloGrupo);
      merges.push({ s: { r, c: 0 }, e: { r, c: NUM_COLS - 1 } });

      let subtotalTitulo = 0;
      for (const cap of caps) {
        subtotalTitulo += emitirCapitulo(cap);
      }

      r = pushRow(["", "", "", "", `SUBTOTAL TÍTULO ${numero} — ${titulo.nombre}`, parseFloat(subtotalTitulo.toFixed(2))]);
      styleRow(r, stySubtotalTitulo);

      totalGeneral += subtotalTitulo;
    });
  } else {
    for (const cap of capitulosConRubros) {
      totalGeneral += emitirCapitulo(cap);
    }
  }

  pushRow([]);
  r = pushRow(["", "", "", "", "TOTAL GENERAL", parseFloat(totalGeneral.toFixed(2))]);
  styleRow(r, styTotalGeneral);

  pushRow([]);
  r = pushRow(["Valores sin IVA ni aportes sociales (BPS)"]);
  styledCells.push({ addr: `A${r + 1}`, s: { font: { italic: true, color: { rgb: "64748B" } } } });

  const ws = XLSX.utils.aoa_to_sheet(datos);

  ws["!cols"] = [
    { wch: 6 }, { wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
  ];
  ws["!merges"] = merges;

  // Formato numérico en columnas D, E, F de todas las filas con datos
  for (let i = 0; i < datos.length; i++) {
    [3, 4, 5].forEach((c) => {
      const addr = `${COLS[c]}${i + 1}`;
      const cell = ws[addr];
      if (cell != null && cell.v != null && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = "#,##0.00";
      }
    });
  }

  // Aplicar estilos de celda (bold, colores de fondo) — xlsx-js-style sí persiste fills y fuentes al exportar
  styledCells.forEach(({ addr, s }) => {
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    ws[addr].s = { ...(ws[addr].s ?? {}), ...s };
  });

  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");
  XLSX.writeFile(wb, `Presupuesto-${proyecto.nombre.replace(/\s+/g, "-")}.xlsx`);
}

/** Tipo de cambio de referencia U$S → $UY, igual al usado en /calcular */
const TCU = 42.5;

/**
 * Precio del rubro a partir de un subrubro típico (precio base en $UY, fechaBase).
 * En UYU se usa el precio base directo; en USD se convierte con el TC de referencia.
 * La actualización a precios vigentes la hace el usuario con "Consultar ICCV".
 */
function precioDesdeSubrubro(sub: SubrubroEstandar, moneda: string): number {
  const precio = moneda === "USD" ? sub.precioUY / TCU : sub.precioUY;
  return parseFloat(precio.toFixed(2));
}

/** "DEMOLICIÓN DE LOSA" → "Demolición de losa" */
function toTitleCase(texto: string): string {
  const minusculas = texto.toLocaleLowerCase("es");
  return minusculas.charAt(0).toUpperCase() + minusculas.slice(1);
}

/**
 * Guarda en background un rubro recién creado por el usuario en la biblioteca
 * global de subrubros típicos, para sugerirlo en futuros proyectos. No bloquea
 * el flujo ni reporta errores al usuario — es una mejora silenciosa.
 */
function guardarEnBibliotecaGlobal(descripcion: string, unidad: string, capitulo: string, precioUnit: number, moneda: string) {
  if (!descripcion.trim() || !unidad.trim() || !capitulo.trim() || !precioUnit) return;
  const precioUY = moneda === "USD" ? precioUnit * TCU : precioUnit;
  fetch("/api/subrubros-estandar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ descripcion, unidad, capitulo, precioUY }),
  }).catch((err) => console.error("[guardarEnBibliotecaGlobal]", err));
}

/** fetch con un timeout propio — Render (Postgres) a veces tarda una
 * conexión bastante más de lo normal (ver P1017 "Server has closed the
 * connection", intermitente, no relacionado al tamaño del payload). Un
 * timeout corto solo servía para mostrarle al usuario un falso "no se
 * pudo cargar" cuando el servidor iba a terminar respondiendo bien igual. */
async function fetchConTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Un timeout acá no significa que el servidor no vaya a terminar — se
 * reintenta una vez (silencioso) antes de rendirse, en vez de castigar
 * al usuario con un error cuando el dato ya está bien creado del otro
 * lado (caso real: redirect post-creación desde el wizard, cargar()
 * pisándose con generar-rubros/generar-seguridad-altura recién
 * disparados contra la misma conexión lenta). Errores que NO son de
 * timeout (404, 500 real, etc.) no se reintentan. */
async function fetchConReintentoSiTimeout(url: string, timeoutMs: number): Promise<Response> {
  try {
    return await fetchConTimeout(url, timeoutMs);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return await fetchConTimeout(url, timeoutMs);
    }
    throw err;
  }
}

function fmtMoneda(v: number, moneda: string): string {
  if (v === 0) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

// timeZone: "UTC" — fechaInicio es una fecha "solo día" (YYYY-MM-DD desde
// un <input type="date">), que new Date() parsea como medianoche UTC.
// Formateada en huso local (Uruguay UTC-3) esa fecha calendario se corre
// un día para atrás (mismo bug documentado y resuelto para
// convenioFechaVigente en lib/convenioSunca.ts).
function fmtFecha(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function fmtNum(v: number, decimales = 2): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** Rendimiento: máximo 2 decimales, sin ceros innecesarios */
function fmtRendimiento(v: number): string {
  return parseFloat(v.toFixed(2)).toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Monetario: 2 decimales fijos con separador de miles */
function fmtMon(v: number): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Igual que fmtMoneda pero conservando hasta 2 decimales (para precios de catálogo) */
function fmtMonedaDecimal(v: number, moneda: string): string {
  if (v === 0) return "—";
  return moneda === "USD" ? `U$S ${fmtMon(v)}` : `$ ${fmtMon(v)}`;
}

/** % de incidencia de un monto sobre el total general del proyecto — null si el total es 0 (evita división por cero) */
function pctIncidencia(monto: number, totalGeneral: number): number | null {
  if (totalGeneral <= 0) return null;
  return (monto / totalGeneral) * 100;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Anchos de columna de la tabla del proyecto — ver layoutTablaPresupuesto.ts
// (importados desde ahí, no declarados acá, para que las tarjetas de la
// cascada de abajo, Costo Directo/Gastos Generales/etc., puedan usar los
// mismos valores sin depender circularmente de este archivo).

// Columna Descripción fija a la izquierda al hacer scroll horizontal en
// mobile (diseño acordado — la tabla de rubros no pasa a tarjetas
// apiladas, se mantiene igual que en desktop pero con scroll). Va junto
// con la columna de ícono/número (COL_ICONO) como un solo bloque
// "congelado" — Descripción sola en left:0 dejaría un hueco donde
// estaba el ícono. Necesita background sólido propio (no alcanza con el
// de la fila) porque lo que scrollea por detrás es contenido real
// (Unidad/Cantidad/Precio), no el mismo fondo — sin esto se ve el texto
// de las columnas de atrás asomando debajo del sticky.
const stickyIcono = (bg: string): React.CSSProperties => ({ position: "sticky", left: 0, zIndex: 1, background: bg });
const stickyDescripcion = (bg: string): React.CSSProperties => ({ position: "sticky", left: COL_ICONO, zIndex: 1, background: bg });

function calcAPU(apu: APU): { costoDirecto: number; precioFinal: number } {
  const sumMat = apu.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
  // Costo de MO por unidad de rubro = jornalRef (costo de la jornada completa) / rendimiento
  // (unidades de rubro producidas por jornada). jornadaHs no participa: el jornal ya
  // representa el costo de la jornada completa, sin importar su duración en horas.
  // La mano de obra de armado vinculada a un equipo Alquilado se excluye — ver apu-calc.ts.
  const sumMO  = sumManoObra(apu.manoObra, apu.equipos);
  const sumEq  = sumEquipos(apu.equipos);
  // Aportes Patronales es un componente más de Costo Directo — se aplica
  // solo sobre sumMO, nunca sobre materiales ni equipos (ver apu-calc.ts).
  const costoDirecto = sumMat + sumMO + sumEq + montoAportesPatronales(sumMO, apu.aportesPatronalesPct);
  const precioFinal  = calcularPrecioUnitario(costoDirecto, apu.utilidadPct);
  return { costoDirecto, precioFinal };
}

// Un rubro queda desincronizado cuando su precioUnit guardado no refleja
// más lo que el APU actual calcularía — pasa al editar materiales, mano de
// obra, modo de costeo de equipos, %Piedra, etc. sin volver a apretar
// "Aplicar al rubro". Tolerancia de $1 y 0,5% para no marcar ruido de
// redondeo — mismo criterio usado para relevar el patrón en toda la base.
function precioAPUDesincronizado(precioGuardado: number | null | undefined, precioCalculado: number): boolean {
  if (precioCalculado <= 0) return false;
  const guardado = precioGuardado ?? 0;
  const diff = Math.abs(guardado - precioCalculado);
  const diffPct = guardado > 0 ? (diff / guardado) * 100 : 100;
  return diff > 1 && diffPct > 0.5;
}

/* ─── Buscador de catálogo inline (MTOP materiales / equipos) ──────
   Genérico sobre T para poder apuntar a distintos endpoints
   (/api/precios-mtop, /api/precios-equipos) sin duplicar el patrón. ── */
interface BuscadorCatalogoResultBase {
  id: string;
  descripcion: string;
  unidad: string;
  numeroLista?: number;
}

function BuscadorCatalogo<T extends BuscadorCatalogoResultBase>({
  endpoint,
  campoPrecio,
  mostrarBadgeLista = false,
  placeholder,
  onSeleccionar,
  onManual,
  onCancelar,
}: {
  endpoint: string;
  campoPrecio: keyof T;
  mostrarBadgeLista?: boolean;
  placeholder: string;
  onSeleccionar: (r: T) => void;
  onManual: (textoActual: string) => void;
  onCancelar: () => void;
}) {
  const [q, setQ]             = useState("");
  const [resultados, setResultados] = useState<T[]>([]);
  const [buscando, setBuscando]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const buscar = (texto: string) => {
    setQ(texto);
    clearTimeout(timerRef.current);
    if (texto.length < 2) { setResultados([]); return; }
    setBuscando(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${endpoint}?q=${encodeURIComponent(texto)}`);
        const data: T[] = await res.json();
        setResultados(Array.isArray(data) ? data : []);
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 250);
  };

  return (
    <div className="mx-4 my-2 rounded-lg border border-blue-200 bg-[#F0F7FF] p-3 space-y-2">
      {/* Input de búsqueda */}
      <input
        autoFocus
        type="text"
        value={q}
        onChange={(e) => buscar(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-slate-700 placeholder:text-slate-400"
      />

      {/* Resultados */}
      {q.length >= 2 && (
        <div className="max-h-48 overflow-y-auto rounded-[6px] border border-slate-200 bg-white">
          {buscando && (
            <div className="px-3 py-2 text-xs text-slate-400 italic">Buscando…</div>
          )}
          {!buscando && resultados.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400 italic">Sin resultados para "{q}"</div>
          )}
          {!buscando && resultados.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSeleccionar(r)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 leading-tight flex-1">{r.descripcion}</span>
                <span className="text-[10px] font-bold text-[#2563EB] whitespace-nowrap flex-shrink-0 tabular-nums">
                  $ {fmtMon(r[campoPrecio] as number)}/{r.unidad}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-400">{r.unidad}</span>
                {mostrarBadgeLista && r.numeroLista != null && (
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-wide">
                    Lista {r.numeroLista}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pie */}
      <div className="flex items-center justify-between pt-0.5">
        <button
          type="button"
          onClick={() => onManual(q)}
          className="text-xs font-medium text-slate-500 hover:text-[#2563EB] transition-colors"
        >
          + Agregar manualmente sin buscar
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ─── Subrubros típicos SAU ─────────────────────────────────── */
function PanelSubrubrosEstandar({
  subrubros,
  cargando,
  moneda,
  capituloIdImplantacion,
  onSeleccionar,
  onCerrar,
}: {
  subrubros: SubrubroEstandar[];
  cargando: boolean;
  moneda: string;
  // Fase 2, Etapa 6b — id de "Implantación y Replanteo" en CapituloCatalogo,
  // resuelto una vez por el padre. Sin columnas string ya no hay fallback
  // posible — si no se pudo resolver (no debería pasar), simplemente no
  // se separan los equipos.
  capituloIdImplantacion?: string;
  onSeleccionar: (s: SubrubroEstandar) => void;
  onCerrar: () => void;
}) {
  const esImplantacion = !!capituloIdImplantacion && subrubros.some((s) => s.capituloId === capituloIdImplantacion);
  const normales = esImplantacion ? subrubros.filter((s) => !s.codigo.startsWith("impl-eq-")) : subrubros;
  const equipos = esImplantacion ? subrubros.filter((s) => s.codigo.startsWith("impl-eq-")) : [];

  const renderFila = (s: SubrubroEstandar) => {
    const precio = precioDesdeSubrubro(s, moneda);
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => onSeleccionar(s)}
        title={`Precio base ${s.fechaBase} — actualizar con ICCV`}
        className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 leading-tight flex-1">
            {s.codigo} — {toTitleCase(s.descripcion)}
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap flex-shrink-0">
            {s.tieneApuEstandar && (
              <span
                title="Tiene descompuesto (APU) pre-cargado"
                className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400"
              />
            )}
            <span className="text-sm font-bold text-[#2563EB] tabular-nums">
              {fmtMonedaDecimal(precio, moneda)}/{s.unidad}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {s.subcapituloNombre && (
            <span className="text-[10px] text-slate-400">{s.subcapituloNombre}</span>
          )}
          <span className="text-[9px] font-medium text-slate-300">
            precio base {s.fechaBase} — actualizar con ICCV
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="mx-4 my-2 rounded-lg border border-blue-100 bg-[#F0F7FF] p-2 space-y-1.5">
      <div className="flex items-center justify-end">
        <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-[6px] border border-slate-100 bg-white">
        {cargando && (
          <div className="px-3 py-2 text-xs text-slate-400 italic">Cargando…</div>
        )}
        {!cargando && subrubros.length === 0 && (
          <div className="px-3 py-2 text-xs text-slate-400 italic">No hay subrubros típicos para este capítulo</div>
        )}
        {!cargando && normales.map(renderFila)}
        {!cargando && equipos.length > 0 && (
          <div className="flex items-center gap-2 px-3" style={{ margin: "8px 0" }}>
            <div className="flex-1 h-px" style={{ backgroundColor: "#CBD5E1" }} />
            <span className="text-xs uppercase text-slate-400 whitespace-nowrap">
              Equipos y Maquinaria de Obra
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: "#CBD5E1" }} />
          </div>
        )}
        {!cargando && equipos.map(renderFila)}
      </div>
    </div>
  );
}

/* ─── Selector de categoría laboral SUNCA ─────────────────── */
function SelectorCategoriaMO({
  categorias,
  onSeleccionar,
  onPersonalizada,
  onCancelar,
  destacarAltura = false,
}: {
  categorias: CategoriaLaboral[];
  onSeleccionar: (cat: CategoriaLaboral) => void;
  onPersonalizada: () => void;
  onCancelar: () => void;
  destacarAltura?: boolean;
}) {
  // Categorías con recargo por trabajo en altura (10% sobre Oficial y
  // Medio Oficial) — Peón no tiene variante de altura, nunca se recomienda.
  const categoriasAltura = destacarAltura
    ? categorias.filter((c) => c.categoria === "oficial_altura" || c.categoria === "medio_oficial_altura")
    : [];
  const idsAltura = new Set(categoriasAltura.map((c) => c.id));
  const resto = [...categorias]
    .filter((c) => !idsAltura.has(c.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="mx-4 my-2 rounded-lg border border-blue-200 bg-[#F0F7FF] p-3 space-y-2">
      <select
        autoFocus
        defaultValue=""
        onChange={(e) => {
          const val = e.target.value;
          if (val === "__personalizada__") {
            onPersonalizada();
            return;
          }
          const cat = categorias.find((c) => c.id === val);
          if (cat) onSeleccionar(cat);
        }}
        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-slate-700"
      >
        <option value="" disabled>Seleccionar categoría…</option>
        {categoriasAltura.length > 0 && (
          <>
            {categoriasAltura.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre} — jornal ref: U$S {fmtMon(cat.jornal)} (recomendado)
              </option>
            ))}
            <option value="" disabled>──────────</option>
          </>
        )}
        {resto.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre} — jornal ref: U$S {fmtMon(c.jornal)}
          </option>
        ))}
        <option value="__personalizada__">+ Categoría personalizada</option>
      </select>
      <div className="flex items-center justify-end pt-0.5">
        <button
          type="button"
          onClick={onCancelar}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ─── Componente Drawer APU ───────────────────────────────── */
interface DrawerAPUProps {
  rubro: Rubro;
  apu: APU;
  moneda: string;
  onClose: () => void;
  onApuChange: (apu: APU) => void;
  onAplicar: (precioUnit: number, apu: APU) => void;
  onToggleTrabajoEnAltura: (actual: boolean) => void;
}

function SeccionAPU({
  titulo,
  headerExtra,
  defaultAbierta = true,
  children,
}: {
  titulo: string;
  headerExtra?: React.ReactNode;
  defaultAbierta?: boolean;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(defaultAbierta);
  return (
    <div className="border border-slate-200 rounded-[10px] overflow-hidden">
      <button
        onClick={() => setAbierta((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{titulo}</span>
        <div className="flex items-center gap-2">
          {headerExtra}
          {abierta
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Selector de modo de costeo de un equipo (Alquilado/Propio) ──── */
const OPCIONES_MODO_COSTEO: { valor: ModoCosteoEquipo; label: string }[] = [
  { valor: "ALQUILADO", label: "Alquilado" },
  { valor: "PROPIO_CON_COSTO", label: "Propio" },
  { valor: "PROPIO_SIN_COSTO", label: "Propio $0" },
];

function SelectorModoCosteo({ modo, onChange }: { modo: ModoCosteoEquipo; onChange: (modo: ModoCosteoEquipo) => void }) {
  return (
    <div className="inline-flex border border-slate-200 rounded-[5px] overflow-hidden mt-1">
      {OPCIONES_MODO_COSTEO.map((o, i) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          title={
            o.valor === "ALQUILADO" ? "Precio de alquiler de mercado"
            : o.valor === "PROPIO_CON_COSTO" ? "Equipo propio — cargá tu costo real"
            : "Equipo propio ya amortizado — no suma al Costo Directo"
          }
          className={cn(
            "px-1.5 py-[3px] text-[10px] font-semibold whitespace-nowrap transition-colors",
            i > 0 && "border-l border-slate-200",
            modo === o.valor
              ? o.valor === "ALQUILADO" ? "bg-[#2563EB] text-white"
                : o.valor === "PROPIO_CON_COSTO" ? "bg-amber-500 text-white"
                : "bg-slate-400 text-white"
              : "bg-slate-50 text-slate-500 hover:bg-slate-100"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DrawerAPU({ rubro, apu, moneda, onClose, onApuChange, onAplicar, onToggleTrabajoEnAltura }: DrawerAPUProps) {
  const dragControls = useDragControls();
  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const [mostrarBuscadorEquipo, setMostrarBuscadorEquipo] = useState(false);
  const [mostrarSelectorMO, setMostrarSelectorMO] = useState(false);
  const [nuevoMatId, setNuevoMatId] = useState<string | null>(null);
  const [categoriasLaborales, setCategoriasLaborales] = useState<CategoriaLaboral[]>([]);
  const [convenioFechaVigente, setConvenioFechaVigente] = useState<string | null>(null);
  // Material cuyo precio unitario está en edición inline (click-to-edit)
  const [precioEditId, setPrecioEditId] = useState<string | null>(null);
  // Material cuyo precio se está estimando con IA (loading del botón "Estimar")
  const [estimandoPrecioId, setEstimandoPrecioId] = useState<string | null>(null);
  // Fila de mano de obra cuyo jornal de referencia está siendo editado — mientras tanto se muestra el valor crudo, no formateado
  const [jornalRefEnFoco, setJornalRefEnFoco] = useState<string | null>(null);
  // Fila de equipo cuyo precio unitario está siendo editado — mismo criterio
  const [costoUnitEnFoco, setCostoUnitEnFoco] = useState<string | null>(null);
  // Fila de equipo cuyo costo propio (modo Propio con costo) está siendo editado
  const [costoUnitPropioEnFoco, setCostoUnitPropioEnFoco] = useState<string | null>(null);
  const { costoDirecto, precioFinal } = calcAPU(apu);

  const totalMateriales = apu.materiales.reduce((acc, m) => {
    if (m.componentes && m.componentes.length > 0) {
      const totalComponentes = m.componentes.reduce((accComp, comp) => {
        const costoTotalComp = comp.precioUnit != null && rubro.cantidad != null
          ? comp.rendimientoPorUnidad * comp.precioUnit * m.rendimiento * rubro.cantidad
          : 0;
        return accComp + costoTotalComp;
      }, 0);
      return acc + totalComponentes;
    }
    const costoTotalPadre = rubro.cantidad != null ? m.rendimiento * m.precioUnit * rubro.cantidad : 0;
    return acc + costoTotalPadre;
  }, 0);

  // Suma de la columna "Subtotal p.unit" — costo de materiales por unidad de rubro
  const totalMaterialesPUnit = apu.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);

  // Materiales sin precio de referencia — su costo se computa como $0 y se
  // arrastra silenciosamente al Costo Directo si no se avisa explícitamente.
  const materialesSinPrecio = apu.materiales.filter((m) => m.precioUnit === 0).length;

  const totalManoObra = apu.manoObra.reduce((acc, mo) => {
    if (!manoObraIncluida(mo, apu.equipos)) return acc;
    const hsPorUnidad = mo.rendimiento > 0 ? mo.jornadaHs / mo.rendimiento : 0;
    const sub = hsPorUnidad / mo.jornadaHs * mo.jornalRef * (rubro.cantidad ?? 1);
    return acc + (Number.isFinite(sub) ? sub : 0);
  }, 0);

  // Costo de mano de obra por unidad de rubro (jornalRef / rendimiento, sin cantidad)
  const totalManoObraPUnit = sumManoObra(apu.manoObra, apu.equipos);

  const totalEquipos = sumEquipos(apu.equipos);

  // Auto-save del APU completo a la DB, debounced — se dispara al salir de
  // cualquier campo editable de Materiales, Mano de obra o Equipos.
  const guardarApuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardarApuActual = useCallback((apuAGuardar?: APU) => {
    const payload = apuAGuardar ?? apu;
    if (guardarApuTimer.current) clearTimeout(guardarApuTimer.current);
    guardarApuTimer.current = setTimeout(() => {
      fetch(`/api/rubros/${rubro.id}/apu`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((err) => console.error("[auto-save APU]", err));
    }, 600);
  }, [apu, rubro.id]);

  // Cargar categorías laborales SUNCA y fecha de vigencia del convenio al montar
  useEffect(() => {
    let cancelado = false;
    fetch("/api/categorias-laborales")
      .then((res) => res.json())
      .then((data: CategoriaLaboral[]) => { if (!cancelado) setCategoriasLaborales(Array.isArray(data) ? data : []); })
      .catch((err) => console.error("[categorías laborales]", err));
    fetch("/api/configuracion")
      .then((res) => res.json())
      .then((data: { convenioFechaVigente?: string | null }) => {
        if (!cancelado) setConvenioFechaVigente(data.convenioFechaVigente ?? null);
      })
      .catch((err) => console.error("[configuración — fecha convenio]", err));
    return () => { cancelado = true; };
  }, []);

  const jornalesPosiblementeDesactualizados = convenioPosiblementeDesactualizado(convenioFechaVigente);

  const setMat = (materiales: InsumoAPU[]) => onApuChange({ ...apu, materiales });
  const setMO  = (manoObra: ManoObraAPU[]) => onApuChange({ ...apu, manoObra });
  const setEq  = (equipos: EquipoAPU[])    => onApuChange({ ...apu, equipos });

  const updateMat = (id: string, field: keyof InsumoAPU, val: string) =>
    setMat(apu.materiales.map((m) => m.id !== id ? m : {
      ...m,
      [field]: field === "descripcion" || field === "unidad" || field === "dosificacion" || field === "codigoMTOP"
        ? val
        : (val === "" ? 0 : parseFloat(val)),
      ...(field === "descripcion" ? { codigoMTOP: undefined, precioMTOPOrig: undefined } : {}),
      ...(field === "precioUnit" ? { precioEstimadoIA: undefined } : {}),
    }));

  // Quita un insumo del APU y persiste de inmediato — mismo patrón que
  // agregarDesdeMTOP/agregarManual, sin esperar al onBlur de ningún campo.
  const quitarMat = (id: string) => {
    const nuevosMateriales = apu.materiales.filter((m) => m.id !== id);
    setMat(nuevosMateriales);
    guardarApuActual({ ...apu, materiales: nuevosMateriales });
  };

  // Actualiza PrecioMTOP si existe un registro cuya descripción coincide
  // con la del material editado — mantiene el catálogo alineado con lo
  // que el usuario corrige a mano en el APU.
  const sincronizarPrecioMTOP = (m: InsumoAPU) => {
    if (!m.descripcion.trim() || m.precioUnit <= 0) return;
    fetch("/api/precios-mtop", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion: m.descripcion, precioUnitario: m.precioUnit }),
    }).catch((err) => console.error("[sync precio MTOP]", err));
  };

  // Estima el precio unitario de un material con IA cuando no tiene precio cargado
  const estimarPrecioMaterial = async (m: InsumoAPU) => {
    setEstimandoPrecioId(m.id);
    try {
      const res = await fetch("/api/materiales/estimar-precio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: m.descripcion, unidad: m.unidad }),
      });
      if (!res.ok) throw new Error("Error al estimar precio");
      const { precio } = await res.json();
      setMat(apu.materiales.map((mat) => mat.id !== m.id ? mat : {
        ...mat,
        precioUnit: precio,
        precioEstimadoIA: true,
      }));
      setPrecioEditId(m.id);
    } catch (err) {
      console.error("[estimar precio IA]", err);
    } finally {
      setEstimandoPrecioId(null);
    }
  };

  // Seleccionar desde el buscador MTOP — agrega nueva fila precargada
  const agregarDesdeMTOP = (m: PrecioMTOPResult) => {
    const id = `m${Date.now()}`;
    const nuevosMateriales = [...apu.materiales, {
      id,
      descripcion:    m.descripcion,
      unidad:         m.unidad,
      rendimiento:    0,
      precioUnit:     m.precioUnitario,
      codigoMTOP:     m.codigo,
      precioMTOPOrig: m.precioUnitario,
    }];
    setMat(nuevosMateriales);
    setMostrarBuscador(false);
    setNuevoMatId(id);
    guardarApuActual({ ...apu, materiales: nuevosMateriales });
  };

  // Agregar fila vacía sin MTOP — pre-completa con el texto escrito en el buscador
  const agregarManual = (texto: string) => {
    const id = `m${Date.now()}`;
    const nuevosMateriales = [...apu.materiales, {
      id,
      descripcion: texto.trim(),
      unidad: "",
      rendimiento: 0,
      precioUnit: 0,
    }];
    setMat(nuevosMateriales);
    setMostrarBuscador(false);
    setNuevoMatId(id);
    guardarApuActual({ ...apu, materiales: nuevosMateriales });
  };

  const updateMO = (id: string, field: keyof ManoObraAPU, val: string) =>
    setMO(apu.manoObra.map((mo) => mo.id !== id ? mo : {
      ...mo,
      [field]: field === "categoria" ? val : (val === "" ? 0 : parseFloat(val)),
    }));

  // Quita una línea de mano de obra y persiste de inmediato. Si estaba
  // vinculada a un equipo (armado/desarme), manoObraIncluida ya tolera
  // referencias a equipos ausentes — no hace falta limpiar nada más.
  const quitarMO = (id: string) => {
    const nuevaManoObra = apu.manoObra.filter((mo) => mo.id !== id);
    setMO(nuevaManoObra);
    guardarApuActual({ ...apu, manoObra: nuevaManoObra });
  };

  const updateEq = (id: string, field: keyof EquipoAPU, val: string) =>
    setEq(apu.equipos.map((e) => e.id !== id ? e : {
      ...e,
      [field]: field === "descripcion" || field === "unidad" ? val : (val === "" ? 0 : parseFloat(val)),
    }));

  // Quita un equipo y persiste de inmediato. Cualquier mano de obra
  // vinculada (armado/desarme) queda huérfana pero sigue funcionando —
  // manoObraIncluida trata un equipoRelacionadoId inexistente como "incluida".
  const quitarEq = (id: string) => {
    const nuevosEquipos = apu.equipos.filter((e) => e.id !== id);
    setEq(nuevosEquipos);
    guardarApuActual({ ...apu, equipos: nuevosEquipos });
  };

  const setModoCosteoEq = (id: string, modo: ModoCosteoEquipo) => {
    const nuevosEquipos = apu.equipos.map((e) => e.id !== id ? e : { ...e, modoCosteo: modo });
    setEq(nuevosEquipos);
    guardarApuActual({ ...apu, equipos: nuevosEquipos });
  };

  // Recalcula en vivo Piedra bruta, Cemento, Arena gruesa y Balasto al
  // cambiar el % de piedra de un hormigón ciclópeo — ver apu-calc.ts.
  const setPctPiedra = (nuevoPct: number) => {
    const pctViejo = apu.porcentajePiedra ?? 0.30;
    const nuevosMateriales = recalcularMaterialesPorPiedra(apu.materiales, pctViejo, nuevoPct);
    const nuevoApu = { ...apu, materiales: nuevosMateriales, porcentajePiedra: nuevoPct };
    onApuChange(nuevoApu);
    guardarApuActual(nuevoApu);
  };

  // Agregar fila de MO precargada desde una categoría laboral SUNCA seleccionada
  const agregarMODesdeCategoria = (cat: CategoriaLaboral) => {
    setMO([...apu.manoObra, {
      id:          `mo${Date.now()}`,
      categoria:   cat.nombre,
      jornadaHs:   8,
      rendimiento: 1,
      jornalRef:   cat.jornal,
    }]);
    setMostrarSelectorMO(false);
  };

  // Agregar fila de MO en blanco — categoría personalizada, ingreso libre
  const agregarMOPersonalizada = () => {
    setMO([...apu.manoObra, { id: `mo${Date.now()}`, categoria: "", jornadaHs: 8, rendimiento: 1, jornalRef: 0 }]);
    setMostrarSelectorMO(false);
  };
  // Seleccionar desde el buscador de equipos — agrega nueva fila precargada
  const agregarDesdeEquipo = (r: PrecioEquipoResult) => {
    const nuevosEquipos = [...apu.equipos, {
      id: `e${Date.now()}`,
      descripcion: r.descripcion,
      unidad: r.unidad,
      rendimiento: 0,
      costoUnit: r.precioHora,
      modoCosteo: "ALQUILADO" as ModoCosteoEquipo,
    }];
    setEq(nuevosEquipos);
    setMostrarBuscadorEquipo(false);
    guardarApuActual({ ...apu, equipos: nuevosEquipos });
  };

  // Agregar fila vacía sin catálogo — pre-completa con el texto escrito en el buscador
  const agregarEquipoManual = (texto: string) => {
    const nuevosEquipos = [...apu.equipos, {
      id: `e${Date.now()}`,
      descripcion: texto.trim(),
      unidad: "",
      rendimiento: 0,
      costoUnit: 0,
      modoCosteo: "ALQUILADO" as ModoCosteoEquipo,
    }];
    setEq(nuevosEquipos);
    setMostrarBuscadorEquipo(false);
    guardarApuActual({ ...apu, equipos: nuevosEquipos });
  };

  const inputCls = "w-full bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 text-sm text-slate-700 placeholder:text-slate-300";

  return (
    <motion.div
      key="drawer-apu-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Modal centrado */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="pointer-events-auto w-full flex flex-col bg-white rounded-2xl shadow-2xl"
        style={{ maxWidth: 860, minWidth: "min(740px, calc(100vw - 2rem))", maxHeight: "85vh" }}
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragConstraints={{ left: -400, right: 400, top: -300, bottom: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — drag handle */}
        <div
          className="flex items-start justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0 select-none"
          onPointerDown={(e) => {
            dragControls.start(e);
            document.body.style.cursor = "grabbing";
            const onUp = () => { document.body.style.cursor = ""; window.removeEventListener("pointerup", onUp); };
            window.addEventListener("pointerup", onUp);
          }}
          style={{ cursor: "grab" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#1A3A5C] leading-tight">
                {rubro.descripcion || "Rubro sin nombre"}
              </h2>
              {materialesSinPrecio > 0 && (
                <span
                  title={`Precio incompleto — ${materialesSinPrecio} insumo(s) sin costo de referencia`}
                  className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-wide whitespace-nowrap"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Precio incompleto
                </span>
              )}
              {precioAPUDesincronizado(rubro.precioUnit, precioFinal) && (
                <button
                  type="button"
                  onClick={() => onAplicar(precioFinal, apu)}
                  title={`APU modificado — precio desactualizado (guardado ${fmtMon(rubro.precioUnit ?? 0)}, actual ${fmtMon(precioFinal)}). Click para aplicar y sincronizar.`}
                  className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-wide whitespace-nowrap hover:bg-amber-100 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  APU modificado
                </button>
              )}
            </div>
            <div className="mt-0.5">
              <p className="text-xs text-slate-400">
                Análisis de Precio Unitario
                {rubro.unidad && <span className="ml-1 font-medium text-slate-500">({rubro.unidad})</span>}
              </p>
              {rubro.cantidad != null && (
                <p className="text-sm font-bold text-[#2563EB] mt-0.5">
                  Cantidad total del rubro: {fmtRendimiento(rubro.cantidad)} {rubro.unidad}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Trabajo en altura */}
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!rubro.trabajoEnAltura}
                onChange={() => onToggleTrabajoEnAltura(!!rubro.trabajoEnAltura)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/20"
              />
              Este rubro requiere trabajo en altura
            </label>
            {rubro.trabajoEnAltura && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Trabajo en altura activo — al agregar mano de obra se recomiendan las categorías
                Oficial y Medio oficial trabajo en altura (10% de recargo). Peón no tiene variante de altura.
              </div>
            )}
          </div>

          {/* 1 — MATERIALES */}
          <SeccionAPU titulo="Materiales">
            <div className="pb-2">
              {tieneMaterialPiedra(apu.materiales) && (
                <div className="flex items-center gap-2 flex-wrap px-1 pb-2.5 mb-2 border-b border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">% Piedra</span>
                  <div className="inline-flex border border-slate-200 rounded-[5px] overflow-hidden">
                    {[0.30, 0.50].map((preset, i) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPctPiedra(preset)}
                        className={cn(
                          "px-2 py-[3px] text-[10px] font-semibold whitespace-nowrap transition-colors",
                          i > 0 && "border-l border-slate-200",
                          Math.abs((apu.porcentajePiedra ?? 0.30) - preset) < 0.001
                            ? "bg-[#2563EB] text-white"
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        {Math.round(preset * 100)}%
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={Math.round((apu.porcentajePiedra ?? 0.30) * 100)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isFinite(v)) return;
                        setPctPiedra(Math.min(90, Math.max(0, v)) / 100);
                      }}
                      className="w-12 text-right text-xs bg-white border border-slate-200 rounded-[5px] px-1.5 py-[3px] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[10px] text-slate-400">%</span>
                  </div>
                  <span
                    title="MTOP 2006 (Pliego de condiciones generales para obras de arquitectura) recomienda partes iguales — 50% piedra, 50% hormigón simple — para la dosificación de hormigón ciclópeo"
                    className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-[3px] uppercase tracking-wide whitespace-nowrap bg-blue-50 text-[#2563EB] border border-blue-200"
                  >
                    <Info className="w-2.5 h-2.5" />
                    Nota MTOP
                  </span>
                </div>
              )}
              <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs border-collapse min-w-[480px]">
                <colgroup>
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "60px" }} />
                  <col style={{ width: "56px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "72px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "28px" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#F8FAFC", height: 28 }} className="border-b border-slate-100">
                    <th className="text-left pl-4 font-semibold text-slate-400 uppercase tracking-wider">Insumo</th>
                    <th className="text-center font-semibold text-slate-400 uppercase tracking-wider">Dosif.</th>
                    <th className="text-center font-semibold text-slate-400 uppercase tracking-wider">Unidad</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap" title="Cantidad por unidad de rubro">Cant/U</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">P. unit.</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Subtotal p.unit</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">Costo tot.</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {apu.materiales.length === 0 && (
                    <tr>
                      <td colSpan={8} className="pl-4 py-2 text-slate-400 italic">Sin materiales</td>
                    </tr>
                  )}
                  {apu.materiales.map((m) => {
                    const sub = m.rendimiento * m.precioUnit;
                    const tieneComponentes = m.componentes && m.componentes.length > 0;
                    const costoTotalPadre = !tieneComponentes && rubro.cantidad != null
                      ? m.rendimiento * m.precioUnit * rubro.cantidad
                      : null;
                    return (
                      <React.Fragment key={m.id}>
                        {/* Fila principal del insumo */}
                        <tr className="group/fila border-b border-slate-50" style={{ height: 28 }}>
                          <td className="pl-4 pr-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={m.descripcion}
                                onChange={(e) => updateMat(m.id, "descripcion", e.target.value)}
                                onBlur={() => guardarApuActual()}
                                placeholder="Descripción"
                                className={cn(inputCls, "flex-1 min-w-0")}
                                autoFocus={m.id === nuevoMatId}
                                ref={m.id === nuevoMatId ? (el) => el?.scrollIntoView({ block: "center" }) : undefined}
                                onFocus={() => { if (m.id === nuevoMatId) setNuevoMatId(null); }}
                              />
                              <BadgeVerificacion
                                fuente={{
                                  proveedor: m.proveedor ?? null,
                                  nombreProducto: null,
                                  urlReferencia: null,
                                  fechaUltimaVerificacion: m.fechaUltimaVerificacion ?? null,
                                  requiereVerificacion: false,
                                  motivoVerificacion: m.motivoVerificacion ?? null,
                                }}
                              />
                            </div>
                          </td>
                          <td className="text-center">
                            <input type="text" value={m.dosificacion ?? ""} onChange={(e) => updateMat(m.id, "dosificacion", e.target.value)} onBlur={() => guardarApuActual()} placeholder="—" className={cn(inputCls, "text-center text-slate-500")} />
                          </td>
                          <td className="text-center">
                            <input type="text" value={m.unidad} onChange={(e) => updateMat(m.id, "unidad", e.target.value)} onBlur={() => guardarApuActual()} placeholder="u" className={cn(inputCls, "text-center")} />
                          </td>
                          <td className="text-right pr-2">
                            <input
                              type="number"
                              value={m.rendimiento === 0 ? "" : m.rendimiento}
                              onChange={(e) => updateMat(m.id, "rendimiento", e.target.value)}
                              onBlur={() => guardarApuActual()}
                              placeholder="0"
                              className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                            />
                          </td>
                          <td className="text-right pr-3 py-0.5">
                            {(m.precioUnit === 0 || precioEditId === m.id) ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  autoFocus={precioEditId === m.id}
                                  value={m.precioUnit === 0 ? "" : m.precioUnit}
                                  onChange={(e) => updateMat(m.id, "precioUnit", e.target.value)}
                                  onBlur={() => {
                                    setPrecioEditId(null);
                                    guardarApuActual();
                                    sincronizarPrecioMTOP(m);
                                  }}
                                  placeholder="0.00"
                                  className={cn(
                                    inputCls,
                                    "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                    m.precioEstimadoIA && "text-amber-600 bg-amber-50 rounded px-1"
                                  )}
                                />
                                {m.precioUnit === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => estimarPrecioMaterial(m)}
                                    disabled={estimandoPrecioId === m.id}
                                    title="Estimar precio de referencia — requiere verificación"
                                    className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-[3px] uppercase tracking-wide whitespace-nowrap bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                                  >
                                    {estimandoPrecioId === m.id
                                      ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                      : "Estimar"}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="relative group">
                                <span className="tabular-nums text-slate-700">{fmtMon(m.precioUnit)}</span>
                                <button
                                  type="button"
                                  onClick={() => setPrecioEditId(m.id)}
                                  title="Editar precio"
                                  className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-[#2563EB] transition-opacity"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            {m.codigoMTOP && (
                              <span className={cn(
                                "text-[9px] font-bold px-1 py-0.5 rounded-[3px] uppercase tracking-wide whitespace-nowrap",
                                m.precioUnit === m.precioMTOPOrig
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                  : "bg-orange-50 text-orange-500 border border-orange-200"
                              )}>
                                {m.precioUnit === m.precioMTOPOrig ? `MTOP ${m.codigoMTOP}` : "Modificado"}
                              </span>
                            )}
                          </td>
                          <td className="text-right pr-3 font-semibold tabular-nums text-[#2563EB]">
                            {sub > 0 ? fmtMon(sub) : "—"}
                          </td>
                          <td className="text-right pr-3 font-bold tabular-nums text-[#2563EB]">
                            {costoTotalPadre != null && costoTotalPadre > 0 ? fmtMon(costoTotalPadre) : tieneComponentes ? "" : "—"}
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={() => quitarMat(m.id)}
                              title="Quitar material"
                              className="opacity-0 group-hover/fila:opacity-100 flex items-center justify-center rounded-[4px] text-slate-300 hover:text-red-500 transition-colors mx-auto"
                              style={{ width: 20, height: 20 }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                        {/* Filas secundarias — componentes */}
                        {m.componentes?.map((comp) => {
                          const subComp = comp.precioUnit != null
                            ? comp.rendimientoPorUnidad * comp.precioUnit
                            : null;
                          const costoTotalComp = comp.precioUnit != null && rubro.cantidad != null
                            ? comp.rendimientoPorUnidad * comp.precioUnit * m.rendimiento * rubro.cantidad
                            : null;
                          return (
                            <tr key={comp.id} className="border-b border-slate-50" style={{ height: 24, background: "#F0F7FF" }}>
                              <td className="text-[11px] text-slate-500 pl-6 pr-2 truncate max-w-0" style={{ borderLeft: "2px solid #BFDBFE" }}>
                                ↳ {comp.descripcion}
                              </td>
                              <td />
                              <td className="text-[11px] text-slate-400 text-center">{comp.unidad}</td>
                              <td className="text-right pr-2 tabular-nums text-xs text-slate-400">{fmtRendimiento(comp.rendimientoPorUnidad)}</td>
                              <td className="text-[11px] text-slate-400 text-right pr-3 tabular-nums">{comp.precioUnit != null ? fmtMon(comp.precioUnit) : "—"}</td>
                              <td className="text-[11px] font-semibold tabular-nums text-[#2563EB] text-right pr-3">{subComp != null && subComp > 0 ? fmtMon(subComp) : "—"}</td>
                              <td className="text-[11px] font-bold tabular-nums text-[#2563EB] text-right pr-3">{costoTotalComp != null && costoTotalComp > 0 ? fmtMon(costoTotalComp) : "—"}</td>
                              <td />
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                {apu.materiales.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#F1F5F9", height: 28 }} className="border-t border-slate-200">
                      <td colSpan={5} className="text-right pr-3 font-bold text-slate-600 uppercase tracking-wide">TOTAL MATERIALES</td>
                      <td className="text-right pr-3 font-bold tabular-nums text-[#2563EB]">{fmtMon(totalMaterialesPUnit)}</td>
                      <td className="text-right pr-3 font-bold tabular-nums text-[#2563EB]">{fmtMon(totalMateriales)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              {/* Buscador MTOP inline */}
              {mostrarBuscador && (
                <BuscadorCatalogo<PrecioMTOPResult>
                  endpoint="/api/precios-mtop"
                  campoPrecio="precioUnitario"
                  mostrarBadgeLista
                  placeholder="Buscar material... (ej: cemento, arena, hierro)"
                  onSeleccionar={agregarDesdeMTOP}
                  onManual={agregarManual}
                  onCancelar={() => setMostrarBuscador(false)}
                />
              )}
              {!mostrarBuscador && (
                <div className="pl-4 pt-1.5 pb-1">
                  <button
                    onClick={() => setMostrarBuscador(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Agregar material
                  </button>
                </div>
              )}
            </div>
          </SeccionAPU>

          {/* 2 — MANO DE OBRA */}
          <SeccionAPU
            titulo="Mano de obra"
            headerExtra={
              jornalesPosiblementeDesactualizados && convenioFechaVigente ? (
                <span title={mensajeAvisoConvenio(convenioFechaVigente)}>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                </span>
              ) : undefined
            }
          >

            <div className="pb-2">
              <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs border-collapse min-w-[480px]">
                <colgroup>
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "64px" }} />
                  <col style={{ width: "76px" }} />
                  <col style={{ width: "72px" }} />
                  <col style={{ width: "84px" }} />
                  <col style={{ width: "84px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "28px" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#F8FAFC", height: 28 }} className="border-b border-slate-100">
                    <th className="text-left pl-4 font-semibold text-slate-400 uppercase tracking-wider">Categoría</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider" title="Horas de la jornada laboral">Jornada</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider" title={`Unidades de rubro (${rubro.unidad || "u"}) producidas por jornada`}>Rendim.</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider" title={`Horas necesarias por ${rubro.unidad || "unidad"} de rubro`}>Hs/{rubro.unidad || "u"}</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap" title="Jornal de referencia por jornada de 8hs (UYU)">Jornal ref.</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap" title={`Costo por ${rubro.unidad || "unidad"} de rubro (jornal ref. / rendimiento)`}>Subtotal p.unit</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap" title="Horas totales para el rubro completo">Hs totales</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {apu.manoObra.length === 0 && (
                    <tr><td colSpan={9} className="pl-4 py-2 text-slate-400 italic">Sin mano de obra</td></tr>
                  )}
                  {apu.manoObra.map((mo) => {
                    const hsPorUnidad = mo.rendimiento > 0 ? mo.jornadaHs / mo.rendimiento : 0;
                    const hsTotales  = rubro.cantidad != null ? hsPorUnidad * rubro.cantidad : null;
                    const subPUnit   = mo.rendimiento > 0 ? mo.jornalRef / mo.rendimiento : 0;
                    const sub        = subPUnit * (rubro.cantidad ?? 1);
                    const incluida   = manoObraIncluida(mo, apu.equipos);
                    return (
                      <tr key={mo.id} className={cn("group/fila border-b border-slate-50", !incluida && "opacity-40")} style={{ height: 28 }} title={!incluida ? "Incluida en el alquiler del equipo — no suma al Costo Directo" : undefined}>
                        <td className="pl-4 pr-2">
                          <input type="text" value={mo.categoria} onChange={(e) => updateMO(mo.id, "categoria", e.target.value)} onBlur={() => guardarApuActual()} placeholder="Peón / Oficial" className={inputCls} />
                        </td>
                        <td className="text-right pr-2">
                          <input type="number" value={mo.jornadaHs || ""} onChange={(e) => updateMO(mo.id, "jornadaHs", e.target.value)} onBlur={() => guardarApuActual()} placeholder="8" className={cn(inputCls, "text-right")} />
                        </td>
                        <td className="text-right pr-2">
                          <input
                            type="number"
                            value={mo.rendimiento || ""}
                            onChange={(e) => updateMO(mo.id, "rendimiento", e.target.value)}
                            onBlur={() => guardarApuActual()}
                            placeholder="0"
                            className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                          />
                        </td>
                        <td className="text-right pr-2 tabular-nums text-slate-700">
                          {hsPorUnidad > 0 ? fmtMon(hsPorUnidad) : "—"}
                        </td>
                        <td className="text-right pr-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              jornalRefEnFoco === mo.id
                                ? (mo.jornalRef ? String(mo.jornalRef) : "")
                                : (mo.jornalRef ? fmtMon(mo.jornalRef) : "")
                            }
                            onChange={(e) => updateMO(mo.id, "jornalRef", e.target.value)}
                            onFocus={() => setJornalRefEnFoco(mo.id)}
                            onBlur={() => { setJornalRefEnFoco(null); guardarApuActual(); }}
                            placeholder="0"
                            className={cn(inputCls, "text-right")}
                          />
                        </td>
                        <td className={cn("text-right pr-3 font-semibold tabular-nums text-[#2563EB]", !incluida && "line-through")}>
                          {subPUnit > 0 ? fmtMon(subPUnit) : "—"}
                        </td>
                        <td className="text-right pr-2 tabular-nums text-slate-700">
                          {hsTotales != null && hsTotales > 0 ? fmtMon(hsTotales) : "—"}
                        </td>
                        <td className={cn("text-right pr-3 font-bold tabular-nums text-[#2563EB]", !incluida && "line-through")}>
                          {sub > 0 ? fmtMon(sub) : "—"}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => quitarMO(mo.id)}
                            title="Quitar mano de obra"
                            className="opacity-0 group-hover/fila:opacity-100 flex items-center justify-center rounded-[4px] text-slate-300 hover:text-red-500 transition-colors mx-auto"
                            style={{ width: 20, height: 20 }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {apu.manoObra.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#F1F5F9", height: 28 }} className="border-t border-slate-200">
                      <td colSpan={5} className="text-right pr-3 font-bold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                        TOTAL POR {(rubro.unidad || "UNIDAD").toUpperCase()}
                      </td>
                      <td className="text-right pr-3 font-bold tabular-nums text-[#2563EB]">{fmtMon(totalManoObraPUnit)}</td>
                      <td colSpan={3} />
                    </tr>
                    <tr style={{ background: "#F1F5F9", height: 28 }} className="border-t border-slate-200">
                      <td colSpan={7} className="text-right pr-3 font-bold text-slate-600 uppercase tracking-wide">TOTAL MANO DE OBRA</td>
                      <td className="text-right pr-3 font-bold tabular-nums text-[#2563EB]">{fmtMon(totalManoObra)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              {mostrarSelectorMO ? (
                <SelectorCategoriaMO
                  categorias={categoriasLaborales}
                  onSeleccionar={agregarMODesdeCategoria}
                  onPersonalizada={agregarMOPersonalizada}
                  onCancelar={() => setMostrarSelectorMO(false)}
                  destacarAltura={!!rubro.trabajoEnAltura}
                />
              ) : (
                <div className="pl-4 pt-1.5">
                  <button onClick={() => setMostrarSelectorMO(true)} className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                    <Plus className="w-3 h-3" /> Agregar MO
                  </button>
                </div>
              )}
              <p className="pl-4 pt-2 text-[11px] text-slate-400">
                ⚠ Los jornales no incluyen leyes sociales.{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setTimeout(() => {
                      document.getElementById("seccion-leyes-sociales")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 250);
                  }}
                  className="font-medium text-[#2563EB] hover:text-[#1D4ED8] underline transition-colors"
                >
                  Ver sección BPS del proyecto
                </button>
              </p>
            </div>
          </SeccionAPU>

          {/* 3 — EQUIPOS */}
          <SeccionAPU titulo="Equipos">
            <div className="pb-2">
              <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs border-collapse min-w-[480px]">
                <colgroup>
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "64px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "84px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "28px" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#F8FAFC", height: 28 }} className="border-b border-slate-100">
                    <th className="text-left pl-4 font-semibold text-slate-400 uppercase tracking-wider">Equipo</th>
                    <th className="text-center font-semibold text-slate-400 uppercase tracking-wider">Unidad</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider" title="Cantidad por unidad de rubro">Cant/U</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">P. unit.</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {apu.equipos.length === 0 && (
                    <tr><td colSpan={6} className="pl-4 py-2 text-slate-400 italic">Sin equipos</td></tr>
                  )}
                  {apu.equipos.map((eq) => {
                    const modo = eq.modoCosteo ?? "ALQUILADO";
                    const sub = eq.rendimiento * costoUnitEfectivo(eq);
                    const manoObraVinculada = apu.manoObra.filter((mo) => mo.equipoRelacionadoId === eq.id);
                    return (
                      <React.Fragment key={eq.id}>
                      <tr className={cn("group/fila border-b border-slate-50", modo === "PROPIO_SIN_COSTO" && "opacity-50")}>
                        <td className="pl-4 pr-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={eq.descripcion}
                              onChange={(e) => updateEq(eq.id, "descripcion", e.target.value)}
                              onBlur={() => guardarApuActual()}
                              placeholder="Descripción"
                              className={cn(inputCls, "flex-1 min-w-0", modo === "PROPIO_SIN_COSTO" && "italic")}
                            />
                            {/* Equipos no tienen proveedor/fechaUltimaVerificacion —
                                salen de PrecioEquipo, sin el aparato de gobernanza de
                                FEAT-AI-006 (ver investigación). Nunca van a mostrar
                                "Pendiente de verificar", queda igual que antes. */}
                            <BadgeVerificacion
                              fuente={{
                                proveedor: null,
                                nombreProducto: null,
                                urlReferencia: null,
                                fechaUltimaVerificacion: null,
                                requiereVerificacion: false,
                                motivoVerificacion: eq.motivoVerificacion ?? null,
                              }}
                            />
                          </div>
                          <SelectorModoCosteo modo={modo} onChange={(m) => setModoCosteoEq(eq.id, m)} />
                        </td>
                        <td className="text-center">
                          <input
                            type="text"
                            value={eq.unidad}
                            onChange={(e) => updateEq(eq.id, "unidad", e.target.value)}
                            onBlur={() => guardarApuActual()}
                            placeholder="día"
                            className={cn(inputCls, "text-center")}
                          />
                        </td>
                        <td className="text-right pr-2">
                          <input
                            type="number"
                            value={eq.rendimiento || ""}
                            onChange={(e) => updateEq(eq.id, "rendimiento", e.target.value)}
                            onBlur={() => guardarApuActual()}
                            placeholder="0"
                            className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                          />
                        </td>
                        <td className="text-right pr-3">
                          {modo === "ALQUILADO" && (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                costoUnitEnFoco === eq.id
                                  ? (eq.costoUnit ? String(eq.costoUnit) : "")
                                  : (eq.costoUnit ? fmtMon(eq.costoUnit) : "")
                              }
                              onChange={(e) => updateEq(eq.id, "costoUnit", e.target.value)}
                              onFocus={() => setCostoUnitEnFoco(eq.id)}
                              onBlur={() => { setCostoUnitEnFoco(null); guardarApuActual(); }}
                              placeholder="0.00"
                              className={cn(inputCls, "text-right")}
                            />
                          )}
                          {modo === "PROPIO_CON_COSTO" && (
                            <div className="flex flex-col items-end gap-0.5">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  costoUnitPropioEnFoco === eq.id
                                    ? (eq.costoUnitPropio ? String(eq.costoUnitPropio) : "")
                                    : (eq.costoUnitPropio ? fmtMon(eq.costoUnitPropio) : "")
                                }
                                onChange={(e) => updateEq(eq.id, "costoUnitPropio", e.target.value)}
                                onFocus={() => setCostoUnitPropioEnFoco(eq.id)}
                                onBlur={() => { setCostoUnitPropioEnFoco(null); guardarApuActual(); }}
                                placeholder="0.00"
                                className={cn(inputCls, "text-right bg-amber-50 rounded px-1")}
                              />
                              <span className="text-[9px] font-bold px-1 py-0.5 rounded-[3px] uppercase tracking-wide whitespace-nowrap bg-amber-50 text-amber-600 border border-amber-200">
                                Editado a mano
                              </span>
                            </div>
                          )}
                          {modo === "PROPIO_SIN_COSTO" && (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-slate-400 tabular-nums">0.00</span>
                              <span className="text-[9px] font-bold px-1 py-0.5 rounded-[3px] uppercase tracking-wide whitespace-nowrap bg-slate-100 text-slate-500 border border-slate-200">
                                Sin costo
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="text-right pr-3 font-semibold tabular-nums text-[#2563EB]">
                          {sub > 0 ? fmtMon(sub) : "—"}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => quitarEq(eq.id)}
                            title="Quitar equipo"
                            className="opacity-0 group-hover/fila:opacity-100 flex items-center justify-center rounded-[4px] text-slate-300 hover:text-red-500 transition-colors mx-auto"
                            style={{ width: 20, height: 20 }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {manoObraVinculada.map((mo) => {
                        const incluida = modo !== "ALQUILADO";
                        return (
                          <tr key={`link-${mo.id}`} className="border-b border-slate-50">
                            <td colSpan={6} className="pl-6 pr-3 pb-1.5">
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <span className="text-slate-300">↳</span>
                                <span>Armado — <span className="text-slate-500">{mo.categoria || "mano de obra"}</span></span>
                                <span className={cn(
                                  "text-[9px] font-bold px-1 py-0.5 rounded-[3px] uppercase tracking-wide whitespace-nowrap",
                                  incluida
                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                )}>
                                  {incluida ? "Se suma al costo directo" : "Incluida en el alquiler"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                {apu.equipos.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#F1F5F9", height: 28 }} className="border-t border-slate-200">
                      <td colSpan={4} className="text-right pr-3 font-bold text-slate-600 uppercase tracking-wide">TOTAL EQUIPOS</td>
                      <td className="text-right pr-3 font-bold tabular-nums text-[#2563EB]">{fmtMon(totalEquipos)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              {/* Buscador de equipos inline */}
              {mostrarBuscadorEquipo && (
                <BuscadorCatalogo<PrecioEquipoResult>
                  endpoint="/api/precios-equipos"
                  campoPrecio="precioHora"
                  placeholder="Buscar equipo... (ej: andamio, hormigonera, grúa)"
                  onSeleccionar={agregarDesdeEquipo}
                  onManual={agregarEquipoManual}
                  onCancelar={() => setMostrarBuscadorEquipo(false)}
                />
              )}
              {!mostrarBuscadorEquipo && (
                <div className="pl-4 pt-1.5">
                  <button onClick={() => setMostrarBuscadorEquipo(true)} className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                    <Plus className="w-3 h-3" /> Agregar equipo
                  </button>
                </div>
              )}
            </div>
          </SeccionAPU>
        </div>

        {/* Resumen APU — pie fijo */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-[#F8FAFC] px-5 py-4 space-y-2">
          <SeccionAPU
            titulo="Resumen y Precio Total"
            defaultAbierta={false}
            headerExtra={
              <span className="text-sm font-bold tabular-nums text-[#2563EB] whitespace-nowrap">
                {rubro.cantidad != null ? (
                  fmtMoneda(precioFinal * rubro.cantidad, moneda)
                ) : (
                  <>
                    {fmtMoneda(precioFinal, moneda)}
                    <span className="font-normal text-slate-400">/unidad</span>
                  </>
                )}
              </span>
            }
          >
            <div className="px-4 pt-3 pb-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Costo directo (Mat + MO + Equipos + Aportes Patr.)</span>
                <span className="font-semibold tabular-nums text-slate-700">{fmtMon(costoDirecto)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Utilidad</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={apu.utilidadPct}
                      onChange={(e) => onApuChange({ ...apu, utilidadPct: parseFloat(e.target.value) || 0 })}
                      className="w-10 text-center text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
                <span className="font-semibold tabular-nums text-slate-700">{fmtMon(costoDirecto * apu.utilidadPct / 100)}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Precio unitario</span>
                <span className="text-xl font-bold tabular-nums text-[#2563EB]">{fmtMoneda(precioFinal, moneda)}</span>
              </div>

              {rubro.cantidad != null && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Cantidad total del rubro</span>
                    <span className="font-semibold tabular-nums text-slate-700">
                      {fmtRendimiento(rubro.cantidad)} {rubro.unidad}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Costo total del rubro</span>
                    <span className="text-lg font-bold tabular-nums text-[#2563EB]">
                      {fmtMoneda(precioFinal * rubro.cantidad, moneda)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </SeccionAPU>

          <button
            onClick={() => onAplicar(precioFinal, apu)}
            className="w-full mt-1 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
          >
            Aplicar al rubro
          </button>
        </div>
      </motion.div>
      </div>
    </motion.div>
  );
}

// Modal "Agregar capítulo" — antes un window.prompt() nativo. Mismo
// patrón que ModalCalibrarEscala en Visor.tsx (título + X, un input,
// error inline, Cancelar/Guardar) para el mismo nivel de pulido que el
// resto de los modales chicos de la app.
// Generalizado con textos opcionales para reusarlo también como
// "Agregar título" (mismo modal, mismo comportamiento) — ver
// mostrarModalTitulo más abajo.
function ModalAgregarCapitulo({
  onClose,
  onGuardar,
  titulo = "Agregar capítulo",
  etiquetaCampo = "Nombre del capítulo",
  placeholder = "Ej. Instalación eléctrica",
  mensajeError = "No se pudo agregar el capítulo. Probá de nuevo.",
}: {
  onClose: () => void;
  onGuardar: (nombre: string) => Promise<void>;
  titulo?: string;
  etiquetaCampo?: string;
  placeholder?: string;
  mensajeError?: string;
}) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(nombre.trim());
      onClose();
    } catch {
      setError(mensajeError);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-[16px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-[#1A3A5C]">{titulo}</h2>
          <button onClick={onClose} className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          <label className="block text-sm font-semibold text-[#1A3A5C]">{etiquetaCampo}</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            placeholder={placeholder}
            autoFocus
            className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!nombre.trim() || guardando}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white transition-colors",
              !nombre.trim() || guardando ? "bg-slate-300 cursor-not-allowed" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
            )}
          >
            {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal "+ Agregar capítulo" scopeado a un título — reusa
// SelectorCapitulosEstandar (IA + lista estándar + edición con toggles) en
// vez del modal de texto libre (ModalAgregarCapitulo, que sigue existiendo
// intacto para los capítulos sueltos del proyecto). La selección se
// acumula localmente adentro del modal y recién se persiste (un POST por
// capítulo, secuencial) cuando el usuario aprieta "Agregar".
function ModalSelectorCapitulosTitulo({
  titulo,
  tipoObra,
  descripcionTrabajos,
  nombresExcluidos,
  onClose,
  onAgregar,
}: {
  titulo: Titulo;
  tipoObra: string;
  descripcionTrabajos: string;
  nombresExcluidos: string[];
  onClose: () => void;
  onAgregar: (seleccionados: CapituloSeleccionable[]) => Promise<void>;
}) {
  const [seleccion, setSeleccion] = useState<CapituloSeleccionable[]>([]);
  const [guardando, setGuardando] = useState(false);

  const activos = seleccion.filter((c) => c.activo && c.nombre.trim());

  const confirmar = async () => {
    if (activos.length === 0) return;
    setGuardando(true);
    try {
      await onAgregar(activos);
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-[16px] shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#1A3A5C]">Agregar capítulo</h2>
            <p className="text-xs text-slate-400 mt-0.5">A &quot;{titulo.nombre}&quot;</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          <SelectorCapitulosEstandar
            capitulos={seleccion}
            onConfirmar={setSeleccion}
            tipoObra={tipoObra}
            descripcionTrabajos={descripcionTrabajos}
            nombresExcluidos={nombresExcluidos}
          />
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={activos.length === 0 || guardando}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white transition-colors",
              activos.length === 0 || guardando ? "bg-slate-300 cursor-not-allowed" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
            )}
          >
            {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {guardando ? "Agregando…" : `Agregar ${activos.length} capítulo${activos.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Componente principal ────────────────────────────────── */
export default function ProyectoPage() {
  const params = useParams();
  const router = useRouter();
  const proyectoId = (params?.id as string) ?? "proyecto-demo-1";

  // ─── Estado ────────────────────────────────────────────────
  const [proyecto, setProyecto] = useState<ProyectoData | null>(null);
  const [menuPDFAbierto, setMenuPDFAbierto] = useState(false);
  const [mostrarConfirmEliminar, setMostrarConfirmEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [mostrarConfirmEntregar, setMostrarConfirmEntregar] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [habilitandoEdicion, setHabilitandoEdicion] = useState(false);
  // Modal "Agregar capítulo" — antes era un window.prompt() nativo, ver
  // ModalAgregarCapitulo más abajo (mismo patrón que ModalCalibrarEscala
  // en Visor.tsx: título, un input, Cancelar/Guardar).
  const [mostrarModalCapitulo, setMostrarModalCapitulo] = useState(false);
  // Rubro cuya descripción está siendo editada — mientras tanto se muestra el valor real, no toTitleCase
  const [descripcionEnFoco, setDescripcionEnFoco] = useState<string | null>(null);
  // Rubro cuyo precio unitario está siendo editado — mientras tanto se muestra sin separador de miles
  const [precioUnitEnFoco, setPrecioUnitEnFoco] = useState<string | null>(null);
  // Rubro cuya cantidad está siendo editada — mientras tanto se muestra el valor crudo, no formateado
  const [cantidadEnFoco, setCantidadEnFoco] = useState<string | null>(null);
  // Rubro con precio pactado (precioCongelado) tocado por primera vez en
  // esta sesión de edición — abre el modal "actualizar vigente vs.
  // mantener pactado" antes de dejar tocar cantidad/precioUnit.
  const [modalPrecioCongelado, setModalPrecioCongelado] = useState<{ capId: string; rubroId: string; descripcion: string } | null>(null);
  const [precioVigenteInfo, setPrecioVigenteInfo] = useState<{
    precioUnitAnterior: number; precioUnitVigente: number; diffPct: number;
  } | null>(null);
  const [cargandoPrecioVigente, setCargandoPrecioVigente] = useState(false);
  const [aplicandoPrecioVigente, setAplicandoPrecioVigente] = useState(false);
  // Decisión ya tomada por rubro en esta sesión de edición — "mantener"
  // deja cantidad libre pero precioUnit sigue bloqueado en el valor
  // pactado; "actualizar" deja todo libre desde el precio vigente. Se
  // reinicia solo con un nuevo "Entregar" (recarga la página vía cargar()).
  const [decisionesPrecioRubro, setDecisionesPrecioRubro] = useState<Record<string, "mantener" | "actualizar">>({});
  const [capitulos, setCapitulos] = useState<Capitulo[]>([]);
  // Ref para leer siempre el estado más reciente de capitulos desde callbacks async
  const capitulosRef = useRef<Capitulo[]>([]);
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [titulosExpandidos, setTitulosExpandidos] = useState<Set<string>>(new Set());
  const [mostrarModalTitulo, setMostrarModalTitulo] = useState(false);
  // Título para el que está abierto el selector estándar de "+ Agregar
  // capítulo" (ver SelectorCapitulosEstandar) — null = cerrado.
  const [tituloParaAgregarCapitulos, setTituloParaAgregarCapitulos] = useState<Titulo | null>(null);
  const [apuData, setApuData] = useState<Record<string, APU>>({});
  // Jornal SUNCA vigente de "Medio Oficial" (Cat. V) — para clasificar la
  // Cuantía de la obra (ver computarCuantiaObra). DrawerAPU carga su propia
  // copia de categoriasLaborales por su cuenta (componente separado); esta
  // es la copia de este componente, no compartida.
  const [categoriasLaborales, setCategoriasLaborales] = useState<CategoriaLaboral[]>([]);
  const [drawerRubroId, setDrawerRubroId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [leyesSociales, setLeyesSociales] = useState<LeyesSocialesData | null>(null);
  const [metodoMontoImponible, setMetodoMontoImponible] = useState<"apu" | "estimado" | null>(null);
  const [recalculandoMO, setRecalculandoMO] = useState(false);
  const [guardandoLeyes, setGuardandoLeyes] = useState(false);
  const [apuGenerando, setApuGenerando] = useState<Set<string>>(new Set());
  const [panelSubrubrosCapId, setPanelSubrubrosCapId] = useState<string | null>(null);
  const [subrubrosPorCapitulo, setSubrubrosPorCapitulo] = useState<Record<string, SubrubroEstandar[]>>({});
  const [cargandoSubrubros, setCargandoSubrubros] = useState(false);
  const [tabActiva, setTabActiva] = useState<"presupuesto" | "gestion-obra">("presupuesto");

  // Refs para debounce de auto-save por rubro
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Fase 2, Etapa 3 — cache en memoria del catálogo canónico (nombre →
  // id), para resolver capituloId/subcapituloId sin pegarle a la DB en
  // cada apertura del panel de subrubros típicos. Se carga una sola vez.
  const catalogoCapitulosRef = useRef<Map<string, { id: string; subcapitulos: Map<string, string> }> | null>(null);
  const catalogoCapitulosPromiseRef = useRef<Promise<void> | null>(null);

  // Fase 2, Etapa 5 — cache en memoria de ParticionSubcapitulo (qué
  // subcapítulos de un CapituloCatalogo le corresponden a qué capítulo
  // real de proyecto). Se carga una sola vez, igual que el catálogo.
  const particionesRef = useRef<{ subcapituloId: string; capituloRealDestino: string; capituloCatalogoId: string }[] | null>(null);
  const particionesPromiseRef = useRef<Promise<void> | null>(null);

  // ─── Carga inicial desde la DB ─────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const res = await fetchConReintentoSiTimeout(`/api/proyectos/${proyectoId}`, 20_000);
      if (!res.ok) throw new Error(`Error ${res.status} al cargar el proyecto`);
      const data = await res.json();

      // Mapear proyecto
      setProyecto({
        id:        data.id,
        nombre:    data.nombre,
        cliente:   data.cliente    ?? "",
        tipo:      data.tipo       ?? "",
        descripcion: data.descripcion ?? "",
        tipoContratacion: data.tipoContratacion ?? "PRIVADA",
        estado:    (data.estado as keyof typeof ESTADOS) in ESTADOS
                     ? (data.estado as keyof typeof ESTADOS)
                     : "BORRADOR",
        moneda:    data.moneda     ?? "UYU",
        area:      data.area       ?? 0,
        direccion: data.direccion  ?? "",
        memoriaDescriptiva: data.memoriaDescriptiva ?? null,
        createdAt: data.createdAt ?? null,
        fechaBaseIndice: data.fechaBaseIndice ?? null,
        ultimaActualizacionIndice: data.ultimaActualizacionIndice ?? null,
        generandoRubros: data.generandoRubros ?? false,
        incluyeIVA: data.incluyeIVA ?? false,
        timbresCJP: data.timbresCJP ?? 0,
        gastosGeneralesItems: Array.isArray(data.gastosGeneralesItems) ? data.gastosGeneralesItems : [],
        gastosGeneralesPctDefault: data.gastosGeneralesPctDefault ?? null,
        utilidadPctDefault: data.utilidadPctDefault ?? null,
        modoGastosGenerales: data.modoGastosGenerales === "DETALLADO" ? "DETALLADO" : "PORCENTAJE",
        gastosGeneralesDetallado: Array.isArray(data.gastosGeneralesDetallado) ? data.gastosGeneralesDetallado : null,
        fechaInicio: data.fechaInicio ?? null,
        plazoObra: data.plazoObra ?? null,
        diasLaborales: data.diasLaborales ?? null,
        modalidadEjecucion: data.modalidadEjecucion ?? null,
        garantiaFielCumplimiento: data.garantiaFielCumplimiento ?? null,
        garantiaViciosOcultos: data.garantiaViciosOcultos ?? null,
        garantiaResponsabilidad: data.garantiaResponsabilidad ?? null,
        fechaUltimaEntrega: data.fechaUltimaEntrega ?? null,
      });

      // Mapear capítulos y rubros
      const caps: Capitulo[] = (data.capitulos ?? []).map((cap: {
        id: string; nombre: string; codigo?: string; color?: string;
        fechaInicio?: string | null; fechaFin?: string | null;
        capituloCatalogoId?: string | null;
        tituloId?: string | null;
        rubros: {
          id: string; descripcion: string; unidad: string;
          cantidad: number; precioUnit: number; apu: unknown;
          precioCongelado?: number | null;
          trabajoEnAltura?: boolean;
        }[];
      }) => ({
        id:          cap.id,
        nombre:      cap.nombre,
        codigo:      cap.codigo,
        color:       cap.color,
        fechaInicio: cap.fechaInicio,
        fechaFin:    cap.fechaFin,
        capituloCatalogoId: cap.capituloCatalogoId,
        tituloId:    cap.tituloId ?? null,
        rubros: (cap.rubros ?? []).map((r) => ({
          id:          r.id,
          descripcion: r.descripcion,
          unidad:      r.unidad,
          cantidad:    r.cantidad   || null,
          precioUnit:  r.precioUnit || null,
          precioCongelado: r.precioCongelado ?? null,
          trabajoEnAltura: r.trabajoEnAltura ?? false,
        })),
      }));
      setCapitulos(caps);

      const tits: Titulo[] = (data.titulos ?? []).map((t: { id: string; nombre: string; orden: number; color?: string }) => ({
        id: t.id,
        nombre: t.nombre,
        orden: t.orden,
        color: t.color,
      }));
      setTitulos(tits);
      setTitulosExpandidos(new Set(tits.map((t) => t.id)));

      // Expandir los 3 primeros con rubros — no mientras se están generando,
      // para no mostrar capítulos vacíos como si ya hubieran sido revisados
      if (!data.generandoRubros) {
        const conRubros = caps.filter((c) => c.rubros.length > 0).slice(0, 3).map((c) => c.id);
        setExpandidos(new Set(conRubros));
      }

      // Mapear APUs
      const apus: Record<string, APU> = {};
      for (const cap of (data.capitulos ?? [])) {
        for (const rubro of (cap.rubros ?? [])) {
          if (rubro.apu) {
            apus[rubro.id] = {
              materiales:         rubro.apu.materiales ?? [],
              manoObra:           rubro.apu.manoObra   ?? [],
              equipos:            rubro.apu.equipos    ?? [],
              gastosGeneralesPct: rubro.apu.gastosGeneralesPct ?? 0,
              utilidadPct:        rubro.apu.utilidadPct        ?? 10,
              aportesPatronalesPct: rubro.apu.aportesPatronalesPct ?? APORTES_PATRONALES_PCT_LEGAL_DEFAULT,
              porcentajePiedra:   rubro.apu.porcentajePiedra   ?? 0.30,
            };
          }
        }
      }
      setApuData(apus);
    } catch (err) {
      console.error("[cargar proyecto]", err);
      setErrorCarga(err instanceof Error ? err.message : "Error al cargar el proyecto");
    } finally {
      setCargando(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ─── Categorías laborales SUNCA (para la Cuantía de la obra) ───
  useEffect(() => {
    let cancelado = false;
    fetch("/api/categorias-laborales")
      .then((res) => res.json())
      .then((data: CategoriaLaboral[]) => { if (!cancelado) setCategoriasLaborales(Array.isArray(data) ? data : []); })
      .catch((err) => console.error("[categorías laborales]", err));
    return () => { cancelado = true; };
  }, []);

  // ─── Polling mientras se generan los rubros automáticos ────
  useEffect(() => {
    if (!proyecto?.generandoRubros) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}?light=1`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.generandoRubros) {
          clearInterval(interval);
          cargar();
        }
      } catch (err) {
        console.error("[poll generandoRubros]", err);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [proyecto?.generandoRubros, proyectoId, cargar]);

  // ─── Carga de Leyes Sociales / BPS ─────────────────────────
  useEffect(() => {
    async function cargarLeyesSociales() {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/leyes-sociales`);
        if (!res.ok) throw new Error("No se pudo cargar Leyes Sociales");
        const data = await res.json();
        setLeyesSociales({
          tipoContratante:  data.tipoContratante  ?? "empresa",
          montoImponibleMO: data.montoImponibleMO ?? 0,
          aucPct:           data.aucPct           ?? 0.714,
          focerPatronalPct: data.focerPatronalPct ?? 0.075,
          fscFocapPct:      data.fscFocapPct      ?? 0.010,
          fosvocPct:        data.fosvocPct        ?? 0.005,
          frlPct:           data.frlPct           ?? 0.002,
          fondoGarantiaPct: data.fondoGarantiaPct ?? 0.005,
          snisAdicionalPct: data.snisAdicionalPct ?? 0.005,
          focerPersonalPct: data.focerPersonalPct ?? 0.030,
        });
      } catch (err) {
        console.error("[cargar leyes sociales]", err);
      }
    }
    cargarLeyesSociales();
  }, [proyectoId]);

  const recalcularMontoImponible = useCallback(async () => {
    setRecalculandoMO(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/leyes-sociales`, { method: "POST" });
      if (!res.ok) throw new Error("Error al recalcular");
      const data = await res.json();
      setLeyesSociales((prev) => prev ? { ...prev, montoImponibleMO: data.montoImponibleMO ?? 0 } : prev);
      setMetodoMontoImponible(data.metodo ?? null);
    } catch (err) {
      console.error("[recalcular MO]", err);
    } finally {
      setRecalculandoMO(false);
    }
  }, [proyectoId]);

  const guardarLeyesSociales = useCallback(async () => {
    if (!leyesSociales) return;
    setGuardandoLeyes(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/leyes-sociales`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leyesSociales),
      });
      if (!res.ok) throw new Error("Error al guardar Leyes Sociales");
    } catch (err) {
      console.error("[guardar leyes sociales]", err);
    } finally {
      setGuardandoLeyes(false);
    }
  }, [proyectoId, leyesSociales]);

  // ─── Resumen del presupuesto — Gastos Generales / IVA ──────
  const guardarCampoProyecto = useCallback((campo: string, valor: unknown) => {
    const key = `proyecto:${campo}`;
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(async () => {
      try {
        await fetch(`/api/proyectos/${proyectoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [campo]: valor }),
        });
      } catch (err) {
        console.error(`[auto-save proyecto:${campo}]`, err);
      }
    }, 800);
  }, [proyectoId]);

  const actualizarTimbresCJP = useCallback((v: number) => {
    setProyecto((prev) => prev ? { ...prev, timbresCJP: v } : prev);
    guardarCampoProyecto("timbresCJP", v);
  }, [guardarCampoProyecto]);

  const actualizarGastosGeneralesItems = useCallback((items: GastoGeneralItem[]) => {
    setProyecto((prev) => prev ? { ...prev, gastosGeneralesItems: items } : prev);
    guardarCampoProyecto("gastosGeneralesItems", items);
  }, [guardarCampoProyecto]);

  // ─── Gastos Generales y Utilidades — defaults para rubros nuevos ──
  const actualizarModoGastosGenerales = useCallback((v: ModoGastosGenerales) => {
    setProyecto((prev) => prev ? { ...prev, modoGastosGenerales: v } : prev);
    guardarCampoProyecto("modoGastosGenerales", v);
  }, [guardarCampoProyecto]);

  const actualizarGastosGeneralesPctDefault = useCallback((v: number) => {
    setProyecto((prev) => prev ? { ...prev, gastosGeneralesPctDefault: v } : prev);
    guardarCampoProyecto("gastosGeneralesPctDefault", v);
  }, [guardarCampoProyecto]);

  const actualizarUtilidadPctDefault = useCallback((v: number) => {
    setProyecto((prev) => prev ? { ...prev, utilidadPctDefault: v } : prev);
    guardarCampoProyecto("utilidadPctDefault", v);
  }, [guardarCampoProyecto]);

  const actualizarGastosGeneralesDetallado = useCallback((categorias: CategoriaGastoGeneral[]) => {
    setProyecto((prev) => prev ? { ...prev, gastosGeneralesDetallado: categorias } : prev);
    guardarCampoProyecto("gastosGeneralesDetallado", categorias);
  }, [guardarCampoProyecto]);

  // ─── Garantías ──────────────────────────────────────────────
  const actualizarGarantiaFielCumplimiento = useCallback((v: string) => {
    setProyecto((prev) => prev ? { ...prev, garantiaFielCumplimiento: v } : prev);
    guardarCampoProyecto("garantiaFielCumplimiento", v);
  }, [guardarCampoProyecto]);

  const actualizarGarantiaViciosOcultos = useCallback((v: string) => {
    setProyecto((prev) => prev ? { ...prev, garantiaViciosOcultos: v } : prev);
    guardarCampoProyecto("garantiaViciosOcultos", v);
  }, [guardarCampoProyecto]);

  const actualizarGarantiaResponsabilidad = useCallback((v: string) => {
    setProyecto((prev) => prev ? { ...prev, garantiaResponsabilidad: v } : prev);
    guardarCampoProyecto("garantiaResponsabilidad", v);
  }, [guardarCampoProyecto]);

  const proyectoActivo = proyecto ?? PROYECTO;
  const moneda = proyectoActivo.moneda;
  const estado = ESTADOS[proyectoActivo.estado] ?? ESTADOS.BORRADOR;
  // Presupuesto entregado — solo lectura hasta "Habilitar edición" (ver
  // guards reales en las rutas PATCH/DELETE/POST de rubros y capítulos).
  const soloLectura = proyectoActivo.estado === "FINALIZADO";
  const totalGeneral = capitulos.reduce((s, c) => s + totalCapitulo(c), 0);
  // Costo Directo → Costos Indirectos → Utilidad agregados a nivel
  // proyecto — reemplazan a la vieja tarjeta fija Total/IVA/Total+IVA (ver
  // costoAgregado.ts). Sobre datos ya cargados en memoria, sin consulta
  // nueva — mismo patrón que computarMOTotalPorCapitulo.
  const costoDirectoAgregado = calcularCostoDirectoAgregado(capitulos, apuData);
  const costosIndirectosAgregados = calcularCostosIndirectosAgregados(
    proyecto?.modoGastosGenerales,
    proyecto?.gastosGeneralesDetallado,
    proyecto?.gastosGeneralesPctDefault,
    costoDirectoAgregado.total
  );
  const utilidadAgregada = calcularUtilidadAgregada(capitulos, apuData);
  const cuantiaObra = computarCuantiaObra(capitulos, apuData, categoriasLaborales);
  // Mismo jornal de referencia que usa computarCuantiaObra — se pasa aparte
  // a SeccionLeyesSociales para calcular sus propios jornales a partir de
  // data.montoImponibleMO (el monto imponible mostrado/editable en esa
  // sección), no del costo de mano de obra en vivo de cuantiaObra — ambos
  // pueden diferir (edición manual, o método "estimado" 38%).
  const jornalMedioOficial = categoriasLaborales.find((c) => c.categoria === "medio_oficial")?.jornal;
  const desgloseMOPorCapitulo = computarMOTotalPorCapitulo(capitulos, apuData);
  // Todo proyecto tiene siempre ≥1 Título (implícito o explícito, ver
  // POST /api/proyectos) — un título sin ningún capítulo no cuenta para
  // esta decisión, mismo criterio que ya usan el PDF/Excel/Planilla de
  // Cómputo. Con ≤1 título con contenido, la vista se muestra plana (sin
  // header de título, numeración 01/02) — el caso simple de siempre, sin
  // ningún rastro de que por debajo exista un Titulo. Con 2+, se agrupa
  // por título (N · Nombre, numeración N.M).
  const titulosConContenido = titulos.filter((t) => capitulos.some((c) => c.tituloId === t.id));
  const modoMultiTitulo = titulosConContenido.length >= 2;
  const capitulosConSubtotal = capitulos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    codigo: c.codigo,
    subtotal: totalCapitulo(c),
  }));

  const { filas: filasMateriales, total: totalMateriales } = useMemo(
    () => computarMaterialesGlobales(capitulos, apuData),
    [capitulos, apuData]
  );

  // Rubro activo en el drawer
  const drawerRubro = drawerRubroId
    ? capitulos.flatMap((c) => c.rubros).find((r) => r.id === drawerRubroId) ?? null
    : null;
  const drawerCapId = drawerRubroId
    ? capitulos.find((c) => c.rubros.some((r) => r.id === drawerRubroId))?.id ?? null
    : null;
  // Default para el APU de un rubro SIN APU propio todavía (rubro recién
  // creado a mano) — usa el default del proyecto en vez de 10 fijo (ver
  // Proyecto.utilidadPctDefault). Gastos Generales ya no se prorratea por
  // rubro (pasó a ser un monto agregado a nivel proyecto, ver
  // costoAgregado.ts) — gastosGeneralesPct queda siempre en 0, campo inerte
  // que se conserva en el modelo pero ya no participa de ningún cálculo.
  const utilidadPctDefaultRubroNuevo = proyecto?.utilidadPctDefault ?? 10;
  // Aportes Patronales: se lee en vivo de Leyes Sociales del proyecto (ya
  // cargado en estado) — fallback al default legal si todavía no se
  // calculó Leyes Sociales para este proyecto (registro perezoso).
  const aportesPatronalesPctDefaultRubroNuevo = leyesSociales
    ? sumarAportesPatronalesPct(leyesSociales)
    : APORTES_PATRONALES_PCT_LEGAL_DEFAULT;
  const drawerAPU = drawerRubroId ? (apuData[drawerRubroId] ?? {
    materiales: [], manoObra: [], equipos: [],
    gastosGeneralesPct: 0, utilidadPct: utilidadPctDefaultRubroNuevo,
    aportesPatronalesPct: aportesPatronalesPctDefaultRubroNuevo, porcentajePiedra: 0.30,
  }) : null;

  const toggleCapitulo = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const eliminarProyecto = async () => {
    setEliminando(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar el proyecto");
      router.push("/proyectos");
    } catch (err) {
      console.error("[eliminarProyecto]", err);
      setEliminando(false);
      setMostrarConfirmEliminar(false);
    }
  };

  // "Entregar" — congela precioCongelado = precioUnit en TODOS los rubros
  // (server-side, ver /api/proyectos/[id]/entregar) y pasa a FINALIZADO.
  // Recarga todo desde la DB después, para que cada rubro tenga su
  // precioCongelado recién escrito reflejado en el estado local.
  const entregarProyecto = async () => {
    setEntregando(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/entregar`, { method: "POST" });
      if (!res.ok) throw new Error("No se pudo entregar el proyecto");
      await cargar();
      // Nueva ronda de precios pactados — las decisiones de la ronda
      // anterior ("mantener"/"actualizar") ya no aplican.
      setDecisionesPrecioRubro({});
      setMostrarConfirmEntregar(false);
    } catch (err) {
      console.error("[entregarProyecto]", err);
    } finally {
      setEntregando(false);
    }
  };

  // "Habilitar edición" — vuelve a EN_CURSO sin tocar precioCongelado de
  // ningún rubro (sigue siendo la referencia "pactada" durante la edición).
  const habilitarEdicion = async () => {
    setHabilitandoEdicion(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "EN_CURSO" }),
      });
      if (!res.ok) throw new Error("No se pudo habilitar la edición");
      setProyecto((prev) => (prev ? { ...prev, estado: "EN_CURSO" } : prev));
    } catch (err) {
      console.error("[habilitarEdicion]", err);
    } finally {
      setHabilitandoEdicion(false);
    }
  };

  // Abre el modal de precio pactado — dispara al primer toque de
  // cantidad/precioUnit en un rubro con precioCongelado sin decisión
  // todavía en esta sesión. Trae el precio vigente recalculado para
  // mostrar la comparación antes de que el usuario elija.
  const abrirModalPrecioCongelado = useCallback(async (capId: string, rubro: Rubro) => {
    setModalPrecioCongelado({ capId, rubroId: rubro.id, descripcion: rubro.descripcion || "Rubro sin nombre" });
    setPrecioVigenteInfo(null);
    setCargandoPrecioVigente(true);
    try {
      const res = await fetch(`/api/rubros/${rubro.id}/precio-vigente`);
      if (!res.ok) throw new Error("No se pudo calcular el precio vigente");
      const data = await res.json();
      setPrecioVigenteInfo(data);
    } catch (err) {
      console.error("[abrirModalPrecioCongelado]", err);
    } finally {
      setCargandoPrecioVigente(false);
    }
  }, []);

  // "Mantener precio pactado" — no escribe nada: cantidad queda libre,
  // precioUnit sigue bloqueado en el valor ya pactado (ver render de los
  // inputs, filtra por decisionesPrecioRubro[rubro.id] === "mantener").
  const mantenerPrecioPactado = () => {
    if (!modalPrecioCongelado) return;
    setDecisionesPrecioRubro((prev) => ({ ...prev, [modalPrecioCongelado.rubroId]: "mantener" }));
    setModalPrecioCongelado(null);
  };

  // "Actualizar al precio vigente" — recomputa de verdad en el servidor
  // (lib/recalcularPrecioRubro.ts) y sincroniza precioUnit/precioCongelado
  // local con lo que quedó escrito; de ahí en más cantidad y precioUnit
  // quedan libres para este rubro.
  const actualizarAlPrecioVigente = async () => {
    if (!modalPrecioCongelado) return;
    const { capId, rubroId } = modalPrecioCongelado;
    setAplicandoPrecioVigente(true);
    try {
      const res = await fetch(`/api/rubros/${rubroId}/actualizar-precio-vigente`, { method: "POST" });
      if (!res.ok) throw new Error("No se pudo actualizar el precio vigente");
      const data = await res.json();
      setCapitulos((prev) =>
        prev.map((c) =>
          c.id !== capId ? c : {
            ...c,
            rubros: c.rubros.map((r) =>
              r.id !== rubroId ? r : { ...r, precioUnit: data.precioUnitVigente, precioCongelado: data.precioUnitVigente }
            ),
          }
        )
      );
      setDecisionesPrecioRubro((prev) => ({ ...prev, [rubroId]: "actualizar" }));
      setModalPrecioCongelado(null);
    } catch (err) {
      console.error("[actualizarAlPrecioVigente]", err);
    } finally {
      setAplicandoPrecioVigente(false);
    }
  };

  // Mantener ref sincronizado con el estado más reciente
  capitulosRef.current = capitulos;

  // Ref para llamar a sugerirAPU desde agregarRubro sin problema de orden de hooks
  const sugerirAPURef = useRef<((capId: string, rubroId: string) => void) | null>(null);

  const agregarRubro = useCallback(async (capId: string) => {
    // Optimista: agrego un rubro temporal en UI
    const tempId = `temp-${Date.now()}`;
    setCapitulos((prev) =>
      prev.map((c) =>
        c.id !== capId ? c : {
          ...c,
          rubros: [...c.rubros, {
            id: tempId,
            descripcion: "",
            unidad: "",
            cantidad: null,
            precioUnit: null,
          }],
        }
      )
    );
    setExpandidos((prev) => new Set([...prev, capId]));

    try {
      const res = await fetch(`/api/capitulos/${capId}/rubros`, { method: "POST" });
      if (!res.ok) throw new Error("Error al crear rubro");
      const nuevoRubro = await res.json();

      // Leer datos del rubro desde ref (estado más reciente) ANTES de actualizar el ID
      // No usar setCapitulos updater para esto — el updater corre async (React 18 batching)
      const capActual = capitulosRef.current.find((c) => c.id === capId);
      const rubroActual = capActual?.rubros.find((r) => r.id === tempId);
      const desc = rubroActual?.descripcion?.trim() ?? "";
      const unidad = rubroActual?.unidad?.trim() ?? "";
      const cantidad = rubroActual?.cantidad ?? null;

      // Reemplazar el id temporal por el real de la DB
      setCapitulos((prev) =>
        prev.map((c) =>
          c.id !== capId ? c : {
            ...c,
            rubros: c.rubros.map((r) =>
              r.id === tempId ? { ...r, id: nuevoRubro.id } : r
            ),
          }
        )
      );

      // Persistir campos que el usuario tipió mientras el rubro tenía tempId
      // (actualizarRubro saltea el PATCH para IDs temporales)
      if (desc || unidad || cantidad !== null) {
        fetch(`/api/rubros/${nuevoRubro.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(desc && { descripcion: desc }),
            ...(unidad && { unidad }),
            ...(cantidad !== null && { cantidad }),
          }),
        }).catch((err) => console.error("[agregarRubro sync-patch]", err));
      }

      // Si el usuario ya completó descripción y unidad, disparar APU directamente
      // sin pasar por sugerirAPU (que haría lookup en estado que aún no se renderizó)
      if (desc) {
        const rubroId = nuevoRubro.id;
        setApuGenerando((prev) => new Set(prev).add(rubroId));
        fetch(`/api/rubros/${rubroId}/sugerir-apu`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descripcion: desc,
            unidad,
            capitulo: capActual?.nombre ?? "",
            tipoObra: proyecto?.tipo ?? "",
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return;
            const nuevoAPU: APU = {
              gastosGeneralesPct: 0,
              utilidadPct: 10,
              aportesPatronalesPct: APORTES_PATRONALES_PCT_LEGAL_DEFAULT,
              porcentajePiedra: 0.30,
              materiales: data.materiales.map((m: { descripcion: string; unidad: string; rendimiento: number; precioUnit: number }, i: number) => ({
                id: `ai-mat-${i}`,
                descripcion: m.descripcion,
                unidad: m.unidad,
                rendimiento: m.rendimiento,
                precioUnit: m.precioUnit,
              })),
              manoObra: data.manoObra.map((mo: { categoria: string; rendimiento: number; jornal: number }, i: number) => ({
                id: `ai-mo-${i}`,
                categoria: mo.categoria,
                jornadaHs: 8,
                rendimiento: mo.rendimiento,
                jornalRef: mo.jornal,
              })),
              equipos: [],
            };
            setApuData((prev) => ({ ...prev, [rubroId]: nuevoAPU }));
            const precio = Math.round(data.precioUnitarioEstimado * 100) / 100;
            setCapitulos((prev) =>
              prev.map((c) =>
                c.id !== capId ? c : {
                  ...c,
                  rubros: c.rubros.map((r) =>
                    r.id !== rubroId ? r : { ...r, precioUnit: precio }
                  ),
                }
              )
            );
            guardarEnBibliotecaGlobal(desc, unidad, capActual?.nombre ?? "", precio, moneda);
          })
          .catch((err) => console.error("[agregarRubro sugerirAPU]", err))
          .finally(() => {
            setApuGenerando((prev) => {
              const s = new Set(prev);
              s.delete(rubroId);
              return s;
            });
          });
      }
    } catch (err) {
      console.error("[agregarRubro]", err);
      // Revertir si falla
      setCapitulos((prev) =>
        prev.map((c) =>
          c.id !== capId ? c : {
            ...c,
            rubros: c.rubros.filter((r) => r.id !== tempId),
          }
        )
      );
    }
  }, [moneda]);

  // Fase 2, Etapa 3 — carga (una sola vez) el catálogo canónico completo
  // y lo indexa por nombre para resolución O(1) de capituloId/subcapituloId.
  const cargarCatalogoCapitulos = useCallback(async () => {
    if (catalogoCapitulosRef.current) return;
    if (!catalogoCapitulosPromiseRef.current) {
      catalogoCapitulosPromiseRef.current = fetch("/api/catalogo-capitulos")
        .then((r) => (r.ok ? r.json() : []))
        .then((data: CapituloCatalogoInfo[]) => {
          const mapa = new Map<string, { id: string; subcapitulos: Map<string, string> }>();
          data.forEach((c) => {
            mapa.set(c.nombre, { id: c.id, subcapitulos: new Map(c.subcapitulos.map((s) => [s.nombre, s.id])) });
          });
          catalogoCapitulosRef.current = mapa;
        })
        .catch((err) => {
          console.error("[cargarCatalogoCapitulos]", err);
        });
    }
    await catalogoCapitulosPromiseRef.current;
  }, []);

  // Fase 2, Etapa 5 — carga (una sola vez) todas las filas de
  // ParticionSubcapitulo, para resolver el filtro de partición del
  // capítulo real actual sin pegarle a la DB en cada apertura del panel.
  const cargarParticiones = useCallback(async () => {
    if (particionesRef.current) return;
    if (!particionesPromiseRef.current) {
      particionesPromiseRef.current = fetch("/api/particion-subcapitulo")
        .then((r) => (r.ok ? r.json() : []))
        .then((data: { subcapituloId: string; capituloRealDestino: string; capituloCatalogoId: string }[]) => {
          particionesRef.current = data;
        })
        .catch((err) => {
          console.error("[cargarParticiones]", err);
        });
    }
    await particionesPromiseRef.current;
  }, []);

  const abrirSubrubrosPanel = useCallback(async (cap: Capitulo) => {
    setPanelSubrubrosCapId(cap.id);
    if (subrubrosPorCapitulo[cap.id]) return;

    setCargandoSubrubros(true);
    try {
      // Fase 2, Etapa 6b — único camino: capituloCatalogoId + ParticionSubcapitulo.
      // El fallback por alias de CAPITULOS_SAU (Etapas 3-5) se eliminó junto
      // con las columnas string de SubrubroEstandar. Un capítulo real sin
      // capituloCatalogoId (hoy: Imprevistos, Conexiones de Servicios,
      // Seguridad y Trabajos en Altura, Gastos Generales de Obra) ya
      // devolvía lista vacía con el fallback viejo — esto no cambia su
      // comportamiento visible.
      if (!cap.capituloCatalogoId) {
        setSubrubrosPorCapitulo((prev) => ({ ...prev, [cap.id]: [] }));
        return;
      }

      const [subrubros] = await Promise.all([
        fetch(`/api/subrubros-estandar?capituloId=${cap.capituloCatalogoId}`).then((r) => (r.ok ? r.json() : [])),
        cargarParticiones(),
        // Para poder resolver el id de "Implantación y Replanteo"
        // (esImplantacion en PanelSubrubrosEstandar). Cacheado, solo pega a
        // la red la primera vez que se abre cualquier panel.
        cargarCatalogoCapitulos(),
      ]);
      let lista: SubrubroEstandar[] = subrubros;

      const particiones = particionesRef.current ?? [];
      const particionesDeEsteCatalogo = particiones.filter((p) => p.capituloCatalogoId === cap.capituloCatalogoId);
      const particionesParaEsteCapitulo = particionesDeEsteCatalogo.filter((p) => p.capituloRealDestino === cap.nombre);

      if (particionesParaEsteCapitulo.length > 0) {
        // Recorte angosto (ej. Pisos, Impermeabilizaciones, Muros,
        // Revoques, Herrería, Equipamiento, Obra Exterior/Jardín): solo
        // los subcapítulos particionados para ESTE capítulo real.
        const idsPermitidos = new Set(particionesParaEsteCapitulo.map((p) => p.subcapituloId));
        lista = lista.filter((s) => s.subcapituloId && idsPermitidos.has(s.subcapituloId));
      } else if (particionesDeEsteCatalogo.length > 0) {
        // "Paraguas": el capituloCatalogo tiene particiones, pero ninguna
        // apunta a este capítulo real — es el genérico (ej. Albañilería).
        // Solo se excluye un subcapítulo si su capítulo real de destino
        // EXISTE en este mismo proyecto (ej. Matisse Monet tiene
        // "Mampostería y muros"/"Revoques y enlucidos" separados — ahí sí
        // se excluyen de un eventual "Albañilería" combinado). Si el
        // proyecto no tiene ese capítulo separado (ej. HOGAR, todo junto
        // en "Albañilería"), el subcapítulo no tiene dónde más aparecer y
        // se queda en el paraguas.
        const nombresCapitulosDelProyecto = new Set(capitulos.map((c) => c.nombre));
        const idsExcluidos = new Set(
          particionesDeEsteCatalogo
            .filter((p) => nombresCapitulosDelProyecto.has(p.capituloRealDestino))
            .map((p) => p.subcapituloId)
        );
        lista = lista.filter((s) => !s.subcapituloId || !idsExcluidos.has(s.subcapituloId));
      }
      // Si no hay ninguna partición para este capituloCatalogoId, no se
      // filtra nada — se muestra la biblioteca completa de ese capítulo.

      setSubrubrosPorCapitulo((prev) => ({ ...prev, [cap.id]: lista }));
    } catch (err) {
      console.error("[abrirSubrubrosPanel]", err);
      setSubrubrosPorCapitulo((prev) => ({ ...prev, [cap.id]: [] }));
    } finally {
      setCargandoSubrubros(false);
    }
  }, [subrubrosPorCapitulo, cargarCatalogoCapitulos, cargarParticiones, capitulos]);

  const toggleSubrubrosPanel = useCallback((cap: Capitulo) => {
    if (panelSubrubrosCapId === cap.id) {
      setPanelSubrubrosCapId(null);
      return;
    }
    abrirSubrubrosPanel(cap);
  }, [panelSubrubrosCapId, abrirSubrubrosPanel]);

  // Al expandir un capítulo sin rubros (o con rubros sin descripción), mostrar automáticamente la biblioteca de subrubros típicos
  const toggleCapituloConSubrubros = useCallback((cap: Capitulo) => {
    const yaExpandido = expandidos.has(cap.id);
    toggleCapitulo(cap.id);
    if (!yaExpandido && !proyecto?.generandoRubros && capituloVacio(cap) && cap.capituloCatalogoId) {
      abrirSubrubrosPanel(cap);
    }
  }, [expandidos, abrirSubrubrosPanel, proyecto?.generandoRubros]);

  const agregarRubroDesdeSubrubro = useCallback(async (capId: string, sub: SubrubroEstandar) => {
    setPanelSubrubrosCapId(null);
    const sinPrecio = sub.precioUY === 0;
    const precioUnit = sinPrecio ? null : precioDesdeSubrubro(sub, proyecto?.moneda ?? "UYU");
    const tempId = `temp-${Date.now()}`;
    const capActual = capitulos.find((c) => c.id === capId);
    setCapitulos((prev) =>
      prev.map((c) =>
        c.id !== capId ? c : {
          ...c,
          rubros: [...c.rubros, {
            id: tempId,
            descripcion: sub.descripcion,
            unidad: sub.unidad,
            cantidad: null,
            precioUnit,
          }],
        }
      )
    );
    setExpandidos((prev) => new Set([...prev, capId]));

    try {
      const res = await fetch(`/api/capitulos/${capId}/rubros`, { method: "POST" });
      if (!res.ok) throw new Error("Error al crear rubro");
      const nuevoRubro = await res.json();
      const rubroId = nuevoRubro.id;

      setCapitulos((prev) =>
        prev.map((c) =>
          c.id !== capId ? c : {
            ...c,
            rubros: c.rubros.map((r) =>
              r.id === tempId ? { ...r, id: rubroId } : r
            ),
          }
        )
      );

      await fetch(`/api/rubros/${rubroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: sub.descripcion,
          unidad: sub.unidad,
          ...(precioUnit !== null && { precioUnit }),
        }),
      });

      // Subrubro con APU estándar pre-cargado en la biblioteca — clonarlo al rubro real
      if (sub.tieneApuEstandar) {
        try {
          const resClon = await fetch(`/api/subrubros-estandar/${sub.id}/clonar-apu`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rubroId }),
          });
          if (resClon.ok) {
            const { apu: apuClonado, rubro: rubroActualizado } = await resClon.json();
            const nuevoAPU: APU = {
              gastosGeneralesPct: apuClonado.gastosGeneralesPct,
              utilidadPct: apuClonado.utilidadPct,
              aportesPatronalesPct: apuClonado.aportesPatronalesPct ?? APORTES_PATRONALES_PCT_LEGAL_DEFAULT,
              porcentajePiedra: apuClonado.porcentajePiedra ?? 0.30,
              materiales: apuClonado.materiales.map((m: InsumoAPU) => ({
                id: m.id,
                descripcion: m.descripcion,
                unidad: m.unidad,
                rendimiento: m.rendimiento,
                precioUnit: m.precioUnit,
                dosificacion: m.dosificacion,
                motivoVerificacion: m.motivoVerificacion,
                proveedor: m.proveedor,
                fechaUltimaVerificacion: m.fechaUltimaVerificacion,
              })),
              manoObra: apuClonado.manoObra.map((mo: ManoObraAPU) => ({
                id: mo.id,
                categoria: mo.categoria,
                jornadaHs: mo.jornadaHs,
                rendimiento: mo.rendimiento,
                jornalRef: mo.jornalRef,
              })),
              equipos: apuClonado.equipos.map((eq: EquipoAPU) => ({
                id: eq.id,
                descripcion: eq.descripcion,
                unidad: eq.unidad,
                rendimiento: eq.rendimiento,
                costoUnit: eq.costoUnit,
                motivoVerificacion: eq.motivoVerificacion,
              })),
            };
            setApuData((prev) => ({ ...prev, [rubroId]: nuevoAPU }));
            setCapitulos((prev) =>
              prev.map((c) =>
                c.id !== capId ? c : {
                  ...c,
                  rubros: c.rubros.map((r) =>
                    r.id !== rubroId ? r : { ...r, precioUnit: rubroActualizado.precioUnit }
                  ),
                }
              )
            );
          }
        } catch (err) {
          console.error("[agregarRubroDesdeSubrubro clonarApu]", err);
        }
      }

      // Subrubro sin precio base (precioUY === 0) y sin APU estándar — disparar sugerencia de APU con IA
      if (sinPrecio && !sub.tieneApuEstandar) {
        setApuGenerando((prev) => new Set(prev).add(rubroId));
        fetch(`/api/rubros/${rubroId}/sugerir-apu`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descripcion: sub.descripcion,
            unidad: sub.unidad,
            capitulo: capActual?.nombre ?? "",
            tipoObra: proyecto?.tipo ?? "",
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return;
            const nuevoAPU: APU = {
              gastosGeneralesPct: 0,
              utilidadPct: 10,
              aportesPatronalesPct: APORTES_PATRONALES_PCT_LEGAL_DEFAULT,
              porcentajePiedra: 0.30,
              materiales: data.materiales.map((m: { descripcion: string; unidad: string; rendimiento: number; precioUnit: number }, i: number) => ({
                id: `ai-mat-${i}`,
                descripcion: m.descripcion,
                unidad: m.unidad,
                rendimiento: m.rendimiento,
                precioUnit: m.precioUnit,
              })),
              manoObra: data.manoObra.map((mo: { categoria: string; rendimiento: number; jornal: number }, i: number) => ({
                id: `ai-mo-${i}`,
                categoria: mo.categoria,
                jornadaHs: 8,
                rendimiento: mo.rendimiento,
                jornalRef: mo.jornal,
              })),
              equipos: [],
            };
            setApuData((prev) => ({ ...prev, [rubroId]: nuevoAPU }));
            const precio = Math.round(data.precioUnitarioEstimado * 100) / 100;
            setCapitulos((prev) =>
              prev.map((c) =>
                c.id !== capId ? c : {
                  ...c,
                  rubros: c.rubros.map((r) =>
                    r.id !== rubroId ? r : { ...r, precioUnit: precio }
                  ),
                }
              )
            );
            guardarEnBibliotecaGlobal(sub.descripcion, sub.unidad, capActual?.nombre ?? "", precio, moneda);
          })
          .catch((err) => console.error("[agregarRubroDesdeSubrubro sugerirAPU]", err))
          .finally(() => {
            setApuGenerando((prev) => {
              const s = new Set(prev);
              s.delete(rubroId);
              return s;
            });
          });
      }
    } catch (err) {
      console.error("[agregarRubroDesdeSubrubro]", err);
      setCapitulos((prev) =>
        prev.map((c) =>
          c.id !== capId ? c : {
            ...c,
            rubros: c.rubros.filter((r) => r.id !== tempId),
          }
        )
      );
    }
  }, [proyecto?.moneda, proyecto?.tipo, capitulos, moneda]);

  const actualizarRubro = useCallback((capId: string, rubroId: string, field: keyof Rubro, value: string) => {
    // Actualización optimista en UI
    setCapitulos((prev) =>
      prev.map((c) =>
        c.id !== capId ? c : {
          ...c,
          rubros: c.rubros.map((r) =>
            r.id !== rubroId ? r : {
              ...r,
              [field]: field === "cantidad" || field === "precioUnit"
                ? value === "" ? null : field === "precioUnit" ? Math.round(parseFloat(value) * 100) / 100 : parseFloat(value)
                : value,
            }
          ),
        }
      )
    );

    // Debounce: auto-save a la DB después de 800ms sin cambios
    if (rubroId.startsWith("temp-")) return; // no guardar temporales
    const key = `${rubroId}:${field}`;
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(async () => {
      try {
        const parsedValue = field === "cantidad" || field === "precioUnit"
          ? value === "" ? 0 : field === "precioUnit" ? Math.round(parseFloat(value) * 100) / 100 : parseFloat(value)
          : value;
        await fetch(`/api/rubros/${rubroId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: parsedValue }),
        });
      } catch (err) {
        console.error("[auto-save rubro]", err);
      }
    }, 800);
  }, []);

  // Toggle inmediato, sin debounce — el usuario espera feedback instantáneo
  const toggleTrabajoEnAltura = useCallback((capId: string, rubroId: string, actual: boolean) => {
    const nuevoValor = !actual;
    setCapitulos((prev) =>
      prev.map((c) =>
        c.id !== capId ? c : {
          ...c,
          rubros: c.rubros.map((r) =>
            r.id !== rubroId ? r : { ...r, trabajoEnAltura: nuevoValor }
          ),
        }
      )
    );
    if (rubroId.startsWith("temp-")) return;
    fetch(`/api/rubros/${rubroId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trabajoEnAltura: nuevoValor }),
    }).catch((err) => console.error("[toggle trabajoEnAltura]", err));
  }, []);

  const eliminarRubro = useCallback((capId: string, rubroId: string, descripcion: string) => {
    const tieneDescripcion = descripcion.trim() !== "";
    if (tieneDescripcion) {
      const ok = window.confirm(`¿Eliminar el rubro "${descripcion.trim()}"?`);
      if (!ok) return;
    }

    setCapitulos((prev) =>
      prev.map((c) =>
        c.id !== capId ? c : {
          ...c,
          rubros: c.rubros.filter((r) => r.id !== rubroId),
        }
      )
    );

    if (rubroId.startsWith("temp-")) return; // no persistido aún — nada que borrar en la DB
    fetch(`/api/rubros/${rubroId}`, { method: "DELETE" }).catch((err) =>
      console.error("[eliminarRubro]", err)
    );
  }, []);

  // Edición inline del nombre de capítulo — mismo patrón que actualizarRubro:
  // update optimista + debounce 800ms + PATCH. No persiste si queda vacío.
  const actualizarNombreCapitulo = useCallback((capId: string, nombre: string) => {
    setCapitulos((prev) =>
      prev.map((c) => (c.id !== capId ? c : { ...c, nombre }))
    );

    const key = `capitulo-nombre:${capId}`;
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(async () => {
      const limpio = nombre.trim();
      if (!limpio) return; // no guardar nombre vacío
      try {
        await fetch(`/api/capitulos/${capId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: limpio }),
        });
      } catch (err) {
        console.error("[actualizarNombreCapitulo]", err);
      }
    }, 800);
  }, []);

  // A diferencia de eliminarRubro, acá NO se borra optimistamente antes de
  // preguntarle al servidor: si el capítulo tiene rubros con certificaciones
  // de avance cargadas, el DELETE responde 409 y no se debe tocar el estado
  // local — ver nota de bloqueo estricto en /api/capitulos/[id]/route.ts.
  const eliminarCapitulo = useCallback(async (cap: Capitulo) => {
    const ok = window.confirm(
      cap.rubros.length > 0
        ? `¿Eliminar el capítulo "${cap.nombre}" y sus ${cap.rubros.length} rubro${cap.rubros.length !== 1 ? "s" : ""}?`
        : `¿Eliminar el capítulo "${cap.nombre}"?`
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/capitulos/${cap.id}`, { method: "DELETE" });
      if (res.status === 409) {
        const data = await res.json();
        window.alert(data.mensaje ?? "No se puede eliminar este capítulo.");
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      setCapitulos((prev) => prev.filter((c) => c.id !== cap.id));
    } catch (err) {
      console.error("[eliminarCapitulo]", err);
    }
  }, []);

  const agregarTitulo = useCallback(async (nombre: string) => {
    const res = await fetch(`/api/proyectos/${proyectoId}/titulos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (!res.ok) throw new Error("No se pudo agregar el título");
    const nuevo = await res.json();
    setTitulos((prev) => [...prev, { id: nuevo.id, nombre: nuevo.nombre, orden: nuevo.orden, color: nuevo.color }]);
    setTitulosExpandidos((prev) => new Set(prev).add(nuevo.id));
  }, [proyectoId]);

  // Borrar un título nunca borra capítulos — el servidor los reasigna al
  // título de menor orden que quede en el proyecto, dentro de una
  // transacción (ver DELETE /api/titulos/[id]). Todo proyecto necesita
  // siempre ≥1 título, así que borrar el único que queda se rechaza — no
  // debería poder pasar desde acá (con ≤1 título la vista es plana y no
  // se muestra ningún botón de borrar título), pero se maneja el 400 por
  // las dudas. Se refetchea en vez de adivinar la reasignación en
  // cliente, para no arriesgar un estado local inconsistente.
  const eliminarTitulo = useCallback(async (titulo: Titulo) => {
    const capsDelTitulo = capitulosRef.current.filter((c) => c.tituloId === titulo.id);
    const ok = window.confirm(
      capsDelTitulo.length > 0
        ? `¿Eliminar el título "${titulo.nombre}"? Sus ${capsDelTitulo.length} capítulo${capsDelTitulo.length !== 1 ? "s" : ""} no se borra${capsDelTitulo.length !== 1 ? "n" : ""} — pasa${capsDelTitulo.length !== 1 ? "n" : ""} a otro título del proyecto.`
        : `¿Eliminar el título "${titulo.nombre}"?`
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/titulos/${titulo.id}`, { method: "DELETE" });
      if (res.status === 400) {
        const data = await res.json();
        window.alert(data.mensaje ?? "No se puede eliminar este título.");
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      await cargar();
    } catch (err) {
      console.error("[eliminarTitulo]", err);
    }
  }, [cargar]);

  const asignarCapituloATitulo = useCallback(async (capId: string, tituloId: string) => {
    setCapitulos((prev) => prev.map((c) => (c.id === capId ? { ...c, tituloId } : c)));
    try {
      const res = await fetch(`/api/capitulos/${capId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tituloId }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch (err) {
      console.error("[asignarCapituloATitulo]", err);
    }
  }, []);

  // Crea, uno por uno (secuencial a propósito — el POST calcula `orden`
  // leyendo el último capítulo del proyecto antes de crear el suyo;
  // en paralelo varias llamadas leerían el mismo "último" y pisarían el
  // orden entre sí), los capítulos elegidos en el selector estándar,
  // todos con el tituloId del título donde se abrió el selector.
  const agregarCapitulosATitulo = useCallback(async (tituloId: string, seleccionados: CapituloSeleccionable[]) => {
    for (const sel of seleccionados) {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/capitulos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: sel.nombre, color: sel.color, tituloId }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const nuevo = await res.json();
        setCapitulos((prev) => [
          ...prev,
          {
            id: nuevo.id,
            nombre: nuevo.nombre,
            codigo: nuevo.codigo,
            color: nuevo.color,
            rubros: nuevo.rubros ?? [],
            capituloCatalogoId: nuevo.capituloCatalogoId ?? null,
            tituloId: nuevo.tituloId ?? null,
          },
        ]);
      } catch (err) {
        console.error("[agregarCapitulosATitulo]", err);
      }
    }
  }, []);

  const sugerirAPU = useCallback(async (capId: string, rubroId: string) => {
    if (rubroId.startsWith("temp-")) return;
    const cap = capitulos.find((c) => c.id === capId);
    const rubro = cap?.rubros.find((r) => r.id === rubroId);
    if (!rubro || !rubro.descripcion.trim()) return;
    if (apuData[rubroId]) return; // ya tiene APU — no sobreescribir

    setApuGenerando((prev) => new Set(prev).add(rubroId));
    try {
      const res = await fetch(`/api/rubros/${rubroId}/sugerir-apu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: rubro.descripcion,
          unidad: rubro.unidad,
          capitulo: cap?.nombre ?? "",
          tipoObra: proyecto?.tipo ?? "",
        }),
      });
      if (!res.ok) return;
      const data = await res.json() as {
        materiales: { descripcion: string; unidad: string; rendimiento: number; precioUnit: number }[];
        manoObra: { categoria: string; rendimiento: number; jornal: number }[];
        precioUnitarioEstimado: number;
      };

      // Construir objeto APU compatible con el estado local
      const nuevoAPU: APU = {
        gastosGeneralesPct: 0,
        utilidadPct: 10,
        aportesPatronalesPct: APORTES_PATRONALES_PCT_LEGAL_DEFAULT,
        porcentajePiedra: 0.30,
        materiales: data.materiales.map((m, i) => ({
          id: `ai-mat-${i}`,
          descripcion: m.descripcion,
          unidad: m.unidad,
          rendimiento: m.rendimiento,
          precioUnit: m.precioUnit,
        })),
        manoObra: data.manoObra.map((mo, i) => ({
          id: `ai-mo-${i}`,
          categoria: mo.categoria,
          jornadaHs: 8,
          rendimiento: mo.rendimiento,
          jornalRef: mo.jornal,
        })),
        equipos: [],
      };

      setApuData((prev) => ({ ...prev, [rubroId]: nuevoAPU }));

      // Actualizar precio en UI
      const precio = Math.round(data.precioUnitarioEstimado * 100) / 100;
      setCapitulos((prev) =>
        prev.map((c) =>
          c.id !== capId ? c : {
            ...c,
            rubros: c.rubros.map((r) =>
              r.id !== rubroId ? r : { ...r, precioUnit: precio }
            ),
          }
        )
      );
      guardarEnBibliotecaGlobal(rubro.descripcion, rubro.unidad, cap?.nombre ?? "", precio, moneda);
    } catch (err) {
      console.error("[sugerirAPU]", err);
    } finally {
      setApuGenerando((prev) => { const s = new Set(prev); s.delete(rubroId); return s; });
    }
  }, [capitulos, apuData, proyecto, moneda]);

  // Mantener el ref actualizado para que agregarRubro pueda llamarla sin dep circular
  sugerirAPURef.current = sugerirAPU;

  const aplicarPrecioAPU = useCallback(async (rubroId: string, precio: number, apuActual: APU) => {
    const cap = capitulos.find((c) => c.rubros.some((r) => r.id === rubroId));
    if (!cap) return;

    const precioRedondeado = Math.round(precio * 100) / 100;

    // 1. Guardar APU completo en la DB
    try {
      await fetch(`/api/rubros/${rubroId}/apu`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apuActual),
      });
    } catch (err) {
      console.error("[guardar APU]", err);
    }

    // 2. Actualizar precioUnit en DB y UI
    actualizarRubro(cap.id, rubroId, "precioUnit", String(precioRedondeado));
    setDrawerRubroId(null);
  }, [capitulos, actualizarRubro]);

  // Fila de un capítulo (colapsada + panel expandido de rubros) — extraída
  // del .map() original a una función nombrada (no un componente aparte,
  // para no tener que prop-drillear los ~30 handlers/estados que ya usa
  // por closure) así se puede invocar tanto desde el loop anidado bajo
  // cada Título como desde el loop plano de capítulos sin título.
  // codigoMostrado es el número ya calculado por el caller ("1.2" dentro
  // de un título, "03" si está suelto) — la fila no recalcula nada.
  function renderFilaCapitulo(cap: Capitulo, codigoMostrado: string) {
    const expandido = expandidos.has(cap.id);
    const totalCap = totalCapitulo(cap);

    return (
      <div key={cap.id} className="border-b border-slate-200 last:border-0">

        {/* Fila del capítulo — antes era un solo <button> (no se puede anidar
            el input de nombre ni el botón de borrar dentro de otro botón),
            ahora es un <div> con el toggle de expandir/colapsar en el click
            del fondo de la fila; el input y el botón de borrar cortan la
            propagación para no disparar el toggle al usarlos. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleCapituloConSubrubros(cap)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") toggleCapituloConSubrubros(cap);
          }}
          className="w-full grid items-center px-5 py-3 hover:bg-slate-50 transition-colors text-left group cursor-pointer"
          style={{ gridTemplateColumns: GRID_CAPITULO }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-bold tabular-nums w-6 text-right flex-shrink-0" style={{ color: "#2563EB" }}>
              {codigoMostrado}
            </span>
            {/* min-w-[64px] en vez de min-w-0 — con el <select> de reasignación
                de título al lado (flex-shrink-0), el nombre podía colapsar a
                0px de ancho en pantallas angostas (bug reportado en mobile).
                Con un piso mínimo siempre queda algo visible, truncado con
                "..." si hace falta; la fila entera scrollea horizontal
                (ver overflow-x-auto en el envoltorio de la tabla) en vez de
                aplastar el nombre a nada. */}
            <input
              type="text"
              value={cap.nombre}
              onChange={(e) => actualizarNombreCapitulo(cap.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              disabled={soloLectura}
              className="flex-1 min-w-[64px] text-sm font-semibold text-[#1A3A5C] bg-transparent truncate focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 disabled:text-slate-400 disabled:cursor-default"
            />
            {cap.rubros.length > 0 && (
              <span className="text-[11px] text-slate-400 flex-shrink-0">
                {cap.rubros.length} rubro{cap.rubros.length !== 1 ? "s" : ""}
              </span>
            )}
            {/* Solo con 2+ títulos con contenido — con ≤1 la vista es
                plana y no tiene sentido ofrecer "mover a otro título"
                (no hay otro visible). Todo capítulo tiene siempre un
                título real (ver schema.prisma), así que ya no existe
                "Sin título" como destino. */}
            {!soloLectura && modoMultiTitulo && (
              <select
                value={cap.tituloId ?? ""}
                onChange={(e) => asignarCapituloATitulo(cap.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                title="Mover a otro título"
                className="flex-shrink-0 max-w-[120px] text-[11px] text-slate-400 bg-transparent border border-slate-200 rounded-[4px] px-1 py-0.5 focus:outline-none focus:border-[#2563EB]/40 hover:text-slate-600 hover:border-slate-300 transition-colors"
              >
                {titulos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            )}
          </div>
          <div className="px-2 text-right">
            <span className="text-sm font-bold tabular-nums" style={{ color: totalCap > 0 ? "#2563EB" : "#CBD5E1" }}>
              {totalCap > 0 ? fmtMoneda(totalCap, moneda) : "—"}
            </span>
          </div>
          <div className="px-2 text-right" title="% de incidencia sobre el Total General del proyecto">
            <span className="text-xs font-medium tabular-nums text-slate-400 whitespace-nowrap">
              {fmtPct(pctIncidencia(totalCap, totalGeneral))}
            </span>
          </div>
          <div className="flex items-center justify-center">
            {!soloLectura && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  eliminarCapitulo(cap);
                }}
                title="Eliminar capítulo"
                className="opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-[4px] text-slate-300 hover:text-red-500 transition-colors"
                style={{ width: 20, height: 20 }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors">
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>

        {/* Panel expandido — rubros */}
        <AnimatePresence initial={false}>
          {expandido && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-100 overflow-x-auto">
                <div className="min-w-[800px]">

                {capituloVacio(cap) ? (
                  <>
                    {cap.capituloCatalogoId && !soloLectura && (
                      <PanelSubrubrosEstandar
                        subrubros={subrubrosPorCapitulo[cap.id] ?? []}
                        cargando={cargandoSubrubros}
                        moneda={moneda}
                        capituloIdImplantacion={catalogoCapitulosRef.current?.get("Implantación y Replanteo")?.id}
                        onSeleccionar={(s) => agregarRubroDesdeSubrubro(cap.id, s)}
                        onCerrar={() => setPanelSubrubrosCapId(null)}
                      />
                    )}
                    {!soloLectura && (
                      <div className="flex items-center pl-6" style={{ height: 26, borderTop: "1px solid #F1F5F9" }}>
                        <button
                          onClick={() => agregarRubro(cap.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Agregar rubro personalizado
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                <>
                {/* Header de columnas — usa GRID_RUBRO, comparte Total/% Incid. con GRID_CAPITULO */}
                <div className="grid items-center bg-slate-50 border-b border-slate-200 px-5" style={{ height: 28, gridTemplateColumns: GRID_RUBRO }}>
                  <div style={stickyIcono("#F8FAFC")} />
                  <div className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider" style={stickyDescripcion("#F8FAFC")}>Descripción</div>
                  <div className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Unidad</div>
                  <div className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Cantidad</div>
                  <div className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Precio unit.</div>
                  <div className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Total</div>
                  <div className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">% Incid.</div>
                  <div />
                  <div />
                </div>

                {/* Filas */}
                <div>
                  {cap.rubros.map((rubro, rubroIdx) => {
                    const tieneAPU = !!apuData[rubro.id];
                    const apuPrecio = tieneAPU ? calcAPU(apuData[rubro.id]).precioFinal : 0;
                    const materialesSinPrecioRubro = tieneAPU
                      ? apuData[rubro.id].materiales.filter((m) => m.precioUnit === 0).length
                      : 0;
                    // Mismo criterio que BadgeVerificacion.tsx para "Pendiente de
                    // verificar" — proveedor real (mercado libre, no MTOP oficial)
                    // sin fechaUltimaVerificacion, excluyendo los casos que ya
                    // tienen su propio badge distinto ahí (alerta específica o "a
                    // cotizar"). Duplicado a propósito acá en vez de importar
                    // ETIQUETAS_MOTIVO_ESPECIFICO (no exportado) — mantener en
                    // sync si esa lista cambia.
                    const materialesPendientesVerificar = tieneAPU
                      ? apuData[rubro.id].materiales.filter(
                          (m) =>
                            !!m.proveedor &&
                            !m.fechaUltimaVerificacion &&
                            m.motivoVerificacion !== "sin_precio_referencia" &&
                            !["variacion_alta", "producto_no_encontrado", "fuente_no_disponible", "sin_costo_referencia"].includes(
                              m.motivoVerificacion ?? ""
                            )
                        ).length
                      : 0;
                    const precioDesactualizado = tieneAPU && precioAPUDesincronizado(rubro.precioUnit, apuPrecio);
                    // Rubro con precio pactado (sobrevivió a un "Entregar") sin
                    // decisión todavía en esta sesión — cantidad/precioUnit se
                    // bloquean hasta elegir "actualizar" o "mantener" en el modal.
                    const decisionPrecio = decisionesPrecioRubro[rubro.id];
                    const pendienteDecisionPrecio = !soloLectura && rubro.precioCongelado != null && !decisionPrecio;

                    return (
                      <div
                        key={rubro.id}
                        className={cn(
                          "group grid items-center hover:bg-blue-50/20 transition-colors px-5",
                          rubroIdx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                        )}
                        style={{ height: 28, borderBottom: "1px solid #F1F5F9", gridTemplateColumns: GRID_RUBRO }}
                      >
                        {/* Botón APU + número */}
                        <div
                          className="flex items-center justify-end gap-1 pr-1"
                          style={stickyIcono(rubroIdx % 2 === 1 ? "#F8FAFC" : "#FFFFFF")}
                        >
                          <button
                            onClick={() => setDrawerRubroId(rubro.id)}
                            title="Abrir descompuesto (APU)"
                            className={cn(
                              "flex items-center justify-center rounded-[4px] transition-colors",
                              drawerRubroId === rubro.id
                                ? "text-[#2563EB]"
                                : "text-slate-300 hover:text-[#2563EB]"
                            )}
                            style={{ width: 18, height: 18 }}
                          >
                            <LayoutList className="w-3 h-3" />
                          </button>
                          <span className="text-[11px] text-slate-400 tabular-nums w-5 text-right">
                            {rubroIdx + 1}
                          </span>
                        </div>

                        {/* Descripción + badge APU */}
                        <div
                          className="px-2 min-w-0 flex items-center gap-1.5"
                          style={stickyDescripcion(rubroIdx % 2 === 1 ? "#F8FAFC" : "#FFFFFF")}
                        >
                          <input
                            type="text"
                            value={descripcionEnFoco === rubro.id ? rubro.descripcion : toTitleCase(rubro.descripcion)}
                            onChange={(e) => actualizarRubro(cap.id, rubro.id, "descripcion", e.target.value)}
                            onFocus={() => setDescripcionEnFoco(rubro.id)}
                            onBlur={() => { setDescripcionEnFoco(null); sugerirAPU(cap.id, rubro.id); }}
                            placeholder="Descripción del rubro"
                            disabled={soloLectura}
                            className="flex-1 min-w-0 text-sm text-slate-700 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 placeholder:text-slate-300 disabled:text-slate-400 disabled:cursor-default"
                          />
                          {!soloLectura && rubro.precioCongelado != null && (
                            <span
                              className="flex-shrink-0"
                              title={
                                decisionPrecio === "mantener"
                                  ? "Precio pactado — cantidad libre, precio unitario bloqueado"
                                  : decisionPrecio === "actualizar"
                                  ? "Precio actualizado al vigente en esta edición"
                                  : "Precio pactado de una entrega anterior — tocá cantidad o precio para elegir mantenerlo o actualizarlo al vigente"
                              }
                            >
                              <Lock className={cn("w-3 h-3", pendienteDecisionPrecio ? "text-amber-500" : "text-slate-300")} />
                            </span>
                          )}
                          {apuGenerando.has(rubro.id) && (
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" title="Generando APU…" />
                          )}
                          {materialesPendientesVerificar > 0 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDrawerRubroId(rubro.id); }}
                              title={`${materialesPendientesVerificar} material${materialesPendientesVerificar !== 1 ? "es" : ""} sin verificar precio de mercado — click para revisar en el descompuesto`}
                              className="flex-shrink-0 hover:opacity-70 transition-opacity"
                            >
                              <Clock className="w-3 h-3 text-amber-500" />
                            </button>
                          )}
                          {materialesSinPrecioRubro > 0 && (
                            <span
                              className="flex-shrink-0"
                              title={`Precio incompleto — ${materialesSinPrecioRubro} insumo(s) sin costo de referencia`}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                            </span>
                          )}
                          {precioDesactualizado && !soloLectura && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                aplicarPrecioAPU(rubro.id, apuPrecio, apuData[rubro.id]);
                              }}
                              title={`APU modificado — precio desactualizado (guardado ${fmtMon(rubro.precioUnit ?? 0)}, actual ${fmtMon(apuPrecio)}). Click para aplicar y sincronizar.`}
                              className="flex-shrink-0 hover:opacity-70 transition-opacity"
                            >
                              <RefreshCw className="w-3 h-3 text-amber-500" />
                            </button>
                          )}
                        </div>

                        <div className="px-2">
                          {rubro.unidad === "" || UNIDADES_ESTANDAR.includes(normalizarUnidad(rubro.unidad)) ? (
                            <select
                              value={normalizarUnidad(rubro.unidad)}
                              onChange={(e) => {
                                const val = e.target.value;
                                actualizarRubro(cap.id, rubro.id, "unidad", val === "__otra__" ? "" : val);
                                sugerirAPU(cap.id, rubro.id);
                              }}
                              disabled={soloLectura}
                              className="w-full text-sm text-slate-600 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 text-center disabled:text-slate-400 disabled:cursor-default"
                            >
                              <option value="" disabled>—</option>
                              {UNIDADES_ESTANDAR.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                              <option value="__otra__">Otra…</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={rubro.unidad}
                              onChange={(e) => actualizarRubro(cap.id, rubro.id, "unidad", e.target.value)}
                              onBlur={() => sugerirAPU(cap.id, rubro.id)}
                              placeholder="m²"
                              disabled={soloLectura}
                              className="w-full text-sm text-slate-600 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 text-center placeholder:text-slate-300 disabled:text-slate-400 disabled:cursor-default"
                            />
                          )}
                        </div>
                        <div className="px-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              cantidadEnFoco === rubro.id
                                ? (rubro.cantidad != null ? String(rubro.cantidad) : "")
                                : (rubro.cantidad != null ? fmtRendimiento(rubro.cantidad) : "")
                            }
                            onChange={(e) => actualizarRubro(cap.id, rubro.id, "cantidad", e.target.value)}
                            onFocus={() => setCantidadEnFoco(rubro.id)}
                            onBlur={() => setCantidadEnFoco(null)}
                            onMouseDown={(e) => {
                              if (pendienteDecisionPrecio) {
                                e.preventDefault();
                                abrirModalPrecioCongelado(cap.id, rubro);
                              }
                            }}
                            placeholder="0"
                            disabled={soloLectura}
                            readOnly={pendienteDecisionPrecio}
                            className={cn(
                              "w-full text-sm bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 text-right placeholder:text-slate-300 disabled:text-slate-400 disabled:cursor-default",
                              pendienteDecisionPrecio ? "text-amber-600 cursor-pointer" : "text-slate-600"
                            )}
                          />
                        </div>
                        <div className="px-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              precioUnitEnFoco === rubro.id
                                ? (rubro.precioUnit != null ? String(Math.round(rubro.precioUnit * 100) / 100) : "")
                                : (rubro.precioUnit != null && rubro.precioUnit > 0 ? fmtMon(rubro.precioUnit) : "")
                            }
                            onChange={(e) => actualizarRubro(cap.id, rubro.id, "precioUnit", e.target.value)}
                            onFocus={() => setPrecioUnitEnFoco(rubro.id)}
                            onBlur={() => setPrecioUnitEnFoco(null)}
                            onMouseDown={(e) => {
                              if (pendienteDecisionPrecio) {
                                e.preventDefault();
                                abrirModalPrecioCongelado(cap.id, rubro);
                              }
                            }}
                            placeholder="0.00"
                            disabled={soloLectura || decisionPrecio === "mantener"}
                            readOnly={pendienteDecisionPrecio}
                            title={decisionPrecio === "mantener" ? "Precio pactado — bloqueado. Elegí \"Actualizar al precio vigente\" para poder editarlo." : undefined}
                            className={cn(
                              "w-full text-sm bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 text-right placeholder:text-slate-300 disabled:text-slate-400 disabled:cursor-default [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                              pendienteDecisionPrecio ? "text-amber-600 cursor-pointer" : "text-slate-600"
                            )}
                          />
                        </div>
                        <div className="px-2 text-right">
                          <span className={cn("text-sm font-semibold tabular-nums", totalRubro(rubro) > 0 ? "text-[#2563EB]" : "text-slate-300")}>
                            {totalRubro(rubro) > 0 ? fmtMoneda(totalRubro(rubro), moneda) : "—"}
                          </span>
                        </div>
                        <div className="px-2 text-right" title="% de incidencia sobre el Total General del proyecto">
                          <span className="text-xs font-medium tabular-nums text-slate-400 whitespace-nowrap">
                            {fmtPct(pctIncidencia(totalRubro(rubro), totalGeneral))}
                          </span>
                        </div>
                        <div className="flex items-center justify-center">
                          {!soloLectura && (
                            <button
                              onClick={() => eliminarRubro(cap.id, rubro.id, rubro.descripcion)}
                              title="Eliminar rubro"
                              className="opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-[4px] text-slate-300 hover:text-red-500 transition-colors"
                              style={{ width: 20, height: 20 }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div />
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal — mismo GRID_RUBRO; la etiqueta ocupa las columnas de icono+descripción+unidad+cantidad+precio */}
                <div className="grid items-center bg-slate-50 border-t border-slate-200 px-5" style={{ height: 26, gridTemplateColumns: GRID_RUBRO }}>
                  <div
                    className="pl-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"
                    style={{ gridColumn: "span 5", ...stickyIcono("#F8FAFC") }}
                  >
                    Subtotal {cap.nombre}
                  </div>
                  <div className="px-2 text-sm font-bold tabular-nums text-right text-[#2563EB]">
                    {fmtMoneda(totalCap, moneda)}
                  </div>
                  <div className="px-2 text-xs font-bold tabular-nums text-right text-[#2563EB] whitespace-nowrap">
                    {fmtPct(pctIncidencia(totalCap, totalGeneral))}
                  </div>
                  <div />
                  <div />
                </div>

                {/* Botón agregar rubro */}
                {!soloLectura && (
                  <div className="flex items-center gap-4 pl-6" style={{ height: 26, borderTop: "1px solid #F1F5F9" }}>
                    {cap.capituloCatalogoId && (
                      <button
                        onClick={() => toggleSubrubrosPanel(cap)}
                        title="Ver subrubros típicos de este capítulo"
                        className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Subrubros
                      </button>
                    )}
                    <button
                      onClick={() => agregarRubro(cap.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Agregar rubro
                    </button>
                  </div>
                )}

                {!soloLectura && panelSubrubrosCapId === cap.id && (
                  <PanelSubrubrosEstandar
                    subrubros={subrubrosPorCapitulo[cap.id] ?? []}
                    cargando={cargandoSubrubros}
                    moneda={moneda}
                    capituloIdImplantacion={catalogoCapitulosRef.current?.get("Implantación y Replanteo")?.id}
                    onSeleccionar={(s) => agregarRubroDesdeSubrubro(cap.id, s)}
                    onCerrar={() => setPanelSubrubrosCapId(null)}
                  />
                )}
                </>
                )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ background: "#F0F4F8" }}>
        <div className="text-sm text-slate-400">Cargando proyecto…</div>
      </div>
    );
  }

  if (errorCarga || !proyecto) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ background: "#F0F4F8" }}>
        <div className="text-center space-y-3">
          <p className="text-sm text-red-500 font-medium">No se pudo cargar el proyecto</p>
          <p className="text-xs text-slate-400">{errorCarga ?? "Proyecto no encontrado"}</p>
          <a href="/proyectos" className="inline-block text-xs text-blue-600 hover:underline">
            ← Volver a Mis proyectos
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col" style={{ background: "#F0F4F8" }}>

      {/* ── Header del proyecto ─────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <h1 className="text-lg md:text-xl font-bold text-[#1A3A5C] break-words">
                  <span className="font-medium text-slate-400">Proyecto: </span>
                  {proyectoActivo.nombre}
                </h1>
                <span
                  className="text-[11px] md:text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: estado.bg, color: estado.color }}
                >
                  {estado.label}
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 break-words">
                {proyectoActivo.cliente}
                {!!proyectoActivo.area && ` · ${proyectoActivo.area} m²`}
                {proyectoActivo.direccion && ` · ${proyectoActivo.direccion}`}
              </p>
              {soloLectura && proyectoActivo.fechaUltimaEntrega && (
                <p className="text-[11px] md:text-xs text-amber-600 mt-0.5">
                  Entregado el{" "}
                  {new Date(proyectoActivo.fechaUltimaEntrega).toLocaleDateString("es-UY", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  })}{" "}
                  — precios congelados
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {soloLectura ? (
                <button
                  onClick={habilitarEdicion}
                  disabled={habilitandoEdicion}
                  className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <LockOpen className="w-3.5 h-3.5" /> <span className="hidden md:inline">{habilitandoEdicion ? "Habilitando…" : "Habilitar edición"}</span>
                </button>
              ) : (
                <button
                  onClick={() => setMostrarConfirmEntregar(true)}
                  disabled={capitulos.every((c) => c.rubros.length === 0)}
                  title={capitulos.every((c) => c.rubros.length === 0) ? "No hay rubros para entregar" : undefined}
                  className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Lock className="w-3.5 h-3.5" /> <span className="hidden md:inline">Entregar</span>
                </button>
              )}
              <button
                onClick={() => router.push(`/proyectos/${proyectoId}/editar`)}
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> <span className="hidden md:inline">Editar</span>
              </button>
              <button
                onClick={() => descargarExcelPresupuesto(proyectoActivo, capitulos, titulos)}
                disabled={capitulos.every((c) => c.rubros.length === 0)}
                title={capitulos.every((c) => c.rubros.length === 0) ? "No hay rubros para exportar" : undefined}
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> <span className="hidden md:inline">Excel</span>
              </button>
              <div className="relative">
                <button
                  onClick={() => setMenuPDFAbierto((p) => !p)}
                  className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> <span className="hidden md:inline">PDF</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {menuPDFAbierto && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuPDFAbierto(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-white rounded-[10px] border border-slate-200 shadow-lg overflow-hidden">
                      <a
                        href={`/api/proyectos/${proyectoActivo.id}/pdf?modo=cerrado`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuPDFAbierto(false)}
                        className="block px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100"
                      >
                        <p className="text-sm font-semibold text-[#1E293B]">PDF para cliente</p>
                        <p className="text-xs text-slate-400 mt-0.5">Capítulos agregados, sin desglose de rubros</p>
                      </a>
                      <a
                        href={`/api/proyectos/${proyectoActivo.id}/pdf?modo=abierto`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuPDFAbierto(false)}
                        className="block px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100"
                      >
                        <p className="text-sm font-semibold text-[#1E293B]">PDF detallado</p>
                        <p className="text-xs text-slate-400 mt-0.5">Obra grande / obra pública — rubro por rubro</p>
                      </a>
                      <a
                        href={`/api/proyectos/${proyectoActivo.id}/pdf?modo=interno`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuPDFAbierto(false)}
                        className="block px-4 py-2.5 hover:bg-slate-50 transition-colors"
                      >
                        <p className="text-sm font-semibold text-[#1E293B]">PDF de trabajo</p>
                        <p className="text-xs text-slate-400 mt-0.5">Uso interno, sin Memoria Descriptiva</p>
                      </a>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setMostrarConfirmEliminar(true)}
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-[8px] border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> <span className="hidden md:inline">Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pestañas de fase ─────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-1">
          {(
            [
              { id: "presupuesto", label: "Presupuesto" },
              { id: "gestion-obra", label: "Gestión de Obra" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                tabActiva === tab.id
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Banner: generación de rubros en curso ────────────── */}
      {proyecto?.generandoRubros && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 md:px-6 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center gap-2 text-sm text-blue-700">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            <span className="font-medium">Generando rubros...</span>
            <span className="text-blue-500">Estamos preparando tu presupuesto, listo en unos segundos.</span>
          </div>
        </div>
      )}

      {/* ── Modal confirmación eliminar proyecto ─────────────── */}
      {mostrarConfirmEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-[#1A3A5C]">¿Eliminar este proyecto?</h2>
            <p className="text-sm text-slate-500">
              Esta acción no se puede deshacer. Se eliminarán todos los capítulos, rubros, APUs, certificaciones y metrajes asociados.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setMostrarConfirmEliminar(false)}
                disabled={eliminando}
                className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarProyecto}
                disabled={eliminando}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> {eliminando ? "Eliminando…" : "Eliminar proyecto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmación "Entregar" — congela precioCongelado en
          todos los rubros y pasa a FINALIZADO/solo lectura. ── */}
      {mostrarConfirmEntregar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-[#1A3A5C]">¿Entregar este presupuesto?</h2>
            <p className="text-sm text-slate-500">
              Se congela el precio actual de cada rubro como precio pactado y el presupuesto pasa a solo lectura.
              Vas a poder habilitar la edición después si necesitás agregar, sacar o modificar algo.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setMostrarConfirmEntregar(false)}
                disabled={entregando}
                className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={entregarProyecto}
                disabled={entregando}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" /> {entregando ? "Entregando…" : "Entregar presupuesto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal "actualizar vigente vs. mantener pactado" — primer toque
          de cantidad/precioUnit en un rubro con precio ya pactado (ver
          pendienteDecisionPrecio en el render de las filas). ── */}
      {modalPrecioCongelado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-[#1A3A5C]">Este rubro ya fue entregado al cliente</h2>
            <p className="text-sm text-slate-500 break-words">{modalPrecioCongelado.descripcion}</p>

            {cargandoPrecioVigente ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Calculando precio vigente…
              </div>
            ) : precioVigenteInfo ? (
              <div className="rounded-[10px] border border-slate-200 divide-y divide-slate-100">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-slate-500">Precio pactado</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-700">{fmtMon(precioVigenteInfo.precioUnitAnterior)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-slate-500">Precio vigente</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-700">
                    {fmtMon(precioVigenteInfo.precioUnitVigente)}
                    {precioVigenteInfo.diffPct !== 0 && (
                      <span className={cn("ml-1.5 text-xs font-medium", precioVigenteInfo.diffPct > 0 ? "text-amber-600" : "text-emerald-600")}>
                        ({precioVigenteInfo.diffPct > 0 ? "+" : ""}{precioVigenteInfo.diffPct.toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-600">No se pudo calcular el precio vigente.</p>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
              <button
                onClick={mantenerPrecioPactado}
                disabled={aplicandoPrecioVigente}
                className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Mantener precio pactado
              </button>
              <button
                onClick={actualizarAlPrecioVigente}
                disabled={aplicandoPrecioVigente || cargandoPrecioVigente || !precioVigenteInfo}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {aplicandoPrecioVigente ? "Actualizando…" : "Actualizar al precio vigente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pestaña: Presupuesto — tabla de capítulos + anexos (contenido existente, sin cambios) ── */}
      {tabActiva === "presupuesto" && (
      <div className="max-w-6xl mx-auto w-full px-3 md:px-6 py-6 flex-1">

        {/* ── Documentación para metrar + Planilla de cómputo + Calculadora + Visor
            (ver UI_UX_REDESIGN.md sección 2quater — antes vivía en /proyectos/[id]/metrajes) ── */}
        <SeccionMetrajesPresupuesto
          proyectoId={proyectoActivo.id}
          documentacionLlamado={<SeccionDocumentacionLlamado proyectoId={proyectoActivo.id} />}
        />

        <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">

          {/* Barra de título + "Agregar capítulo" — antes vivía como botón
              fantasma al final de toda la tabla (después de los totales),
              casi invisible y solo alcanzable scrolleando todo. Reubicado
              acá arriba, mismo estilo que "+ Agregar rubro" (texto azul de
              marca, no borde punteado), para que sea igual de descubrible
              que agregar un rubro dentro de un capítulo. */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
            <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Presupuesto</span>
            {!soloLectura && (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMostrarModalTitulo(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar título
                </button>
                {/* Con 2+ títulos cada tarjeta tiene su propio "Agregar
                    capítulo" (sin ambigüedad sobre a cuál título va) — el
                    global solo tiene sentido con ≤1 título, donde manda
                    directo al único bucket visible. */}
                {!modoMultiTitulo && (
                  <button
                    onClick={() => setMostrarModalCapitulo(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar capítulo
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Envoltorio con scroll horizontal — GRID_CAPITULO tiene 252px de
              columnas fijas (Total/%/2 acciones); en pantallas angostas eso
              no dejaba espacio real para el nombre (colapsaba a 0px, ver
              bug reportado por Luis en mobile). min-w-[560px] le garantiza
              a la primera columna (nombre) un piso real de ~300px — si no
              entra en la pantalla, se scrollea la fila entera en vez de
              aplastar el nombre a nada. Mismo criterio que ya usa la tabla
              de rubros expandida (overflow-x-auto + min-w-[800px]) más abajo. */}
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              {/* Cabecera de la tabla — usa GRID_CAPITULO, la misma plantilla de columnas que la fila de Capítulo más abajo y que comparte Total/% Incid. con GRID_RUBRO */}
              <div className="grid border-b border-slate-200 px-5 py-2.5" style={{ gridTemplateColumns: GRID_CAPITULO }}>
                <div className="flex items-center gap-3">
                  <span className="w-6 flex-shrink-0" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capítulo</span>
                </div>
                <span className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Total</span>
                <span className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">% Incid.</span>
                <span />
                <span />
              </div>

          {/* Con 2+ títulos con contenido: cada uno agrupa sus capítulos,
              numerados "N.M" (título N, capítulo M dentro de ese título).
              Con ≤1 (el caso simple de siempre, título implícito o único
              explícito) se salta directo a la vista plana más abajo. */}
          {modoMultiTitulo && titulos.map((titulo, tituloIdx) => {
            const capsDelTitulo = capitulos.filter((c) => c.tituloId === titulo.id);
            const tituloExpandido = titulosExpandidos.has(titulo.id);
            const totalTitulo = capsDelTitulo.reduce((acc, c) => acc + totalCapitulo(c), 0);

            return (
              <div
                key={titulo.id}
                className="border-b-2 border-slate-200 last:border-0"
                style={{ borderLeft: `4px solid ${titulo.color ?? "#2563EB"}` }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setTitulosExpandidos((prev) => {
                      const next = new Set(prev);
                      if (next.has(titulo.id)) next.delete(titulo.id);
                      else next.add(titulo.id);
                      return next;
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    setTitulosExpandidos((prev) => {
                      const next = new Set(prev);
                      if (next.has(titulo.id)) next.delete(titulo.id);
                      else next.add(titulo.id);
                      return next;
                    });
                  }}
                  className="w-full grid items-center px-5 py-3 bg-slate-100 hover:bg-slate-200/70 transition-colors text-left group cursor-pointer"
                  style={{ gridTemplateColumns: GRID_CAPITULO }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold tabular-nums w-6 text-right flex-shrink-0" style={{ color: titulo.color ?? "#2563EB" }}>
                      {tituloIdx + 1}
                    </span>
                    {/* min-w-[64px] en vez de min-w-0 — con min-w-0 el nombre
                        podía colapsar a 0px de ancho en pantallas angostas
                        si sus hermanos flex-shrink-0 (número, "N capítulos")
                        no entraban; con un piso mínimo, ahora siempre queda
                        algo visible (truncado con "..." si hace falta) y es
                        la fila entera (ver overflow-x-auto arriba) la que
                        se scrollea, no el nombre el que desaparece. */}
                    <span className="flex-1 min-w-[64px] text-sm font-bold text-[#1A3A5C] truncate uppercase tracking-wide">
                      {titulo.nombre}
                    </span>
                    <span className="text-[11px] text-slate-400 flex-shrink-0">
                      {capsDelTitulo.length} capítulo{capsDelTitulo.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="px-2 text-right">
                    <span className="text-sm font-bold tabular-nums text-[#1A3A5C]">
                      {totalTitulo > 0 ? fmtMoneda(totalTitulo, moneda) : "—"}
                    </span>
                  </div>
                  <div className="px-2 text-right" title="% de incidencia sobre el Total General del proyecto">
                    <span className="text-xs font-medium tabular-nums text-slate-400 whitespace-nowrap">
                      {fmtPct(pctIncidencia(totalTitulo, totalGeneral))}
                    </span>
                  </div>
                  <div className="flex items-center justify-center">
                    {!soloLectura && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          eliminarTitulo(titulo);
                        }}
                        title="Eliminar título"
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-[4px] text-slate-400 hover:text-red-500 transition-colors"
                        style={{ width: 20, height: 20 }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors">
                    {tituloExpandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {tituloExpandido && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {capsDelTitulo.length === 0 ? (
                        <p className="px-5 py-3 text-xs text-slate-400">
                          Sin capítulos todavía — agregá los primeros abajo, o moveé uno existente desde el selector de título de cualquier capítulo.
                        </p>
                      ) : (
                        capsDelTitulo.map((cap, i) => renderFilaCapitulo(cap, `${tituloIdx + 1}.${i + 1}`))
                      )}
                      {!soloLectura && (
                        <div
                          className="flex items-center pl-6"
                          style={{ height: 30, borderTop: capsDelTitulo.length > 0 ? "1px solid #F1F5F9" : undefined }}
                        >
                          <button
                            onClick={() => setTituloParaAgregarCapitulos(titulo)}
                            className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Agregar capítulo
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

              {/* ≤1 título con contenido — vista plana: sin header de
                  título, numeración 01/02 corrida sobre todos los
                  capítulos del proyecto. El título único (implícito o
                  explícito) no deja ningún rastro visual acá — se ve y
                  funciona exactamente como un proyecto simple de toda la
                  vida. */}
              {!modoMultiTitulo && capitulos.map((cap, i) => renderFilaCapitulo(cap, String(i + 1).padStart(2, "0")))}
            </div>
          </div>
        </div>

        {/* ── Costo Directo → Gastos Generales y Beneficio (colapsable,
            monto combinado) → Costo Total → IVA → Precio Final —
            reemplaza a la vieja tarjeta fija Total/IVA/Total+IVA (ya no
            existe: Gastos Generales pasó a ser un monto agregado acá, no
            ignorado como antes). ── */}
        <TarjetaCostoDirecto
          moneda={moneda}
          costoDirecto={costoDirectoAgregado.total}
          metodoCostoDirecto={costoDirectoAgregado.metodo}
          rubrosSinApu={costoDirectoAgregado.rubrosSinApu}
        />

        <SeccionGastosGeneralesUtilidades
          moneda={moneda}
          modo={proyecto?.modoGastosGenerales ?? "PORCENTAJE"}
          gastosGeneralesPctDefault={proyecto?.gastosGeneralesPctDefault ?? null}
          utilidadPctDefault={proyecto?.utilidadPctDefault ?? null}
          categorias={proyecto?.gastosGeneralesDetallado ?? null}
          costosIndirectosAgregados={costosIndirectosAgregados}
          utilidadAgregada={utilidadAgregada}
          onChangeModo={actualizarModoGastosGenerales}
          onChangeGastosGeneralesPctDefault={actualizarGastosGeneralesPctDefault}
          onChangeUtilidadPctDefault={actualizarUtilidadPctDefault}
          onChangeCategorias={actualizarGastosGeneralesDetallado}
        />

        <TarjetaCostoTotalPrecioFinal
          moneda={moneda}
          costoDirecto={costoDirectoAgregado.total}
          montoGastosGeneralesYBeneficio={costosIndirectosAgregados + utilidadAgregada}
        />

        {mostrarModalCapitulo && (
          <ModalAgregarCapitulo
            onClose={() => setMostrarModalCapitulo(false)}
            onGuardar={async (nombre) => {
              const res = await fetch(`/api/proyectos/${proyectoActivo.id}/capitulos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre }),
              });
              if (!res.ok) throw new Error("No se pudo agregar el capítulo");
              window.location.reload();
            }}
          />
        )}

        {mostrarModalTitulo && (
          <ModalAgregarCapitulo
            titulo="Agregar título"
            etiquetaCampo="Nombre del título"
            placeholder="Ej. Impermeabilización azotea"
            mensajeError="No se pudo agregar el título. Probá de nuevo."
            onClose={() => setMostrarModalTitulo(false)}
            onGuardar={agregarTitulo}
          />
        )}

        {tituloParaAgregarCapitulos && (
          <ModalSelectorCapitulosTitulo
            titulo={tituloParaAgregarCapitulos}
            tipoObra={proyectoActivo.tipo}
            descripcionTrabajos={proyectoActivo.descripcion ?? ""}
            nombresExcluidos={capitulos
              .filter((c) => c.tituloId === tituloParaAgregarCapitulos.id)
              .map((c) => c.nombre)}
            onClose={() => setTituloParaAgregarCapitulos(null)}
            onAgregar={(seleccionados) => agregarCapitulosATitulo(tituloParaAgregarCapitulos.id, seleccionados)}
          />
        )}

        {/* ── Leyes Sociales / BPS ─────────────────────────── */}
        {leyesSociales && (
          <SeccionLeyesSociales
            proyectoId={proyectoActivo.id}
            moneda={moneda}
            data={leyesSociales}
            onChange={setLeyesSociales}
            onRecalcular={recalcularMontoImponible}
            onGuardar={guardarLeyesSociales}
            recalculando={recalculandoMO}
            guardando={guardandoLeyes}
            metodoMontoImponible={metodoMontoImponible}
            jornalMedioOficial={jornalMedioOficial}
            timbresCJP={proyecto?.timbresCJP ?? 0}
            desgloseMOPorCapitulo={desgloseMOPorCapitulo}
          />
        )}

        {/* ── Resumen del Presupuesto ───────────────────────── */}
        <SeccionResumenPresupuesto
          moneda={moneda}
          capitulos={capitulosConSubtotal}
          costoDirectoAgregado={costoDirectoAgregado.total}
          costosIndirectosAgregados={costosIndirectosAgregados}
          utilidadAgregada={utilidadAgregada}
          montoImponibleMO={leyesSociales ? leyesSociales.montoImponibleMO : null}
          timbresCJP={proyecto?.timbresCJP ?? 0}
          gastosGeneralesItems={proyecto?.gastosGeneralesItems ?? []}
          onChangeTimbresCJP={actualizarTimbresCJP}
          onChangeGastosGeneralesItems={actualizarGastosGeneralesItems}
        />

        {/* ── Garantías ──────────────────────────────────────── */}
        <SeccionGarantias
          fielCumplimiento={proyectoActivo.garantiaFielCumplimiento ?? ""}
          viciosOcultos={proyectoActivo.garantiaViciosOcultos ?? ""}
          responsabilidad={proyectoActivo.garantiaResponsabilidad ?? ""}
          onChangeFielCumplimiento={actualizarGarantiaFielCumplimiento}
          onChangeViciosOcultos={actualizarGarantiaViciosOcultos}
          onChangeResponsabilidad={actualizarGarantiaResponsabilidad}
          tipoContratacion={proyectoActivo.tipoContratacion ?? "PRIVADA"}
          totalGeneral={totalGeneral}
          moneda={moneda}
        />

        {/* ── Comparativo de ofertas ────────────────────────── */}
        <SeccionComparativoOfertas proyectoId={proyectoActivo.id} moneda={moneda} />

        {/* ── Detección de rubros faltantes ─────────────────── */}
        <SeccionPartidasFaltantes
          proyectoId={proyectoActivo.id}
          moneda={moneda}
          capitulos={capitulos.map((c) => ({ id: c.id, nombre: c.nombre }))}
          onAgregado={() => window.location.reload()}
        />

        {/* ── Memoria del presupuesto ──────────────────────── */}
        <SeccionMemoriaDescriptiva
          proyectoId={proyectoActivo.id}
          proyectoNombre={proyectoActivo.nombre}
          memoriaInicial={proyectoActivo.memoriaDescriptiva ?? null}
        />

        {/* ── Actualización de precios por índice ICCV ────────── */}
        <SeccionActualizacionPrecios
          proyectoId={proyectoActivo.id}
          moneda={moneda}
          totalActual={totalGeneral}
          fechaBaseDefault={
            proyectoActivo.fechaBaseIndice
              ? proyectoActivo.fechaBaseIndice.slice(0, 7)
              : proyectoActivo.createdAt
              ? proyectoActivo.createdAt.slice(0, 7)
              : null
          }
          ultimaActualizacionIndice={proyectoActivo.ultimaActualizacionIndice ?? null}
        />

      </div>
      )}

      {/* ── Pestaña: Gestión de Obra — Contrato → Inscripción de obra →
          Cómputo global de materiales → Cronograma → Certificaciones →
          Cierre de Obra. Las 3 del medio son funcionales (migradas desde
          Presupuesto, sin cambios de lógica); las 3 restantes son
          placeholders "Próximamente" — sin diseñar todavía. ── */}
      {tabActiva === "gestion-obra" && (
        <div className="max-w-6xl mx-auto w-full px-3 md:px-6 py-6 flex-1">
          {/* Fecha de inicio (se carga desde /editar, acá es de solo
              lectura) + placeholder de Plazo de obra — a futuro se calcula
              solo a partir de los jornales de mano de obra del presupuesto,
              todavía no implementado. Debajo: Forma de realización de la
              obra — Modalidad (manual, se carga en /editar) + Cuantía
              (calculada siempre, nunca editable ni persistida — ver
              computarCuantiaObra) + Tipo de contratación (ya cargado desde
              el wizard, mostrado acá también como referencia). Datos de
              ejecución de la obra, no de presupuesto — por eso viven acá
              y no en la pestaña Presupuesto. */}
          <div className="bg-white border border-slate-200 rounded-lg px-5 py-3">
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <div className="pr-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Fecha de inicio</p>
                <p className="text-sm font-semibold text-slate-700">
                  {fmtFecha(proyectoActivo.fechaInicio) ?? <span className="font-normal text-slate-400">A definir</span>}
                </p>
              </div>
              <div className="pl-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Plazo de obra</p>
                <p className="text-sm font-medium text-slate-400">A definir</p>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 mt-3 pt-3">
              <div className="pr-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Forma de realización</p>
                <p className="text-sm font-semibold text-slate-700">
                  {proyectoActivo.modalidadEjecucion
                    ? MODALIDAD_EJECUCION_LABEL[proyectoActivo.modalidadEjecucion] ?? proyectoActivo.modalidadEjecucion
                    : <span className="font-normal text-slate-400">A definir</span>}
                </p>
              </div>
              <div className="pl-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                  Cuantía
                  <span
                    title="Calculado automáticamente a partir del costo de mano de obra del presupuesto vigente — dato de referencia, no editable. Compará contra el tope vigente de BPS por tu cuenta."
                    className="text-[8px] font-bold text-slate-400 bg-slate-100 rounded px-1 leading-4 normal-case tracking-normal"
                  >
                    calc.
                  </span>
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  {cuantiaObra ? (
                    <>
                      {cuantiaObra.clasificacion}
                      <span className="font-normal text-slate-400"> ({Math.round(cuantiaObra.jornales)} jornales)</span>
                    </>
                  ) : (
                    <span className="font-normal text-slate-400">A definir</span>
                  )}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 mt-3 pt-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Tipo de contratación</p>
              <p className="text-sm font-semibold text-slate-700">
                {proyectoActivo.tipoContratacion === "PUBLICA" ? "Pública" : "Privada"}
              </p>
            </div>
          </div>

          <TarjetaProximamente
            icono={FileSignature}
            titulo="Contrato"
            descripcion="Acá vas a poder generar y gestionar el contrato de obra con el cliente."
          />
          <TarjetaProximamente
            icono={HardHat}
            titulo="Inscripción de obra"
            descripcion="Acá vas a poder gestionar la inscripción y documentación ante BPS y demás organismos."
          />

          <SeccionComputoGlobalMateriales
            proyectoId={proyectoActivo.id}
            proyectoNombre={proyectoActivo.nombre}
            filas={filasMateriales}
            total={totalMateriales}
          />

          <SeccionCronograma
            proyectoId={proyectoActivo.id}
            capitulos={capitulos.map((c) => ({
              id: c.id,
              nombre: c.nombre,
              codigo: c.codigo,
              color: c.color,
              fechaInicio: c.fechaInicio,
              fechaFin: c.fechaFin,
              rubros: c.rubros.map((r) => ({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit })),
            }))}
          />

          <SeccionCertificaciones
            proyectoId={proyectoActivo.id}
            moneda={moneda}
            totalGeneral={totalGeneral}
            capitulos={capitulos.map((c) => ({ id: c.id, nombre: c.nombre }))}
          />

          <TarjetaProximamente
            icono={ClipboardCheck}
            titulo="Cierre de Obra"
            descripcion="Acá vas a poder cerrar la obra: liquidación final, actas de recepción y documentación de cierre."
          />
        </div>
      )}

      {/* ── Drawer APU ──────────────────────────────────── */}
      <AnimatePresence>
        {drawerRubroId && drawerRubro && drawerAPU && drawerCapId && (
          <DrawerAPU
            rubro={drawerRubro}
            apu={drawerAPU}
            moneda={moneda}
            onClose={() => setDrawerRubroId(null)}
            onApuChange={(apu) => setApuData((prev) => ({ ...prev, [drawerRubroId]: apu }))}
            onAplicar={(precio, apuActual) => aplicarPrecioAPU(drawerRubroId, precio, apuActual)}
            onToggleTrabajoEnAltura={(actual) => toggleTrabajoEnAltura(drawerCapId, drawerRubroId, actual)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
