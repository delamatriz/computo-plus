import { db } from "@/lib/db";
import { calcularPrecioUnitario, montoAportesPatronales, redondearPrecio, sumarAportesPatronalesPct } from "@/lib/apu-calc";
import { hoyUruguayISO } from "@/lib/fechaUruguay";
import { resolverPreciosEquiposEnLote, resolverPreciosMaterialesEnLote } from "@/lib/resolverPrecioInsumo";
import type { EquipoRubroNuevo, ManoObraRubroNuevo, MaterialRubroNuevo } from "@/lib/rubroCatalogoNuevo";
import type { RubroEmpresaCreado } from "@/lib/rubroEmpresaNuevo";

// Utilidad del APU de un rubro nuevo de Mis rubros (mismo @default que APUEmpresa).
const UTILIDAD_PCT_EMPRESA = 10;

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const texto = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const precioOpcional = (v: unknown) => {
  const n = numero(v);
  return n > 0 ? redondearPrecio(n) : null;
};

/**
 * Crea un rubro desde cero en Mis rubros de la empresa (lo usa POST
 * /api/mi-biblioteca/crear, cualquier usuario logueado). `datos` es el cuerpo
 * del pedido sin validar (RubroEmpresaNuevo).
 *
 * Igual que "Guardar en Mis rubros" desde un proyecto, cada línea queda con
 * un precio fijo (snapshot), pero acá el precio sale de:
 *   - materiales/equipos: el precio que se cargó; si no se cargó, el del
 *     catálogo (PrecioMTOP / PrecioEquipo, por texto) — en ese caso el
 *     material queda vinculado (precioMTOPId) y el precio del catálogo
 *     también como referencia. Sin ninguno de los dos → 0, y se avisa.
 *   - mano de obra: el jornal vigente de la CategoriaLaboral.
 * Totales del APU: los mismos que guardar-en-mi-biblioteca (mano de obra +
 * aportes patronales legales por defecto), utilidad 10 %.
 * `codigo` queda null: no viene de un proyecto.
 */
export async function crearRubroEmpresa(
  empresaId: string,
  datosRecibidos: unknown
): Promise<{ status: number; body: RubroEmpresaCreado | { error: string } }> {
  if (!datosRecibidos || typeof datosRecibidos !== "object") {
    return { status: 400, body: { error: "Datos inválidos." } };
  }
  const datos = datosRecibidos as Record<string, unknown>;

  const nombre = texto(datos.nombre);
  const unidad = texto(datos.unidad);
  if (!nombre) return { status: 400, body: { error: "Falta el nombre del rubro." } };
  if (!unidad) return { status: 400, body: { error: "Falta la unidad." } };

  const materiales: MaterialRubroNuevo[] = (Array.isArray(datos.materiales) ? datos.materiales : [])
    .map((m: Record<string, unknown>) => ({
      descripcion: texto(m?.descripcion),
      unidad: texto(m?.unidad),
      rendimiento: numero(m?.rendimiento),
      precioReferencia: precioOpcional(m?.precioReferencia),
    }))
    .filter((m: MaterialRubroNuevo) => m.descripcion);
  const manoObra: ManoObraRubroNuevo[] = (Array.isArray(datos.manoObra) ? datos.manoObra : [])
    .map((m: Record<string, unknown>) => ({ categoria: texto(m?.categoria), rendimiento: numero(m?.rendimiento) }))
    .filter((m: ManoObraRubroNuevo) => m.categoria);
  const equipos: EquipoRubroNuevo[] = (Array.isArray(datos.equipos) ? datos.equipos : [])
    .map((e: Record<string, unknown>) => ({
      descripcion: texto(e?.descripcion),
      unidad: texto(e?.unidad),
      rendimiento: numero(e?.rendimiento),
      costoReferencia: precioOpcional(e?.costoReferencia),
    }))
    .filter((e: EquipoRubroNuevo) => e.descripcion);

  if (materiales.length + manoObra.length + equipos.length === 0) {
    return { status: 400, body: { error: "El rubro necesita al menos una línea de APU." } };
  }
  const lineaInvalida =
    materiales.find((m) => !m.unidad || !(m.rendimiento > 0))?.descripcion ??
    equipos.find((e) => !e.unidad || !(e.rendimiento > 0))?.descripcion ??
    manoObra.find((m) => !(m.rendimiento > 0))?.categoria;
  if (lineaInvalida) {
    return { status: 400, body: { error: `Revisá la línea "${lineaInvalida}": necesita unidad y una cantidad mayor que 0.` } };
  }

  // Mismo nombre en Mis rubros de esta empresa (sin distinguir mayúsculas ni
  // espacios repetidos), igual que guardar-en-mi-biblioteca.
  const existentes = await db.subrubroEmpresa.findMany({ where: { empresaId }, select: { nombre: true } });
  if (existentes.some((s) => normalizar(s.nombre) === normalizar(nombre))) {
    return { status: 409, body: { error: "Ya tenés un rubro con ese nombre en Mis rubros." } };
  }

  const categorias = await db.categoriaLaboral.findMany({ select: { nombre: true, jornal: true } });
  const jornalDe = (categoria: string) =>
    categorias.find((c) => normalizar(c.nombre) === normalizar(categoria))?.jornal;
  const categoriaDesconocida = manoObra.find((m) => jornalDe(m.categoria) == null);
  if (categoriaDesconocida) {
    return { status: 400, body: { error: `Categoría de mano de obra desconocida: ${categoriaDesconocida.categoria}.` } };
  }

  // El catálogo solo se consulta para las líneas sin precio cargado.
  const [catalogoMateriales, catalogoEquipos] = await Promise.all([
    resolverPreciosMaterialesEnLote(materiales.filter((m) => m.precioReferencia == null).map((m) => m.descripcion)),
    resolverPreciosEquiposEnLote(equipos.filter((e) => e.costoReferencia == null).map((e) => e.descripcion)),
  ]);

  const lineasSinPrecio: string[] = [];
  const lineasMateriales = materiales.map((m) => {
    const delCatalogo = m.precioReferencia == null ? catalogoMateriales.get(m.descripcion) : null;
    const precioCatalogo = delCatalogo && delCatalogo.precioUnitario > 0 ? redondearPrecio(delCatalogo.precioUnitario) : null;
    const precioUnit = m.precioReferencia ?? precioCatalogo ?? 0;
    if (!(precioUnit > 0)) lineasSinPrecio.push(m.descripcion);
    return {
      descripcion: m.descripcion,
      unidad: m.unidad,
      cantidad: m.rendimiento,
      precioUnit,
      precioTotal: redondearPrecio(m.rendimiento * precioUnit),
      precioMTOPId: precioCatalogo != null ? delCatalogo!.id : null,
      precioReferencia: precioCatalogo,
    };
  });
  const lineasEquipos = equipos.map((e) => {
    const delCatalogo = e.costoReferencia == null ? catalogoEquipos.get(e.descripcion) : null;
    const costoCatalogo = delCatalogo && delCatalogo.precioHora > 0 ? redondearPrecio(delCatalogo.precioHora) : null;
    const costoUnit = e.costoReferencia ?? costoCatalogo ?? 0;
    if (!(costoUnit > 0)) lineasSinPrecio.push(e.descripcion);
    return {
      descripcion: e.descripcion,
      unidad: e.unidad,
      cantidad: e.rendimiento,
      costoUnit,
      costoTotal: redondearPrecio(e.rendimiento * costoUnit),
      costoReferencia: costoCatalogo,
    };
  });
  const aportesPatronalesPct = sumarAportesPatronalesPct(null);
  const lineasManoObra = manoObra.map((m) => {
    const jornal = redondearPrecio(jornalDe(m.categoria) ?? 0);
    return {
      descripcion: m.categoria,
      categoria: m.categoria,
      cantidad: m.rendimiento,
      jornal,
      costoTotal: redondearPrecio(jornal / m.rendimiento),
      aportesPatronalesPct,
      jornalReferencia: jornal,
      jornadasHoras: 8,
    };
  });

  const sumMat = lineasMateriales.reduce((s, m) => s + m.cantidad * m.precioUnit, 0);
  const sumMO = lineasManoObra.reduce((s, m) => s + m.jornal / m.cantidad, 0);
  const costoManoObra = sumMO + montoAportesPatronales(sumMO, aportesPatronalesPct);
  const costoEquipos = lineasEquipos.reduce((s, e) => s + e.cantidad * e.costoUnit, 0);
  const costoTotal = sumMat + costoManoObra + costoEquipos;
  const precioUY = redondearPrecio(calcularPrecioUnitario(costoTotal, UTILIDAD_PCT_EMPRESA));

  const notasInternas = [
    `Creado desde cero en Mis rubros el ${hoyUruguayISO().slice(0, 10)}. Utilidad ${UTILIDAD_PCT_EMPRESA}%.`,
    ...(lineasSinPrecio.length > 0 ? [`lineas_sin_precio: ${JSON.stringify(lineasSinPrecio)}`] : []),
  ].join("\n");

  const subrubro = await db.$transaction(async (tx) => {
    const creado = await tx.subrubroEmpresa.create({
      data: { empresaId, nombre, unidad, precioUY, origen: "manual", codigo: null, notasInternas },
      select: { id: true },
    });
    const apu = await tx.aPUEmpresa.create({
      data: {
        subrubroId: creado.id,
        empresaId,
        costoMateriales: redondearPrecio(sumMat),
        costoEquipos: redondearPrecio(costoEquipos),
        costoManoObra: redondearPrecio(costoManoObra),
        costoTotal: redondearPrecio(costoTotal),
        gastosGeneralesPct: 0,
        utilidadPct: UTILIDAD_PCT_EMPRESA,
      },
      select: { id: true },
    });
    const apuId = apu.id;
    if (lineasMateriales.length > 0) await tx.materialAPUEmpresa.createMany({ data: lineasMateriales.map((m) => ({ ...m, apuId })) });
    if (lineasEquipos.length > 0) await tx.equipoAPUEmpresa.createMany({ data: lineasEquipos.map((e) => ({ ...e, apuId })) });
    if (lineasManoObra.length > 0) await tx.manoObraAPUEmpresa.createMany({ data: lineasManoObra.map((m) => ({ ...m, apuId })) });
    // Misma forma que GET /api/mi-biblioteca, para sumarlo a la lista sin recargar.
    return tx.subrubroEmpresa.findUniqueOrThrow({
      where: { id: creado.id },
      include: { apus: { include: { materiales: true, equipos: true, manoObra: true } } },
    });
  }, { timeout: 30_000, maxWait: 10_000 });

  return { status: 201, body: { subrubro, lineasSinPrecio } };
}
