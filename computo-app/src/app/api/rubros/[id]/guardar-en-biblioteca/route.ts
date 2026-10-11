import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularPrecioUnitario } from "@/lib/apu-calc";
import { costoDirectoUnitario } from "@/lib/costoAgregado";
import { resolverPrecioEquipo, resolverPrecioMaterial } from "@/lib/resolverPrecioInsumo";
import { requerirRubro, requerirSuperadmin } from "@/lib/sesion";

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

interface InsumoSinPrecio {
  tipo: "material" | "equipo" | "mano_obra";
  descripcion: string;
  motivo: string;
}

// Copia un rubro del proyecto (con su APU) a la biblioteca global
// (SubrubroEstandar + APUEstandar) — solo SUPERADMIN: la biblioteca es
// compartida por todas las empresas.
//
// La biblioteca NO guarda precios: clonarApuAlRubro() los resuelve en vivo
// al clonar (materiales contra PrecioMTOP y equipos contra PrecioEquipo, por
// texto; mano de obra contra CategoriaLaboral, por nombre exacto). Por eso,
// antes de escribir nada, se simula esa misma resolución línea por línea: si
// algún insumo quedaría en $0 al clonar, no se guarda y se devuelve la lista
// (mismo problema que la Fase 2 del bug "clona a $0" de la biblioteca). Un
// material vinculado a PrecioMTOP (precioMTOPId) se guarda con la descripción
// EXACTA de esa fila, para que el matching por texto del clon lo resuelva a
// la misma fila y no a otra parecida.
//
// No se copia: precios/costos (se resuelven al clonar), Aportes Patronales
// (los pone el proyecto destino), componentes de materiales compuestos
// (MaterialAPUEstandar no los modela) ni el modo de costeo de equipos (el
// clon arranca en ALQUILADO, como cualquier subrubro de biblioteca).
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

    // Simulación de clonarApuAlRubro: qué precio va a tomar cada línea.
    const problemas: InsumoSinPrecio[] = [];
    const materiales = await Promise.all(
      apu.materiales.map(async (m) => {
        const vinculado = m.precioMTOPId
          ? await db.precioMTOP.findUnique({ where: { id: m.precioMTOPId }, select: { id: true, descripcion: true } })
          : null;
        const descripcionBiblioteca = vinculado?.descripcion ?? m.descripcion;
        const resuelto = await resolverPrecioMaterial(descripcionBiblioteca);
        if (!resuelto || resuelto.precioUnitario <= 0) {
          problemas.push({ tipo: "material", descripcion: m.descripcion, motivo: resuelto ? "su precio de referencia es $0" : "no coincide con ningún material del catálogo" });
        } else if (vinculado && resuelto.id !== vinculado.id) {
          problemas.push({ tipo: "material", descripcion: m.descripcion, motivo: `al clonar resolvería a otro material del catálogo ("${resuelto.descripcion}")` });
        }
        return { descripcion: descripcionBiblioteca, unidad: m.unidad, rendimiento: m.rendimiento, precioUnit: resuelto?.precioUnitario ?? 0 };
      })
    );
    const equipos = await Promise.all(
      apu.equipos.map(async (eq) => {
        const resuelto = await resolverPrecioEquipo(eq.descripcion);
        if (!resuelto || resuelto.precioHora <= 0) {
          problemas.push({ tipo: "equipo", descripcion: eq.descripcion, motivo: "no coincide con ningún equipo del catálogo" });
        }
        return { id: eq.id, descripcion: eq.descripcion, unidad: eq.unidad, rendimiento: eq.rendimiento, costoUnit: resuelto?.precioHora ?? 0 };
      })
    );
    const categorias = await db.categoriaLaboral.findMany({ select: { nombre: true, jornal: true } });
    const manoObra = apu.manoObra.map((mo) => {
      const jornal = categorias.find((c) => normalizar(c.nombre) === normalizar(mo.categoria))?.jornal ?? 0;
      if (jornal <= 0) {
        problemas.push({ tipo: "mano_obra", descripcion: mo.categoria, motivo: "no es una categoría laboral del convenio cargada" });
      }
      return { categoria: mo.categoria, jornadaHs: mo.jornadaHs, rendimiento: mo.rendimiento, jornalRef: jornal, equipoRelacionadoId: mo.equipoRelacionadoId };
    });

    if (problemas.length > 0) {
      return NextResponse.json(
        {
          error: "insumos_sin_precio",
          mensaje: "Hay insumos que al clonar desde la biblioteca quedarían en $0. Corregilos en el descompuesto (o cargalos en el catálogo) y volvé a intentar.",
          problemas,
        },
        { status: 422 }
      );
    }

    // Precio de referencia = lo que va a dar clonar este subrubro hoy.
    const precioUY =
      Math.round(
        calcularPrecioUnitario(
          costoDirectoUnitario({ materiales, manoObra, equipos, aportesPatronalesPct: apu.aportesPatronalesPct, utilidadPct: apu.utilidadPct }),
          apu.utilidadPct
        ) * 100
      ) / 100;

    const hoy = new Date().toISOString();
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
          notasInternas: `Copiado del rubro ${rubro.codigo} "${descripcion}" (capítulo "${rubro.capitulo.nombre}", proyecto "${rubro.capitulo.proyecto.nombre}") el ${hoy.slice(0, 10)}.`,
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
        return { id, apuId: apuEstandar.id, descripcion: eq.descripcion, unidad: eq.unidad, rendimiento: eq.rendimiento };
      });
      if (materiales.length > 0) {
        await tx.materialAPUEstandar.createMany({
          data: materiales.map((m) => ({ apuId: apuEstandar.id, descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento })),
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
            equipoRelacionadoId: mo.equipoRelacionadoId ? equipoIdMap.get(mo.equipoRelacionadoId) ?? null : null,
          })),
        });
      }
      return creado;
    });

    return NextResponse.json({ id: subrubro.id, codigo: subrubro.codigo, precioUY }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/rubros/[id]/guardar-en-biblioteca]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
