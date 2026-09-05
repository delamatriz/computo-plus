import * as XLSX from "xlsx-js-style";

// Tipos mínimos — estructuralmente compatibles con los tipos más ricos de
// proyectos/[id]/page.tsx (Capitulo/Rubro/APU/InsumoAPU), que los siguen
// usando igual gracias al tipado estructural de TypeScript.
interface ComponenteInsumoLite {
  descripcion: string;
  unidad: string;
  rendimientoPorUnidad: number;
  precioUnit?: number;
}

interface InsumoAPULite {
  descripcion: string;
  unidad: string;
  rendimiento: number;
  precioUnit: number;
  componentes?: ComponenteInsumoLite[];
}

interface APULite {
  materiales: InsumoAPULite[];
}

interface RubroLite {
  id: string;
  cantidad: number | null;
}

interface CapituloLite {
  rubros: RubroLite[];
}

export type FilaMaterialGlobal = {
  descripcion: string;
  unidad: string;
  cantidadTotal: number;
  precioUnit?: number;
};

/** Agrega los materiales de todos los APU del proyecto en una sola lista (cómputo global) */
export function computarMaterialesGlobales(
  capitulos: CapituloLite[],
  apuData: Record<string, APULite>
): { filas: FilaMaterialGlobal[]; total: number } {
  const mapa = new Map<string, FilaMaterialGlobal>();

  const agregar = (key: string, desc: string, unidad: string, cant: number, precio: number | undefined) => {
    const ex = mapa.get(key);
    if (ex) {
      ex.cantidadTotal += cant;
    } else {
      mapa.set(key, { descripcion: desc, unidad, cantidadTotal: cant, precioUnit: precio });
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
            agregar(`${comp.descripcion}||${comp.unidad}`, comp.descripcion, comp.unidad, cant, comp.precioUnit);
          }
        } else {
          const cant = m.rendimiento * rubro.cantidad;
          agregar(`${m.descripcion}||${m.unidad}`, m.descripcion, m.unidad, cant, m.precioUnit);
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
export function descargarExcelMateriales(nombreProyecto: string, filas: FilaMaterialGlobal[], total: number) {
  const fecha = new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
  const wb = XLSX.utils.book_new();

  const datos: (string | number | null)[][] = [
    [`LISTA DE MATERIALES — ${nombreProyecto}`],
    [`Fecha de generación: ${fecha}`],
    [],
    ["MATERIAL", "UNIDAD", "CANTIDAD", "PRECIO UNIT. (UYU)", "COSTO TOTAL (UYU)"],
    ...filas.map((f) => [
      f.descripcion,
      f.unidad,
      parseFloat(f.cantidadTotal.toFixed(2)),
      f.precioUnit != null ? parseFloat(f.precioUnit.toFixed(2)) : null,
      f.precioUnit != null ? parseFloat((f.cantidadTotal * f.precioUnit).toFixed(2)) : null,
    ]),
    ["TOTAL MATERIALES", "", "", "", parseFloat(total.toFixed(2))],
  ];

  const ws = XLSX.utils.aoa_to_sheet(datos);

  ws["!cols"] = [
    { wch: 35 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
  ];

  // Aplicar formato numérico directamente en cada celda numérica
  // Columnas C(2), D(3), E(4) — filas de datos + fila total
  const COLS = ["A", "B", "C", "D", "E"];
  const numColIdx = [2, 3, 4];
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
