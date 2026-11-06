import { db } from "@/lib/db";
import { buscarSubrubrosPorCapitulos, resolverDesglosesEnLote } from "@/lib/bibliotecaApus";
import {
  calcularPrecioUnitario,
  montoAportesPatronales,
  precioMaterialSinIva,
  redondearPrecio,
  sumarAportesPatronalesPct,
} from "@/lib/apu-calc";

/**
 * Precio de cada rubro del catálogo de un capítulo TAL COMO ENTRARÍA a este
 * proyecto si se agrega ahora: precios de hoy (no el "precio base" guardado
 * en la biblioteca, que puede estar viejo), materiales con o sin IVA según
 * Proyecto.descuentaIvaCompras, aportes patronales y Utilidad del proyecto.
 * Mismo cálculo que hace clonarApuAlRubro al agregarlo; sin esto el panel
 * mostraba un precio y el rubro entraba con otro (ej. Sika 612: $ 661,27 en
 * el panel, $ 567,62 en el proyecto).
 *
 * Devuelve { [subrubroId]: precio en pesos }, solo para los rubros con
 * descompuesto (los demás entran a su precio guardado). null si el proyecto
 * no existe.
 */
export async function preciosCatalogoParaProyecto(
  proyectoId: string,
  capituloCatalogoId: string
): Promise<Record<string, number> | null> {
  const [proyecto, subrubros] = await Promise.all([
    db.proyecto.findUnique({
      where: { id: proyectoId },
      select: {
        utilidadPctDefault: true,
        descuentaIvaCompras: true,
        leyesSociales: {
          select: { focerPatronalPct: true, fscFocapPct: true, fosvocPct: true, frlPct: true, fondoGarantiaPct: true },
        },
      },
    }),
    buscarSubrubrosPorCapitulos([capituloCatalogoId]),
  ]);
  if (!proyecto) return null;

  const [desgloses, apus] = await Promise.all([
    resolverDesglosesEnLote(subrubros),
    db.aPUEstandar.findMany({
      where: { subrubroId: { in: subrubros.map((s) => s.id) } },
      select: { subrubroId: true, utilidadPct: true },
    }),
  ]);
  const utilidadCatalogo = new Map(apus.map((a) => [a.subrubroId, a.utilidadPct]));
  const aportesPct = sumarAportesPatronalesPct(proyecto.leyesSociales);

  const precios: Record<string, number> = {};
  for (const s of subrubros) {
    const d = desgloses.get(s.id);
    if (!d) continue;
    // Utilidad: la del proyecto; si no tiene, la del descompuesto (igual que clonarApuAlRubro).
    const utilidadPct = proyecto.utilidadPctDefault ?? utilidadCatalogo.get(s.id) ?? 10;
    const materiales = proyecto.descuentaIvaCompras ? precioMaterialSinIva(d.materialesTotal) : d.materialesTotal;
    const costoDirecto = materiales + d.manoObraTotal + d.equiposTotal + montoAportesPatronales(d.manoObraTotal, aportesPct);
    const precio = redondearPrecio(calcularPrecioUnitario(costoDirecto, utilidadPct));
    if (precio > 0) precios[s.id] = precio;
  }
  return precios;
}
