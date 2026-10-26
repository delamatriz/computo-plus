import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularPrecioUnitario, costoUnitEfectivo, redondearPrecio } from "@/lib/apu-calc";
import { costoDirectoUnitario } from "@/lib/costoAgregado";
import { precioConRespaldo, resolverPrecioEquipo, resolverPrecioMaterial } from "@/lib/resolverPrecioInsumo";
import { requerirRubro, requerirSuperadmin } from "@/lib/sesion";
import { hoyUruguayISO } from "@/lib/fechaUruguay";

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

// Copia un rubro del proyecto (con su APU) a la biblioteca global
// (SubrubroEstandar + APUEstandar) — solo SUPERADMIN: la biblioteca es
// compartida por todas las empresas.
//
// La biblioteca resuelve los precios en vivo al clonar (materiales contra
// PrecioMTOP y equipos contra PrecioEquipo, por texto; mano de obra contra
// CategoriaLaboral, por nombre exacto). Para que ninguna línea clone en $0,
// cada una se simula acá con esa misma resolución:
//  - Si resuelve contra el catálogo, se guarda sin precio (sigue al catálogo).
//    Un material vinculado (precioMTOPId) se guarda con la descripción EXACTA
//    de su PrecioMTOP, para que el clon lo resuelva a esa misma fila.
//  - Si no resuelve, se guarda con su precio del APU como respaldo fijo
//    (precioReferencia / costoReferencia / jornalReferencia — ver
//    precioConRespaldo): ese precio NO se actualiza con el catálogo. Esas
//    líneas se listan en notasInternas y en la respuesta, para revisarlas.
//
// No se copia: Aportes Patronales (los pone el proyecto destino), componentes
// de materiales compuestos (MaterialAPUEstandar no los modela) ni el modo de
// costeo de equipos (el clon arranca en ALQUILADO; el respaldo guarda el
// costo efectivo que tenía la línea).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const superadmin = await requerirSuperadmin();
  if (superadmin instanceof NextResponse) return superadmin;

  try {
    const { id: rubroId } = await params;
    const acceso = await requerirRubro(rubroId);
    if (acceso instanceof NextResponse) return acceso;

    const rubro = await db.rubro.findUnique({
      where: { id: rubroId },
      select: {
        codigo: true,
        descripcion: true,
        unidad: true,
        capitulo: { select: { nombre: true, capituloCatalogoId: true, proyecto: { select: { nombre: true } } } },
        apu: {
          include: {
            materiales: { orderBy: { orden: "asc" } },
            manoObra: { orderBy: { orden: "asc" } },
            equipos: { orderBy: { orden: "asc" } },
          },
        },
      },
    });
    if (!rubro) return NextResponse.json({ error: "Rubro no encontrado" }, { status: 404 });

    const descripcion = rubro.descripcion.trim();
    const unidad = rubro.unidad.trim();
    if (!descripcion || !unidad) {
      return NextResponse.json({ error: "sin_datos", mensaje: "El rubro necesita descripción y unidad para guardarse en la biblioteca." }, { status: 400 });
    }
    const apu = rubro.apu;
    if (!apu || apu.materiales.length + apu.manoObra.length + apu.equipos.length === 0) {
      return NextResponse.json({ error: "sin_apu", mensaje: "El rubro no tiene descompuesto (APU) — no hay nada que guardar en la biblioteca." }, { status: 400 });
    }

    // Ya está en la biblioteca: misma descripción y unidad, mismo capítulo.
    const capituloId = rubro.capitulo.capituloCatalogoId;
    const candidatos = await db.subrubroEstandar.findMany({
      where: { activo: true, capituloId, unidad: { equals: unidad, mode: "insensitive" } },
      select: { id: true, codigo: true, descripcion: true },
    });
    const existente = candidatos.find((s) => normalizar(s.descripcion) === normalizar(descripcion));
    if (existente) {
      return NextResponse.json({ error: "ya_existe", mensaje: `Ya está en la biblioteca (${existente.codigo}).`, id: existente.id }, { status: 409 });
    }

    // Simulación de clonarApuAlRubro, línea por línea.
    const materialesSinVinculo: string[] = [];
    const equiposSinVinculo: string[] = [];
    const manoObraSinVinculo: string[] = [];

    const materiales = await Promise.all(
      apu.materiales.map(async (m) => {
        const vinculado = m.precioMTOPId
          ? await db.precioMTOP.findUnique({ where: { id: m.precioMTOPId }, select: { id: true, descripcion: true } })
          : null;
        const descripcionBiblioteca = vinculado?.descripcion ?? m.descripcion;
        const resuelto = await resolverPrecioMaterial(descripcionBiblioteca);
        // Sigue al catálogo solo si resuelve con precio, y —si estaba
        // vinculado— a la MISMA fila (si no, el clon tomaría otro material).
        const sigueCatalogo = !!resuelto && resuelto.precioUnitario > 0 && (!vinculado || resuelto.id === vinculado.id);
        if (!sigueCatalogo) materialesSinVinculo.push(m.descripcion);
        const precioReferencia = sigueCatalogo ? null : redondearPrecio(m.precioUnit);
        return {
          descripcion: sigueCatalogo ? descripcionBiblioteca : m.descripcion,
          unidad: m.unidad,
          rendimiento: m.rendimiento,
          precioReferencia,
          precioUnit: sigueCatalogo ? resuelto!.precioUnitario : precioConRespaldo(null, precioReferencia).precio,
        };
      })
    );
    const equipos = await Promise.all(
      apu.equipos.map(async (eq) => {
        const resuelto = await resolverPrecioEquipo(eq.descripcion);
        const sigueCatalogo = !!resuelto && resuelto.precioHora > 0;
        if (!sigueCatalogo) equiposSinVinculo.push(eq.descripcion);
        const costoReferencia = sigueCatalogo ? null : redondearPrecio(costoUnitEfectivo(eq));
        return {
          id: eq.id,
          descripcion: eq.descripcion,
          unidad: eq.unidad,
          rendimiento: eq.rendimiento,
          costoReferencia,
          costoUnit: sigueCatalogo ? resuelto!.precioHora : precioConRespaldo(null, costoReferencia).precio,
        };
      })
    );
    const categorias = await db.categoriaLaboral.findMany({ select: { nombre: true, jornal: true } });
    const manoObra = apu.manoObra.map((mo) => {
      const jornal = categorias.find((c) => normalizar(c.nombre) === normalizar(mo.categoria))?.jornal ?? 0;
      const sigueCatalogo = jornal > 0;
      if (!sigueCatalogo) manoObraSinVinculo.push(mo.categoria);
      const jornalReferencia = sigueCatalogo ? null : redondearPrecio(mo.jornalRef);
      return {
        categoria: mo.categoria,
        jornadaHs: mo.jornadaHs,
        rendimiento: mo.rendimiento,
        jornalReferencia,
        jornalRef: sigueCatalogo ? jornal : precioConRespaldo(null, jornalReferencia).precio,
        equipoRelacionadoId: mo.equipoRelacionadoId,
      };
    });

    // Precio de referencia = lo que va a dar clonar este subrubro hoy.
    const precioUY =
      Math.round(
        calcularPrecioUnitario(
          costoDirectoUnitario({ materiales, manoObra, equipos, aportesPatronalesPct: apu.aportesPatronalesPct, utilidadPct: apu.utilidadPct }),
          apu.utilidadPct
        ) * 100
      ) / 100;

    const hoy = hoyUruguayISO(); // "aaaa-mm-dd" en hora de Uruguay
    // Marca para revisar desde la base (o una pantalla futura): una línea
    // "clave: [JSON]" por cada tipo de insumo con precio fijo.
    const marcas = [
      ["materiales_sin_vinculo", materialesSinVinculo],
      ["equipos_sin_vinculo", equiposSinVinculo],
      ["mano_obra_sin_vinculo", manoObraSinVinculo],
    ]
      .filter(([, lista]) => lista.length > 0)
      .map(([clave, lista]) => `${clave}: ${JSON.stringify(lista)}`);
    const notasInternas = [
      `Copiado del rubro ${rubro.codigo} "${descripcion}" (capítulo "${rubro.capitulo.nombre}", proyecto "${rubro.capitulo.proyecto.nombre}") el ${hoy.slice(0, 10)}.`,
      ...marcas,
    ].join("\n");

    const subrubro = await db.$transaction(async (tx) => {
      const creado = await tx.subrubroEstandar.create({
        data: {
          codigo: `manual-${randomUUID()}`,
          descripcion,
          unidad,
          precioUY,
          fechaBase: hoy.slice(0, 7),
          origen: "manual",
          capituloId,
          notasInternas,
        },
      });
      const apuEstandar = await tx.aPUEstandar.create({
        data: { subrubroId: creado.id, gastosGeneralesPct: 0, utilidadPct: apu.utilidadPct, porcentajePiedra: apu.porcentajePiedra },
      });
      // ids generados acá para mapear mano de obra → equipo (createMany no devuelve ids).
      const equipoIdMap = new Map<string, string>();
      const equiposData = equipos.map((eq) => {
        const id = randomUUID();
        equipoIdMap.set(eq.id, id);
        return { id, apuId: apuEstandar.id, descripcion: eq.descripcion, unidad: eq.unidad, rendimiento: eq.rendimiento, costoReferencia: eq.costoReferencia };
      });
      if (materiales.length > 0) {
        await tx.materialAPUEstandar.createMany({
          data: materiales.map((m) => ({ apuId: apuEstandar.id, descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento, precioReferencia: m.precioReferencia })),
        });
      }
      if (equiposData.length > 0) await tx.equipoAPUEstandar.createMany({ data: equiposData });
      if (manoObra.length > 0) {
        await tx.manoObraAPUEstandar.createMany({
          data: manoObra.map((mo) => ({
            apuId: apuEstandar.id,
            categoria: mo.categoria,
            jornadaHs: mo.jornadaHs,
            rendimiento: mo.rendimiento,
            jornalReferencia: mo.jornalReferencia,
            equipoRelacionadoId: mo.equipoRelacionadoId ? equipoIdMap.get(mo.equipoRelacionadoId) ?? null : null,
          })),
        });
      }
      return creado;
    });

    return NextResponse.json(
      { id: subrubro.id, codigo: subrubro.codigo, precioUY, materialesSinVinculo, equiposSinVinculo, manoObraSinVinculo },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/rubros/[id]/guardar-en-biblioteca]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
