"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import * as XLSX from "xlsx-js-style";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  ArrowLeft,
  X,
  LayoutList,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SeccionLeyesSociales, { LeyesSocialesData } from "@/components/SeccionLeyesSociales";
import SeccionCertificaciones from "@/components/SeccionCertificaciones";
import SeccionComparativoOfertas from "@/components/SeccionComparativoOfertas";
import SeccionCronograma from "@/components/SeccionCronograma";
import SeccionPartidasFaltantes from "@/components/SeccionPartidasFaltantes";
import SeccionMemoriaDescriptiva from "@/components/SeccionMemoriaDescriptiva";
import SeccionActualizacionPrecios from "@/components/SeccionActualizacionPrecios";

/* ─── Tipo Proyecto ───────────────────────────────────────── */
interface ProyectoData {
  id: string;
  nombre: string;
  cliente: string;
  tipo: string;
  estado: keyof typeof ESTADOS;
  moneda: string;
  area: number;
  direccion: string;
  memoriaDescriptiva?: string | null;
  createdAt?: string | null;
  fechaBaseIndice?: string | null;
  ultimaActualizacionIndice?: string | null;
  generandoRubros?: boolean;
}

/* ─── Tipos base ──────────────────────────────────────────── */
interface Rubro {
  id: string;
  descripcion: string;
  unidad: string;
  cantidad: number | null;
  precioUnit: number | null;
}

interface Capitulo {
  id: string;
  nombre: string;
  codigo?: string;
  color?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  rubros: Rubro[];
}

interface SubrubroEstandar {
  id: string;
  codigo: string;
  capitulo: string;
  subcapitulo: string | null;
  descripcion: string;
  unidad: string;
  precioUY: number;
  fechaBase: string;
  aportesSociales: number;
}

type MapeoSAU = { alias: string[]; capitulos: string[]; subcapitulos?: string[] };

const MUROS_SUBCAPS = [
  "Elevación de Muros — Ladrillo de Campo",
  "Elevación de Muros — Ticholos",
  "Elevación de Muros — Bloque Hormigón",
  "Elevación de Muros — Ladrillo de Vidrio",
];
const REVOQUES_SUBCAPS = [
  "Revoques — Cielorraso",
  "Revoques — Muros Interiores",
  "Revoques — Muros Exteriores",
  "Revoques — Otros",
];
const PISOS_SUBCAPS = ["Pisos, Zócalos y Otros", "Revestimientos", "Contrapisos"];

/**
 * Mapeo entre nombres de capítulo del proyecto y capítulos/subcapítulos del rubrado SAU ago. 2022.
 * Cada entrada admite varios alias porque distintos proyectos nombran los capítulos de forma distinta
 * (ej: "Pisos, Zócalos y Revestimientos" vs "Revestimientos y pisos").
 */
const CAPITULOS_SAU: MapeoSAU[] = [
  { alias: ["Implantación y Replanteo", "Trabajos preliminares"], capitulos: ["Implantación y Replanteo"] },
  { alias: ["Excavaciones y Movimiento de Tierra"], capitulos: ["Excavaciones y Movimientos de Tierra"] },
  { alias: ["Movimiento de tierra y fundaciones"], capitulos: ["Excavaciones y Movimientos de Tierra", "Cimentaciones"] },
  { alias: ["Demoliciones y Picados", "Picado de mamposteria", "Picado de mampostería"], capitulos: ["Demoliciones"] },
  { alias: ["Cimentaciones"], capitulos: ["Cimentaciones"] },
  { alias: ["Estructura de Hormigón Armado", "Estructura"], capitulos: ["Estructura"] },
  // Albañilería completa: muros + revoques (excluye pisos/revestimientos e impermeabilizaciones, que tienen capítulo propio)
  { alias: ["Albañilería"], capitulos: ["Albañilería"], subcapitulos: [...MUROS_SUBCAPS, ...REVOQUES_SUBCAPS] },
  { alias: ["Mampostería y muros"], capitulos: ["Albañilería"], subcapitulos: MUROS_SUBCAPS },
  { alias: ["Revoques y enlucidos"], capitulos: ["Albañilería"], subcapitulos: REVOQUES_SUBCAPS },
  { alias: ["Pisos, Zócalos y Revestimientos", "Revestimientos y pisos"], capitulos: ["Albañilería"], subcapitulos: PISOS_SUBCAPS },
  { alias: ["Impermeabilizaciones y Aislaciones"], capitulos: ["Albañilería"], subcapitulos: ["Impermeabilizaciones y Aislaciones"] },
  { alias: ["Pinturas", "Pintura"], capitulos: ["Subcontratos - Pinturas"] },
  { alias: ["Carpintería"], capitulos: ["Subcontratos - Carpinterías"] },
  { alias: ["Herrería y metálica", "Herrería y metalica"], capitulos: ["Subcontratos - Carpinterías"], subcapitulos: ["Hierro"] },
  { alias: ["Vidrios y Espejos", "Vidriería"], capitulos: ["Subcontratos - Vidrios"] },
  { alias: ["Yeso y Cielorrasos"], capitulos: ["Subcontratos - Yeso"] },
  { alias: ["Sistemas Constructivos No Tradicionales"], capitulos: ["Sistemas No Tradicionales"] },
  { alias: ["Equipamiento"], capitulos: ["Subcontratos - Acondicionamientos"] },
  { alias: ["Obras exteriores y paisajismo", "Obra Exterior / Jardín", "Obra Exterior y Jardín"], capitulos: ["Subcontratos - Acondicionamientos"] },
  { alias: ["Cubierta / Techos", "Cubierta"], capitulos: ["Cubierta / Techos"] },
  { alias: ["Instalación Sanitaria"], capitulos: ["Instalación Sanitaria"] },
  { alias: ["Instalación Eléctrica"], capitulos: ["Instalación Eléctrica"] },
  { alias: ["Instalación Térmica / Aire Acondicionado", "Instalación Térmica"], capitulos: ["Instalación Térmica / Aire Acondicionado"] },
];

function obtenerMapeoSAU(nombreCapitulo: string): { capitulos: string[]; subcapitulos?: string[] } | undefined {
  const norm = nombreCapitulo.trim().toLowerCase();
  const entrada = CAPITULOS_SAU.find((m) => m.alias.some((a) => a.toLowerCase() === norm));
  return entrada ? { capitulos: entrada.capitulos, subcapitulos: entrada.subcapitulos } : undefined;
}

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
}

interface PrecioMTOPResult {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number;
  numeroLista: number;
}

interface ManoObraAPU {
  id: string;
  categoria: string;
  jornadaHs: number;
  rendimiento: number;
  jornalRef: number;
}

/* ─── Categoría laboral SUNCA ─────────────────────────────── */
interface CategoriaLaboral {
  id: string;
  nombre: string;
  categoria: string;
  jornal: number;
}

interface EquipoAPU {
  id: string;
  descripcion: string;
  unidad: string;
  rendimiento: number;
  costoUnit: number;
}

interface APU {
  materiales: InsumoAPU[];
  manoObra: ManoObraAPU[];
  equipos: EquipoAPU[];
  gastosGeneralesPct: number;
  utilidadPct: number;
}

/* ─── Datos de prueba ─────────────────────────────────────── */
const PROYECTO = {
  id: "1",
  nombre: "Vivienda unifamiliar — Pocitos",
  cliente: "Familia González",
  tipo: "Vivienda unifamiliar",
  estado: "EN_CURSO" as const,
  moneda: "USD",
  area: 120,
  direccion: "Bulevar España 2345, Montevideo",
  memoriaDescriptiva: null as string | null,
  createdAt: null as string | null,
  fechaBaseIndice: null as string | null,
  ultimaActualizacionIndice: null as string | null,
};

const ESTADOS = {
  EN_CURSO:   { label: "En curso",   color: "#2563EB", bg: "#EFF6FF" },
  BORRADOR:   { label: "Borrador",   color: "#64748B", bg: "#F1F5F9" },
  FINALIZADO: { label: "Finalizado", color: "#16A34A", bg: "#F0FDF4" },
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
    gastosGeneralesPct: 15,
    utilidadPct: 10,
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
    gastosGeneralesPct: 15,
    utilidadPct: 10,
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

/** Un capítulo se considera "vacío" si no tiene rubros o todos están sin descripción */
function capituloVacio(cap: Capitulo): boolean {
  return cap.rubros.every((r) => !r.descripcion?.trim());
}

type FilaMaterialGlobal = { descripcion: string; unidad: string; dosificacion?: string; cantidadTotal: number; precioUnit?: number };

/** Agrega los materiales de todos los APU del proyecto en una sola lista (cómputo global) */
function computarMaterialesGlobales(capitulos: Capitulo[], apuData: Record<string, APU>): { filas: FilaMaterialGlobal[]; total: number } {
  const mapa = new Map<string, FilaMaterialGlobal>();

  const agregar = (key: string, desc: string, unidad: string, dosif: string | undefined, cant: number, precio: number | undefined) => {
    const ex = mapa.get(key);
    if (ex) {
      ex.cantidadTotal += cant;
    } else {
      mapa.set(key, { descripcion: desc, unidad, dosificacion: dosif, cantidadTotal: cant, precioUnit: precio });
    }
  };

  for (const cap of capitulos) {
    for (const rubro of cap.rubros) {
      const apu = apuData[rubro.id];
      if (!apu || rubro.cantidad == null) continue;
      for (const m of apu.materiales) {
        if (m.componentes && m.componentes.length > 0) {
          for (const comp of m.componentes) {
            const cant = comp.rendimientoPorUnidad * m.rendimiento * rubro.cantidad;
            agregar(`${comp.descripcion}||${comp.unidad}`, comp.descripcion, comp.unidad, undefined, cant, comp.precioUnit);
          }
        } else {
          const cant = m.rendimiento * rubro.cantidad;
          agregar(`${m.descripcion}||${m.unidad}`, m.descripcion, m.unidad, m.dosificacion, cant, m.precioUnit);
        }
      }
    }
  }

  const filas = Array.from(mapa.values())
    .filter((f) => f.cantidadTotal > 0)
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));

  const total = filas.reduce((s, f) => (f.precioUnit == null ? s : s + f.cantidadTotal * f.precioUnit), 0);

  return { filas, total };
}

/** Genera y descarga el Excel "Lista de Materiales" del cómputo global */
function descargarExcelMateriales(nombreProyecto: string, filas: FilaMaterialGlobal[], total: number) {
  const fecha = new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
  const wb = XLSX.utils.book_new();

  const datos: (string | number | null)[][] = [
    [`LISTA DE MATERIALES — ${nombreProyecto}`],
    [`Fecha de generación: ${fecha}`],
    [],
    ["MATERIAL", "UNIDAD", "DOSIFICACIÓN", "CANTIDAD", "PRECIO UNIT. (UYU)", "COSTO TOTAL (UYU)"],
    ...filas.map((f) => [
      f.descripcion,
      f.unidad,
      f.dosificacion ?? "",
      parseFloat(f.cantidadTotal.toFixed(2)),
      f.precioUnit != null ? parseFloat(f.precioUnit.toFixed(2)) : null,
      f.precioUnit != null ? parseFloat((f.cantidadTotal * f.precioUnit).toFixed(2)) : null,
    ]),
    ["TOTAL MATERIALES", "", "", "", "", parseFloat(total.toFixed(2))],
  ];

  const ws = XLSX.utils.aoa_to_sheet(datos);

  ws["!cols"] = [
    { wch: 35 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
  ];

  // Aplicar formato numérico directamente en cada celda numérica
  // Columnas D(3), E(4), F(5) — filas de datos + fila total
  const COLS = ["A", "B", "C", "D", "E", "F"];
  const numColIdx = [3, 4, 5];
  const dataStart = 4; // índice 0-based de la primera fila de datos
  const totalRowIdx = datos.length - 1;

  for (let r = dataStart; r <= totalRowIdx; r++) {
    numColIdx.forEach((c) => {
      const addr = `${COLS[c]}${r + 1}`;
      const cell = ws[addr];
      if (cell != null && cell.v != null) {
        cell.t = "n";
        cell.z = "#,##0.00";
      }
    });
  }

  XLSX.utils.book_append_sheet(wb, ws, "Lista de Materiales");
  XLSX.writeFile(wb, `Lista-Materiales-${nombreProyecto.replace(/\s+/g, "-")}.xlsx`);
}

/** Genera y descarga el Excel del presupuesto completo (capítulos, rubros y totales) */
function descargarExcelPresupuesto(proyecto: ProyectoData, capitulos: Capitulo[]) {
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

  for (const cap of capitulosConRubros) {
    r = pushRow([cap.nombre]);
    styleRow(r, styTituloCap);
    merges.push({ s: { r, c: 0 }, e: { r, c: NUM_COLS - 1 } });

    let subtotalCap = 0;
    for (const rubro of cap.rubros.filter((r) => r.descripcion.trim() !== "")) {
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

    r = pushRow(["", "", "", "", `SUBTOTAL ${cap.nombre}`, parseFloat(subtotalCap.toFixed(2))]);
    styleRow(r, stySubtotal);

    totalGeneral += subtotalCap;
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

function fmtMoneda(v: number, moneda: string): string {
  if (v === 0) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
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

function calcAPU(apu: APU): { costoDirecto: number; precioFinal: number } {
  const sumMat = apu.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
  const sumMO  = apu.manoObra.reduce((s, mo) => s + (mo.jornadaHs / mo.rendimiento) * mo.jornalRef, 0);
  const sumEq  = apu.equipos.reduce((s, e) => s + e.rendimiento * e.costoUnit, 0);
  const costoDirecto = sumMat + sumMO + sumEq;
  const precioFinal  = costoDirecto * (1 + apu.gastosGeneralesPct / 100) * (1 + apu.utilidadPct / 100);
  return { costoDirecto, precioFinal };
}

/* ─── Buscador MTOP inline ────────────────────────────────── */
function BuscadorMTOP({
  onSeleccionar,
  onManual,
  onCancelar,
}: {
  onSeleccionar: (m: PrecioMTOPResult) => void;
  onManual: (textoActual: string) => void;
  onCancelar: () => void;
}) {
  const [q, setQ]             = useState("");
  const [resultados, setResultados] = useState<PrecioMTOPResult[]>([]);
  const [buscando, setBuscando]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const buscar = (texto: string) => {
    setQ(texto);
    clearTimeout(timerRef.current);
    if (texto.length < 2) { setResultados([]); return; }
    setBuscando(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/precios-mtop?q=${encodeURIComponent(texto)}`);
        const data: PrecioMTOPResult[] = await res.json();
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
        placeholder="Buscar material... (ej: cemento, arena, hierro)"
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
                  $ {fmtMon(r.precioUnitario)}/{r.unidad}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-400">{r.unidad}</span>
                <span className="text-[9px] font-bold px-1 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-wide">
                  Lista {r.numeroLista}
                </span>
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
  onSeleccionar,
  onCerrar,
}: {
  subrubros: SubrubroEstandar[];
  cargando: boolean;
  moneda: string;
  onSeleccionar: (s: SubrubroEstandar) => void;
  onCerrar: () => void;
}) {
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
        {!cargando && subrubros.map((s) => {
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
                <span className="text-sm font-bold text-[#2563EB] whitespace-nowrap flex-shrink-0 tabular-nums">
                  {fmtMonedaDecimal(precio, moneda)}/{s.unidad}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {s.subcapitulo && (
                  <span className="text-[10px] text-slate-400">{s.subcapitulo}</span>
                )}
                <span className="text-[9px] font-medium text-slate-300">
                  precio base {s.fechaBase} — actualizar con ICCV
                </span>
              </div>
            </button>
          );
        })}
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
}: {
  categorias: CategoriaLaboral[];
  onSeleccionar: (cat: CategoriaLaboral) => void;
  onPersonalizada: () => void;
  onCancelar: () => void;
}) {
  const categoriasOrdenadas = [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

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
        {categoriasOrdenadas.map((c) => (
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
}

function SeccionAPU({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(true);
  return (
    <div className="border border-slate-200 rounded-[10px] overflow-hidden">
      <button
        onClick={() => setAbierta((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{titulo}</span>
        {abierta
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
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

function DrawerAPU({ rubro, apu, moneda, onClose, onApuChange, onAplicar }: DrawerAPUProps) {
  const dragControls = useDragControls();
  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const [mostrarSelectorMO, setMostrarSelectorMO] = useState(false);
  const [categoriasLaborales, setCategoriasLaborales] = useState<CategoriaLaboral[]>([]);
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

  const totalManoObra = apu.manoObra.reduce((acc, mo) => {
    const hsPorUnidad = mo.rendimiento > 0 ? mo.jornadaHs / mo.rendimiento : 0;
    const sub = hsPorUnidad / mo.jornadaHs * mo.jornalRef * (rubro.cantidad ?? 1);
    return acc + (Number.isFinite(sub) ? sub : 0);
  }, 0);

  const totalEquipos = apu.equipos.reduce((acc, eq) => acc + eq.rendimiento * eq.costoUnit, 0);

  // Auto-save del APU completo a la DB, debounced — se dispara al salir de
  // cualquier campo editable de Materiales, Mano de obra o Equipos.
  const guardarApuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardarApuActual = useCallback(() => {
    if (guardarApuTimer.current) clearTimeout(guardarApuTimer.current);
    guardarApuTimer.current = setTimeout(() => {
      fetch(`/api/rubros/${rubro.id}/apu`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apu),
      }).catch((err) => console.error("[auto-save APU]", err));
    }, 600);
  }, [apu, rubro.id]);

  // Cargar categorías laborales SUNCA al montar
  useEffect(() => {
    let cancelado = false;
    fetch("/api/categorias-laborales")
      .then((res) => res.json())
      .then((data: CategoriaLaboral[]) => { if (!cancelado) setCategoriasLaborales(Array.isArray(data) ? data : []); })
      .catch((err) => console.error("[categorías laborales]", err));
    return () => { cancelado = true; };
  }, []);

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
    }));

  // Seleccionar desde el buscador MTOP — agrega nueva fila precargada
  const agregarDesdeMTOP = (m: PrecioMTOPResult) => {
    setMat([...apu.materiales, {
      id:             `m${Date.now()}`,
      descripcion:    m.descripcion,
      unidad:         m.unidad,
      rendimiento:    0,
      precioUnit:     m.precioUnitario,
      codigoMTOP:     m.codigo,
      precioMTOPOrig: m.precioUnitario,
    }]);
    setMostrarBuscador(false);
  };

  // Agregar fila vacía sin MTOP — pre-completa con el texto escrito en el buscador
  const agregarManual = (texto: string) => {
    setMat([...apu.materiales, {
      id: `m${Date.now()}`,
      descripcion: texto.trim(),
      unidad: "",
      rendimiento: 0,
      precioUnit: 0,
    }]);
    setMostrarBuscador(false);
  };

  const updateMO = (id: string, field: keyof ManoObraAPU, val: string) =>
    setMO(apu.manoObra.map((mo) => mo.id !== id ? mo : {
      ...mo,
      [field]: field === "categoria" ? val : (val === "" ? 0 : parseFloat(val)),
    }));

  const updateEq = (id: string, field: keyof EquipoAPU, val: string) =>
    setEq(apu.equipos.map((e) => e.id !== id ? e : {
      ...e,
      [field]: field === "descripcion" || field === "unidad" ? val : (val === "" ? 0 : parseFloat(val)),
    }));

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
  const addEq  = () => setEq([...apu.equipos,    { id: `e${Date.now()}`,  descripcion: "", unidad: "", rendimiento: 0, costoUnit: 0 }]);

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
            <h2 className="text-base font-bold text-[#1A3A5C] leading-tight">
              {rubro.descripcion || "Rubro sin nombre"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Análisis de Precio Unitario
              {rubro.unidad && <span className="ml-1 font-medium text-slate-500">({rubro.unidad})</span>}
            </p>
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

          {/* 1 — MATERIALES */}
          <SeccionAPU titulo="Materiales">
            <div className="pb-2">
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
                </colgroup>
                <thead>
                  <tr style={{ background: "#F8FAFC", height: 28 }} className="border-b border-slate-100">
                    <th className="text-left pl-4 font-semibold text-slate-400 uppercase tracking-wider">Insumo</th>
                    <th className="text-center font-semibold text-slate-400 uppercase tracking-wider">Dosif.</th>
                    <th className="text-center font-semibold text-slate-400 uppercase tracking-wider">Unidad</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap" title="Cantidad por unidad de rubro">Cant/U</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">P. unit.</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">Subtotal</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">Costo tot.</th>
                  </tr>
                </thead>
                <tbody>
                  {apu.materiales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="pl-4 py-2 text-slate-400 italic">Sin materiales</td>
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
                        <tr className="border-b border-slate-50" style={{ height: 28 }}>
                          <td className="pl-4 pr-2">
                            <input
                              type="text"
                              value={m.descripcion}
                              onChange={(e) => updateMat(m.id, "descripcion", e.target.value)}
                              onBlur={guardarApuActual}
                              placeholder="Descripción"
                              className={inputCls}
                            />
                          </td>
                          <td className="text-center">
                            <input type="text" value={m.dosificacion ?? ""} onChange={(e) => updateMat(m.id, "dosificacion", e.target.value)} onBlur={guardarApuActual} placeholder="—" className={cn(inputCls, "text-center text-slate-500")} />
                          </td>
                          <td className="text-center">
                            <input type="text" value={m.unidad} onChange={(e) => updateMat(m.id, "unidad", e.target.value)} onBlur={guardarApuActual} placeholder="u" className={cn(inputCls, "text-center")} />
                          </td>
                          <td className="text-right pr-2">
                            <input
                              type="number"
                              value={m.rendimiento === 0 ? "" : m.rendimiento}
                              onChange={(e) => updateMat(m.id, "rendimiento", e.target.value)}
                              onBlur={guardarApuActual}
                              placeholder="0"
                              className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                            />
                          </td>
                          <td className="text-right pr-3 py-0.5">
                            <input
                              type="number"
                              value={m.precioUnit === 0 ? "" : m.precioUnit}
                              onChange={(e) => updateMat(m.id, "precioUnit", e.target.value)}
                              onBlur={guardarApuActual}
                              placeholder="0.00"
                              className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                            />
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
                      <td colSpan={6} className="text-right pr-3 font-bold text-slate-600 uppercase tracking-wide">TOTAL MATERIALES</td>
                      <td className="text-right pr-3 font-bold tabular-nums text-[#2563EB]">{fmtMon(totalMateriales)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              {/* Buscador MTOP inline */}
              {mostrarBuscador && (
                <BuscadorMTOP
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
          <SeccionAPU titulo="Mano de obra">
            <div className="pb-2">
              <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs border-collapse min-w-[480px]">
                <colgroup>
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "64px" }} />
                  <col style={{ width: "72px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "84px" }} />
                  <col style={{ width: "80px" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#F8FAFC", height: 28 }} className="border-b border-slate-100">
                    <th className="text-left pl-4 font-semibold text-slate-400 uppercase tracking-wider">Categoría</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider" title="Horas de la jornada laboral">Jornada</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider" title={`Horas necesarias por ${rubro.unidad || "unidad"} de rubro`}>Hs/{rubro.unidad || "u"}</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider" title="Horas totales para el rubro completo">Hs totales</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider" title="Jornal de referencia por jornada de 8hs (UYU)">Jornal ref.</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {apu.manoObra.length === 0 && (
                    <tr><td colSpan={6} className="pl-4 py-2 text-slate-400 italic">Sin mano de obra</td></tr>
                  )}
                  {apu.manoObra.map((mo) => {
                    const hsPorUnidad = mo.rendimiento > 0 ? mo.jornadaHs / mo.rendimiento : 0;
                    const hsTotales  = rubro.cantidad != null ? hsPorUnidad * rubro.cantidad : null;
                    const sub        = hsPorUnidad / mo.jornadaHs * mo.jornalRef * (rubro.cantidad ?? 1);
                    const catRef = categoriasLaborales.find(
                      (c) => c.nombre.trim().toLowerCase() === mo.categoria.trim().toLowerCase()
                    );
                    return (
                      <tr key={mo.id} className="border-b border-slate-50" style={{ height: 28 }}>
                        <td className="pl-4 pr-2">
                          <input type="text" value={mo.categoria} onChange={(e) => updateMO(mo.id, "categoria", e.target.value)} onBlur={guardarApuActual} placeholder="Peón / Oficial" className={inputCls} />
                        </td>
                        <td className="text-right pr-2">
                          <input type="number" value={mo.jornadaHs || ""} onChange={(e) => updateMO(mo.id, "jornadaHs", e.target.value)} onBlur={guardarApuActual} placeholder="8" className={cn(inputCls, "text-right")} />
                        </td>
                        <td className="text-right pr-2 tabular-nums text-slate-700">
                          {hsPorUnidad > 0 ? fmtMon(hsPorUnidad) : "—"}
                        </td>
                        <td className="text-right pr-2 tabular-nums text-slate-700">
                          {hsTotales != null && hsTotales > 0 ? fmtMon(hsTotales) : "—"}
                        </td>
                        <td className="text-right pr-3">
                          <input type="number" value={mo.jornalRef || ""} onChange={(e) => updateMO(mo.id, "jornalRef", e.target.value)} onBlur={guardarApuActual} placeholder="0" className={cn(inputCls, "text-right")} />
                          {catRef && (
                            <div className="text-[9px] text-slate-400 leading-tight">{catRef.categoria}</div>
                          )}
                        </td>
                        <td className="text-right pr-3 font-semibold tabular-nums text-[#2563EB]">
                          {sub > 0 ? fmtMon(sub) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {apu.manoObra.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#F1F5F9", height: 28 }} className="border-t border-slate-200">
                      <td colSpan={5} className="text-right pr-3 font-bold text-slate-600 uppercase tracking-wide">TOTAL MANO DE OBRA</td>
                      <td className="text-right pr-3 font-bold tabular-nums text-[#2563EB]">{fmtMon(totalManoObra)}</td>
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
                </colgroup>
                <thead>
                  <tr style={{ background: "#F8FAFC", height: 28 }} className="border-b border-slate-100">
                    <th className="text-left pl-4 font-semibold text-slate-400 uppercase tracking-wider">Equipo</th>
                    <th className="text-center font-semibold text-slate-400 uppercase tracking-wider">Unidad</th>
                    <th className="text-right pr-2 font-semibold text-slate-400 uppercase tracking-wider" title="Cantidad por unidad de rubro">Cant/U</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">P. unit.</th>
                    <th className="text-right pr-3 font-semibold text-slate-400 uppercase tracking-wider">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {apu.equipos.length === 0 && (
                    <tr><td colSpan={5} className="pl-4 py-2 text-slate-400 italic">Sin equipos</td></tr>
                  )}
                  {apu.equipos.map((eq) => {
                    const sub = eq.rendimiento * eq.costoUnit;
                    return (
                      <tr key={eq.id} className="border-b border-slate-50" style={{ height: 28 }}>
                        <td className="pl-4 pr-2">
                          <input
                            type="text"
                            value={eq.descripcion}
                            onChange={(e) => updateEq(eq.id, "descripcion", e.target.value)}
                            onBlur={() => guardarApuActual()}
                            placeholder="Descripción"
                            className={inputCls}
                          />
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
                          <input
                            type="number"
                            value={eq.costoUnit || ""}
                            onChange={(e) => updateEq(eq.id, "costoUnit", e.target.value)}
                            onBlur={() => guardarApuActual()}
                            placeholder="0.00"
                            className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                          />
                        </td>
                        <td className="text-right pr-3 font-semibold tabular-nums text-[#2563EB]">
                          {sub > 0 ? fmtMon(sub) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {apu.equipos.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#F1F5F9", height: 28 }} className="border-t border-slate-200">
                      <td colSpan={4} className="text-right pr-3 font-bold text-slate-600 uppercase tracking-wide">TOTAL EQUIPOS</td>
                      <td className="text-right pr-3 font-bold tabular-nums text-[#2563EB]">{fmtMon(totalEquipos)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              <div className="pl-4 pt-1.5">
                <button onClick={addEq} className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                  <Plus className="w-3 h-3" /> Agregar equipo
                </button>
              </div>
            </div>
          </SeccionAPU>
        </div>

        {/* Resumen APU — pie fijo */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-[#F8FAFC] px-5 py-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Costo directo</span>
            <span className="font-semibold tabular-nums text-slate-700">{fmtMon(costoDirecto)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Gastos generales</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={apu.gastosGeneralesPct}
                  onChange={(e) => onApuChange({ ...apu, gastosGeneralesPct: parseFloat(e.target.value) || 0 })}
                  className="w-10 text-center text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
            </div>
            <span className="font-semibold tabular-nums text-slate-700">{fmtMon(costoDirecto * apu.gastosGeneralesPct / 100)}</span>
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
            <span className="font-semibold tabular-nums text-slate-700">{fmtMon(costoDirecto * (1 + apu.gastosGeneralesPct / 100) * apu.utilidadPct / 100)}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Precio unitario</span>
            <span className="text-xl font-bold tabular-nums text-[#2563EB]">{fmtMoneda(precioFinal, moneda)}</span>
          </div>

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

/* ─── Componente principal ────────────────────────────────── */
export default function ProyectoPage() {
  const params = useParams();
  const router = useRouter();
  const proyectoId = (params?.id as string) ?? "proyecto-demo-1";

  // ─── Estado ────────────────────────────────────────────────
  const [proyecto, setProyecto] = useState<ProyectoData | null>(null);
  const [mostrarConfirmEliminar, setMostrarConfirmEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  // Rubro cuya descripción está siendo editada — mientras tanto se muestra el valor real, no toTitleCase
  const [descripcionEnFoco, setDescripcionEnFoco] = useState<string | null>(null);
  const [capitulos, setCapitulos] = useState<Capitulo[]>([]);
  // Ref para leer siempre el estado más reciente de capitulos desde callbacks async
  const capitulosRef = useRef<Capitulo[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [apuData, setApuData] = useState<Record<string, APU>>({});
  const [drawerRubroId, setDrawerRubroId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [leyesSociales, setLeyesSociales] = useState<LeyesSocialesData | null>(null);
  const [recalculandoMO, setRecalculandoMO] = useState(false);
  const [guardandoLeyes, setGuardandoLeyes] = useState(false);
  const [apuGenerando, setApuGenerando] = useState<Set<string>>(new Set());
  const [panelSubrubrosCapId, setPanelSubrubrosCapId] = useState<string | null>(null);
  const [subrubrosPorCapitulo, setSubrubrosPorCapitulo] = useState<Record<string, SubrubroEstandar[]>>({});
  const [cargandoSubrubros, setCargandoSubrubros] = useState(false);

  // Refs para debounce de auto-save por rubro
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ─── Carga inicial desde la DB ─────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      let res: Response;
      try {
        res = await fetch(`/api/proyectos/${proyectoId}`, { signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`Error ${res.status} al cargar el proyecto`);
      const data = await res.json();

      // Mapear proyecto
      setProyecto({
        id:        data.id,
        nombre:    data.nombre,
        cliente:   data.cliente    ?? "",
        tipo:      data.tipo       ?? "",
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
      });

      // Mapear capítulos y rubros
      const caps: Capitulo[] = (data.capitulos ?? []).map((cap: {
        id: string; nombre: string; codigo?: string; color?: string;
        fechaInicio?: string | null; fechaFin?: string | null;
        rubros: {
          id: string; descripcion: string; unidad: string;
          cantidad: number; precioUnit: number; apu: unknown;
        }[];
      }) => ({
        id:          cap.id,
        nombre:      cap.nombre,
        codigo:      cap.codigo,
        color:       cap.color,
        fechaInicio: cap.fechaInicio,
        fechaFin:    cap.fechaFin,
        rubros: (cap.rubros ?? []).map((r) => ({
          id:          r.id,
          descripcion: r.descripcion,
          unidad:      r.unidad,
          cantidad:    r.cantidad   || null,
          precioUnit:  r.precioUnit || null,
        })),
      }));
      setCapitulos(caps);

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
              gastosGeneralesPct: rubro.apu.gastosGeneralesPct ?? 15,
              utilidadPct:        rubro.apu.utilidadPct        ?? 10,
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

  const proyectoActivo = proyecto ?? PROYECTO;
  const moneda = proyectoActivo.moneda;
  const estado = ESTADOS[proyectoActivo.estado] ?? ESTADOS.BORRADOR;
  const totalGeneral = capitulos.reduce((s, c) => s + totalCapitulo(c), 0);

  const { filas: filasMateriales, total: totalMateriales } = useMemo(
    () => computarMaterialesGlobales(capitulos, apuData),
    [capitulos, apuData]
  );

  // Rubro activo en el drawer
  const drawerRubro = drawerRubroId
    ? capitulos.flatMap((c) => c.rubros).find((r) => r.id === drawerRubroId) ?? null
    : null;
  const drawerAPU = drawerRubroId ? (apuData[drawerRubroId] ?? {
    materiales: [], manoObra: [], equipos: [], gastosGeneralesPct: 15, utilidadPct: 10,
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
              gastosGeneralesPct: 15,
              utilidadPct: 10,
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

  const abrirSubrubrosPanel = useCallback(async (cap: Capitulo) => {
    setPanelSubrubrosCapId(cap.id);
    if (subrubrosPorCapitulo[cap.id]) return;

    const mapeo = obtenerMapeoSAU(cap.nombre) ?? { capitulos: [cap.nombre] };
    setCargandoSubrubros(true);
    try {
      const resultados = await Promise.all(
        mapeo.capitulos.map((capSAU) =>
          fetch(`/api/subrubros-estandar?capitulo=${encodeURIComponent(capSAU)}`).then((r) =>
            r.ok ? r.json() : []
          )
        )
      );
      let lista: SubrubroEstandar[] = resultados.flat();
      if (mapeo.subcapitulos) {
        lista = lista.filter((s) => s.subcapitulo && mapeo.subcapitulos!.includes(s.subcapitulo));
      }
      setSubrubrosPorCapitulo((prev) => ({ ...prev, [cap.id]: lista }));
    } catch (err) {
      console.error("[abrirSubrubrosPanel]", err);
      setSubrubrosPorCapitulo((prev) => ({ ...prev, [cap.id]: [] }));
    } finally {
      setCargandoSubrubros(false);
    }
  }, [subrubrosPorCapitulo]);

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
    if (!yaExpandido && !proyecto?.generandoRubros && capituloVacio(cap) && obtenerMapeoSAU(cap.nombre)) {
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

      // Subrubro sin precio base (precioUY === 0) — disparar sugerencia de APU automáticamente
      if (sinPrecio) {
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
              gastosGeneralesPct: 15,
              utilidadPct: 10,
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
                ? value === "" ? null : parseFloat(value)
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
          ? value === "" ? 0 : parseFloat(value)
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
        gastosGeneralesPct: 15,
        utilidadPct: 10,
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
          <Link
            href="/proyectos"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            Mis proyectos
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <h1 className="text-lg md:text-xl font-bold text-[#1A3A5C] break-words">{proyectoActivo.nombre}</h1>
                <span
                  className="text-[11px] md:text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: estado.bg, color: estado.color }}
                >
                  {estado.label}
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 break-words">
                {proyectoActivo.cliente}
                {proyectoActivo.tipo && ` · ${proyectoActivo.tipo}`}
                {proyectoActivo.area && ` · ${proyectoActivo.area} m²`}
                {proyectoActivo.direccion && ` · ${proyectoActivo.direccion}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => router.push(`/proyectos/${proyectoId}/editar`)}
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> <span className="hidden md:inline">Editar</span>
              </button>
              <button
                onClick={() => descargarExcelPresupuesto(proyectoActivo, capitulos)}
                disabled={capitulos.every((c) => c.rubros.length === 0)}
                title={capitulos.every((c) => c.rubros.length === 0) ? "No hay rubros para exportar" : undefined}
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> <span className="hidden md:inline">Excel</span>
              </button>
              <a
                href={`/api/proyectos/${proyectoActivo.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> <span className="hidden md:inline">PDF</span>
              </a>
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

      {/* ── Tabla de capítulos ──────────────────────────── */}
      <div className="max-w-6xl mx-auto w-full px-3 md:px-6 py-6 flex-1">
        <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">

          {/* Cabecera de la tabla */}
          <div className="grid grid-cols-[2fr_1fr] border-b border-slate-200 px-5 py-2.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Capítulo</span>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Total</span>
          </div>

          {/* Lista de capítulos */}
          {capitulos.map((cap, capIdx) => {
            const expandido = expandidos.has(cap.id);
            const totalCap = totalCapitulo(cap);

            return (
              <div key={cap.id} className="border-b border-slate-200 last:border-0">

                {/* Fila del capítulo */}
                <button
                  onClick={() => toggleCapituloConSubrubros(cap)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold tabular-nums w-6 text-right flex-shrink-0" style={{ color: "#2563EB" }}>
                      {String(capIdx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-semibold text-[#1A3A5C] truncate">{cap.nombre}</span>
                    {cap.rubros.length > 0 && (
                      <span className="text-[11px] text-slate-400 flex-shrink-0">
                        {cap.rubros.length} rubro{cap.rubros.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold tabular-nums" style={{ color: totalCap > 0 ? "#2563EB" : "#CBD5E1" }}>
                      {totalCap > 0 ? fmtMoneda(totalCap, moneda) : "—"}
                    </span>
                    <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
                      {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </div>
                </button>

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
                        <div className="min-w-[640px]">

                        {capituloVacio(cap) ? (
                          <>
                            {obtenerMapeoSAU(cap.nombre) && (
                              <PanelSubrubrosEstandar
                                subrubros={subrubrosPorCapitulo[cap.id] ?? []}
                                cargando={cargandoSubrubros}
                                moneda={moneda}
                                onSeleccionar={(s) => agregarRubroDesdeSubrubro(cap.id, s)}
                                onCerrar={() => setPanelSubrubrosCapId(null)}
                              />
                            )}
                            <div className="flex items-center pl-6" style={{ height: 26, borderTop: "1px solid #F1F5F9" }}>
                              <button
                                onClick={() => agregarRubro(cap.id)}
                                className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Agregar rubro personalizado
                              </button>
                            </div>
                          </>
                        ) : (
                        <>
                        {/* Header de columnas */}
                        <div className="flex items-center bg-slate-50 border-b border-slate-200" style={{ height: 28 }}>
                          {/* espacio botón APU + número */}
                          <div style={{ width: 64, flexShrink: 0 }} />
                          <div className="flex-1 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Descripción</div>
                          <div style={{ width: 76,  flexShrink: 0 }} className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Unidad</div>
                          <div style={{ width: 96,  flexShrink: 0 }} className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Cantidad</div>
                          <div style={{ width: 116, flexShrink: 0 }} className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Precio unit.</div>
                          <div style={{ width: 116, flexShrink: 0 }} className="pl-2 pr-5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Total</div>
                          <div style={{ width: 28, flexShrink: 0 }} />
                        </div>

                        {/* Filas */}
                        <div>
                          {cap.rubros.map((rubro, rubroIdx) => {
                            const tieneAPU = !!apuData[rubro.id];
                            const apuPrecio = tieneAPU ? calcAPU(apuData[rubro.id]).precioFinal : 0;

                            return (
                              <div
                                key={rubro.id}
                                className={cn(
                                  "group flex items-center hover:bg-blue-50/20 transition-colors",
                                  rubroIdx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                                )}
                                style={{ height: 28, borderBottom: "1px solid #F1F5F9" }}
                              >
                                {/* Botón APU + número */}
                                <div style={{ width: 64, flexShrink: 0 }} className="flex items-center justify-end gap-1 pr-1 pl-3">
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
                                <div className="flex-1 px-2 min-w-0 flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={descripcionEnFoco === rubro.id ? rubro.descripcion : toTitleCase(rubro.descripcion)}
                                    onChange={(e) => actualizarRubro(cap.id, rubro.id, "descripcion", e.target.value)}
                                    onFocus={() => setDescripcionEnFoco(rubro.id)}
                                    onBlur={() => { setDescripcionEnFoco(null); sugerirAPU(cap.id, rubro.id); }}
                                    placeholder="Descripción del rubro"
                                    className="flex-1 min-w-0 text-sm text-slate-700 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 placeholder:text-slate-300"
                                  />
                                  {apuGenerando.has(rubro.id) && (
                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" title="Generando APU…" />
                                  )}
                                  {!apuGenerando.has(rubro.id) && tieneAPU && apuPrecio > 0 && (
                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Precio estimado por IA" />
                                  )}
                                </div>

                                <div style={{ width: 76, flexShrink: 0 }} className="px-2">
                                  <input
                                    type="text"
                                    value={rubro.unidad}
                                    onChange={(e) => actualizarRubro(cap.id, rubro.id, "unidad", e.target.value)}
                                    onBlur={() => sugerirAPU(cap.id, rubro.id)}
                                    placeholder="m²"
                                    className="w-full text-sm text-slate-600 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 text-center placeholder:text-slate-300"
                                  />
                                </div>
                                <div style={{ width: 96, flexShrink: 0 }} className="px-2">
                                  <input
                                    type="number"
                                    value={rubro.cantidad ?? ""}
                                    onChange={(e) => actualizarRubro(cap.id, rubro.id, "cantidad", e.target.value)}
                                    placeholder="0"
                                    className="w-full text-sm text-slate-600 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 text-right placeholder:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                                <div style={{ width: 116, flexShrink: 0 }} className="px-2">
                                  <input
                                    type="number"
                                    value={rubro.precioUnit ?? ""}
                                    onChange={(e) => actualizarRubro(cap.id, rubro.id, "precioUnit", e.target.value)}
                                    onBlur={() => {
                                      if (rubro.precioUnit && rubro.precioUnit > 0) {
                                        guardarEnBibliotecaGlobal(rubro.descripcion, rubro.unidad, cap.nombre, rubro.precioUnit, moneda);
                                      }
                                    }}
                                    placeholder="0.00"
                                    className="w-full text-sm text-slate-600 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 text-right placeholder:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                                <div style={{ width: 116, flexShrink: 0 }} className="pl-2 pr-5 text-right">
                                  <span className={cn("text-sm font-semibold tabular-nums", totalRubro(rubro) > 0 ? "text-[#2563EB]" : "text-slate-300")}>
                                    {totalRubro(rubro) > 0 ? fmtMoneda(totalRubro(rubro), moneda) : "—"}
                                  </span>
                                </div>
                                <div style={{ width: 28, flexShrink: 0 }} className="flex items-center justify-center">
                                  <button
                                    onClick={() => eliminarRubro(cap.id, rubro.id, rubro.descripcion)}
                                    title="Eliminar rubro"
                                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-[4px] text-slate-300 hover:text-red-500 transition-colors"
                                    style={{ width: 20, height: 20 }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Subtotal */}
                        <div className="flex items-center bg-slate-50 border-t border-slate-200" style={{ height: 26 }}>
                          <div className="flex-1 pl-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Subtotal {cap.nombre}
                          </div>
                          <div style={{ width: 116, flexShrink: 0 }} className="pl-2 pr-5 text-sm font-bold tabular-nums text-right text-[#2563EB]">
                            {fmtMoneda(totalCap, moneda)}
                          </div>
                        </div>

                        {/* Botón agregar rubro */}
                        <div className="flex items-center gap-4 pl-6" style={{ height: 26, borderTop: "1px solid #F1F5F9" }}>
                          {obtenerMapeoSAU(cap.nombre) && (
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

                        {panelSubrubrosCapId === cap.id && (
                          <PanelSubrubrosEstandar
                            subrubros={subrubrosPorCapitulo[cap.id] ?? []}
                            cargando={cargandoSubrubros}
                            moneda={moneda}
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
          })}

          {/* ── Total general ───────────────────────────── */}
          <div className="border-t-2 border-slate-300 px-5 py-4 flex items-center justify-between bg-white">
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Total general</span>
            <span className="text-xl font-bold tabular-nums" style={{ color: "#1A3A5C" }}>
              {fmtMoneda(totalGeneral, moneda)}
            </span>
          </div>
        </div>

        {/* Botón agregar capítulo */}
        <div className="mt-4 flex justify-start">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] border border-dashed border-slate-300 text-sm font-medium text-slate-400 hover:text-[#2563EB] hover:border-[#2563EB]/40 transition-colors bg-white">
            <Plus className="w-4 h-4" /> Agregar capítulo
          </button>
        </div>

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
          />
        )}

        {/* ── Certificaciones ──────────────────────────────── */}
        <SeccionCertificaciones
          proyectoId={proyectoActivo.id}
          moneda={moneda}
          totalGeneral={totalGeneral}
          capitulos={capitulos.map((c) => ({ id: c.id, nombre: c.nombre }))}
        />

        {/* ── Comparativo de ofertas ────────────────────────── */}
        <SeccionComparativoOfertas proyectoId={proyectoActivo.id} moneda={moneda} />

        {/* ── Detección de partidas faltantes ─────────────────── */}
        <SeccionPartidasFaltantes
          proyectoId={proyectoActivo.id}
          moneda={moneda}
          capitulos={capitulos.map((c) => ({ id: c.id, nombre: c.nombre }))}
          onAgregado={() => window.location.reload()}
        />

        {/* ── Cronograma ─────────────────────────────────────── */}
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

        {/* ── Memoria descriptiva ──────────────────────────── */}
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

        {/* ── Cómputo global de materiales ────────────────── */}
        {filasMateriales.length > 0 && (() => {
          const filas = filasMateriales;

          return (
            <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
                  Cómputo global de materiales
                </h2>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/proyectos/${proyectoActivo.id}/lista-materiales-pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </a>
                  <button
                    onClick={() => descargarExcelMateriales(proyectoActivo.nombre, filas, totalMateriales)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Excel
                  </button>
                </div>
              </div>
              <div className="flex items-center px-5 py-2 bg-slate-50 border-b border-slate-200">
                <div className="flex-1 pr-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Material</div>
                <div style={{ width: 56  }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">Unidad</div>
                <div style={{ width: 100 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">Dosif.</div>
                <div style={{ width: 110 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Cantidad</div>
                <div style={{ width: 100 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">P. unit.</div>
                <div style={{ width: 140 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right pr-4">Costo total</div>
              </div>
              {filas.map((f, idx) => {
                const costoTotal = f.precioUnit != null ? f.cantidadTotal * f.precioUnit : null;
                return (
                  <div
                    key={`${f.descripcion}||${f.unidad}`}
                    className={cn("flex items-center px-5 border-b border-slate-100 last:border-0", idx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white")}
                    style={{ minHeight: 32 }}
                  >
                    <div className="flex-1 pr-2 text-sm text-slate-700 font-medium truncate">{f.descripcion}</div>
                    <div style={{ width: 56  }} className="text-sm text-slate-500 text-center">{f.unidad}</div>
                    <div style={{ width: 100 }} className="text-sm text-slate-500 text-center">{f.dosificacion || "—"}</div>
                    <div style={{ width: 110 }} className="text-sm tabular-nums text-slate-700 font-semibold text-right">{fmtMon(f.cantidadTotal)}</div>
                    <div style={{ width: 100 }} className="text-sm tabular-nums text-slate-500 text-right">{f.precioUnit != null ? fmtMon(f.precioUnit) : "—"}</div>
                    <div style={{ width: 140 }} className="text-sm font-bold tabular-nums text-[#2563EB] text-right pr-4">{costoTotal != null ? fmtMon(costoTotal) : "—"}</div>
                  </div>
                );
              })}
              {/* Total materiales */}
              <div className="flex items-center px-5 py-3 border-t-2 border-slate-300 bg-white">
                <div className="flex-1 text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Total materiales</div>
                <div style={{ width: 56  }} />
                <div style={{ width: 100 }} />
                <div style={{ width: 110 }} />
                <div style={{ width: 100 }} />
                <div style={{ width: 140 }} className="text-base font-bold tabular-nums text-[#1A3A5C] text-right pr-4">
                  {totalMateriales > 0 ? `$ ${Math.round(totalMateriales).toLocaleString("es-UY")}` : "—"}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Drawer APU ──────────────────────────────────── */}
      <AnimatePresence>
        {drawerRubroId && drawerRubro && drawerAPU && (
          <DrawerAPU
            rubro={drawerRubro}
            apu={drawerAPU}
            moneda={moneda}
            onClose={() => setDrawerRubroId(null)}
            onApuChange={(apu) => setApuData((prev) => ({ ...prev, [drawerRubroId]: apu }))}
            onAplicar={(precio, apuActual) => aplicarPrecioAPU(drawerRubroId, precio, apuActual)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
