import { db } from "@/lib/db";
import { calcularPrecioUnitario, redondearPrecio, sumarAportesPatronalesPct } from "@/lib/apu-calc";
import { costoDirectoUnitario } from "@/lib/costoAgregado";
import { hoyUruguayISO, mesUruguayISO } from "@/lib/fechaUruguay";
import { precioConRespaldo, resolverPrecioEquipo, resolverPrecioMaterial } from "@/lib/resolverPrecioInsumo";
import type {
  EquipoRubroNuevo,
  ManoObraRubroNuevo,
  MaterialRubroNuevo,
  RubroCatalogoCreado,
} from "@/lib/rubroCatalogoNuevo";

// Utilidad del APU de un rubro nuevo del catálogo (mismo @default que APUEstandar).
const UTILIDAD_PCT_CATALOGO = 10;

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const precioOpcional = (v: unknown) => {
  const n = numero(v);
  return n > 0 ? redondearPrecio(n) : null;
};

/**
 * Crea un rubro nuevo en el catálogo global (lo usa POST /api/subrubros-estandar/crear,
 * solo SUPERADMIN). `datos` es el cuerpo del pedido sin validar (RubroCatalogoNuevo):
 * SubrubroEstandar + APUEstandar con sus materiales, mano de obra y equipos,
 * en un capítulo existente o en uno nuevo (CapituloCatalogo).
 *
 * Precios: igual que guardar-en-biblioteca, cada línea se resuelve en vivo
 * contra el catálogo (materiales contra PrecioMTOP, equipos contra
 * PrecioEquipo, por texto; mano de obra contra CategoriaLaboral, por
 * nombre). El precio que se carga en el formulario queda como respaldo
 * (precioReferencia / costoReferencia), que solo se usa si la línea no
 * resuelve. precioUY = lo que daría clonar el rubro hoy.
 *
 * Código: "<capítulo>.<n>", con n el siguiente número libre del capítulo
 * (ej. "13.5" si el más alto es 13.4.x); en un capítulo nuevo, su orden + 1.
 */
export async function crearRubroCatalogo(
  datosRecibidos: unknown
): Promise<{ status: number; body: RubroCatalogoCreado | { error: string } }> {
  if (!datosRecibidos || typeof datosRecibidos !== "object") {
    return { status: 400, body: { error: "Datos inválidos." } };
  }
  const datos = datosRecibidos as Record<string, unknown>;

  const descripcion = texto(datos.descripcion);
  const unidad = texto(datos.unidad);
  const capituloIdRecibido = texto(datos.capituloId);
  const capituloNuevo = texto(datos.capituloNuevo);
  const activo = datos.activo !== false;
  if (!descripcion) return { status: 400, body: { error: "Falta el nombre del rubro." } };
  if (!unidad) return { status: 400, body: { error: "Falta la unidad." } };
  if (!capituloIdRecibido && !capituloNuevo) return { status: 400, body: { error: "Falta el capítulo." } };

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

  const categorias = await db.categoriaLaboral.findMany({ select: { nombre: true, jornal: true } });
  const jornalDe = (categoria: string) =>
    categorias.find((c) => normalizar(c.nombre) === normalizar(categoria))?.jornal;
  const categoriaDesconocida = manoObra.find((m) => jornalDe(m.categoria) == null);
  if (categoriaDesconocida) {
    return { status: 400, body: { error: `Categoría de mano de obra desconocida: ${categoriaDesconocida.categoria}.` } };
  }

  // Capítulo: existente, o nuevo (si ya hay uno con ese nombre, se usa ese).
  const capitulo = capituloIdRecibido
    ? await db.capituloCatalogo.findUnique({ where: { id: capituloIdRecibido } })
    : await db.capituloCatalogo.findFirst({ where: { nombre: { equals: capituloNuevo, mode: "insensitive" } } });
  if (capituloIdRecibido && !capitulo) {
    return { status: 404, body: { error: "Capítulo no encontrado." } };
  }

  if (capitulo) {
    const candidatos = await db.subrubroEstandar.findMany({
      where: { activo: true, capituloId: capitulo.id, unidad: { equals: unidad, mode: "insensitive" } },
      select: { codigo: true, descripcion: true },
    });
    const existente = candidatos.find((s) => normalizar(s.descripcion) === normalizar(descripcion));
    if (existente) {
      return { status: 409, body: { error: `Ya existe un rubro igual en ese capítulo (${existente.codigo}).` } };
    }
  }

  // Precios vigentes de cada línea (mismo criterio que el clonado).
  const lineasSinPrecio: string[] = [];
  const materialesConPrecio = await Promise.all(
    materiales.map(async (m) => {
      const resuelto = await resolverPrecioMaterial(m.descripcion);
      const { precio } = precioConRespaldo(resuelto?.precioUnitario, m.precioReferencia);
      if (!(precio > 0)) lineasSinPrecio.push(m.descripcion);
      return { ...m, precioUnit: precio };
    })
  );
  const equiposConPrecio = await Promise.all(
    equipos.map(async (e) => {
      const resuelto = await resolverPrecioEquipo(e.descripcion);
      const { precio } = precioConRespaldo(resuelto?.precioHora, e.costoReferencia);
      if (!(precio > 0)) lineasSinPrecio.push(e.descripcion);
      return { ...e, costoUnit: precio };
    })
  );
  const manoObraConJornal = manoObra.map((m) => ({ ...m, jornalRef: jornalDe(m.categoria) ?? 0 }));

  const costoDirecto = costoDirectoUnitario({
    materiales: materialesConPrecio,
    manoObra: manoObraConJornal,
    equipos: equiposConPrecio,
    aportesPatronalesPct: sumarAportesPatronalesPct(null),
    utilidadPct: UTILIDAD_PCT_CATALOGO,
  });
  const precioUY = redondearPrecio(calcularPrecioUnitario(costoDirecto, UTILIDAD_PCT_CATALOGO));

  const creado = await db.$transaction(async (tx) => {
    const cap =
      capitulo ??
      (await tx.capituloCatalogo.create({
        data: {
          nombre: capituloNuevo,
          orden: ((await tx.capituloCatalogo.aggregate({ _max: { orden: true } }))._max.orden ?? -1) + 1,
        },
      }));
    if (!cap.activo) await tx.capituloCatalogo.update({ where: { id: cap.id }, data: { activo: true } });

    // Código "<prefijo>.<n>": el prefijo más usado por los rubros del
    // capítulo (su número) o, si no tiene, orden + 1; n = siguiente libre.
    const delCapitulo = await tx.subrubroEstandar.findMany({
      where: { capituloId: cap.id },
      select: { codigo: true },
    });
    const conteo = new Map<string, number>();
    for (const { codigo } of delCapitulo) {
      const prefijo = /^(\d+)\./.exec(codigo)?.[1];
      if (prefijo) conteo.set(prefijo, (conteo.get(prefijo) ?? 0) + 1);
    }
    const prefijo = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? String(cap.orden + 1);
    // n = el segundo número más alto del capítulo + 1, contando también los
    // códigos de subcapítulo ("13.4.1" → 4), para no confundirse con uno.
    const reSegundo = new RegExp(`^${prefijo}\\.(\\d+)`);
    let n = Math.max(0, ...delCapitulo.map(({ codigo }) => Number(reSegundo.exec(codigo)?.[1] ?? 0))) + 1;
    while (await tx.subrubroEstandar.findUnique({ where: { codigo: `${prefijo}.${n}` }, select: { id: true } })) n++;

    const maxOrden = await tx.subrubroEstandar.aggregate({
      where: { capituloId: cap.id, subcapituloId: null },
      _max: { orden: true },
    });

    const subrubro = await tx.subrubroEstandar.create({
      data: {
        codigo: `${prefijo}.${n}`,
        descripcion,
        unidad,
        precioUY,
        fechaBase: mesUruguayISO(),
        origen: "manual",
        activo,
        capituloId: cap.id,
        orden: (maxOrden._max.orden ?? -1) + 1,
        notasInternas: `Creado en el catálogo de rubros el ${hoyUruguayISO().slice(0, 10)}.`,
        apuEstandar: {
          create: {
            gastosGeneralesPct: 0,
            utilidadPct: UTILIDAD_PCT_CATALOGO,
            materiales: {
              create: materiales.map((m) => ({
                descripcion: m.descripcion,
                unidad: m.unidad,
                rendimiento: m.rendimiento,
                precioReferencia: m.precioReferencia,
              })),
            },
            manoObra: {
              create: manoObra.map((m) => ({ categoria: m.categoria, jornadaHs: 8, rendimiento: m.rendimiento })),
            },
            equipos: {
              create: equipos.map((e) => ({
                descripcion: e.descripcion,
                unidad: e.unidad,
                rendimiento: e.rendimiento,
                costoReferencia: e.costoReferencia,
              })),
            },
          },
        },
      },
    });
    return { subrubro, capituloId: cap.id };
  }, { timeout: 30_000, maxWait: 10_000 });

  const respuesta: RubroCatalogoCreado = {
    id: creado.subrubro.id,
    codigo: creado.subrubro.codigo,
    capituloId: creado.capituloId,
    precioUY,
    activo,
    lineasSinPrecio,
  };
  return { status: 201, body: respuesta };
}
