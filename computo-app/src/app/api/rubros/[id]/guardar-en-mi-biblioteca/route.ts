import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularPrecioUnitario, costoUnitEfectivo, montoAportesPatronales, redondearPrecio, sumEquipos, sumManoObra } from "@/lib/apu-calc";
import { requerirRubro } from "@/lib/sesion";

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

// Copia un rubro del proyecto (con su APU) a la biblioteca personal de la
// empresa del usuario (SubrubroEmpresa + APUEmpresa) — cualquier usuario
// autenticado; requerirRubro ya garantiza que el rubro sea de su empresa.
//
// A diferencia de la biblioteca global (guardar-en-biblioteca), acá cada
// línea se guarda con su precio fijo del APU del proyecto (snapshot): la
// biblioteca personal no resuelve precios en vivo contra el catálogo. Los
// campos *Referencia guardan el precio de catálogo del momento solo cuando
// la línea estaba vinculada (material con precioMTOPId, categoría que existe
// en CategoriaLaboral), para poder comparar más adelante.
//
// "Sin vínculo" = materiales sin precioMTOPId: se listan en notasInternas y
// en la respuesta (el botón queda ámbar con la lista).
//
// Se copian también utilidadPct y gastosGeneralesPct del APU, jornadaHs de
// cada línea de mano de obra (→ jornadasHoras) y el vínculo mano de obra →
// equipo (armado/desarme, equipoRelacionadoId → equipoId). No se copian los
// componentes de materiales compuestos — APUEmpresa no los modela.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rubroId } = await params;
    const acceso = await requerirRubro(rubroId);
    if (acceso instanceof NextResponse) return acceso;
    const { empresaId } = acceso;

    const rubro = await db.rubro.findUnique({
      where: { id: rubroId },
      select: {
        codigo: true,
        descripcion: true,
        unidad: true,
        capitulo: { select: { nombre: true, proyecto: { select: { nombre: true } } } },
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

    const nombre = rubro.descripcion.trim().replace(/\s+/g, " ");
    const unidad = rubro.unidad.trim();
    if (!nombre || !unidad) {
      return NextResponse.json({ error: "sin_datos", mensaje: "El rubro necesita descripción y unidad para guardarse en Mis rubros." }, { status: 400 });
    }
    const apu = rubro.apu;
    if (!apu || apu.materiales.length + apu.manoObra.length + apu.equipos.length === 0) {
      return NextResponse.json({ error: "sin_apu", mensaje: "El rubro no tiene descompuesto (APU) — no hay nada que guardar en Mis rubros." }, { status: 400 });
    }

    // Mismo nombre en la biblioteca de esta empresa (sin distinguir mayúsculas
    // ni espacios repetidos).
    const candidatos = await db.subrubroEmpresa.findMany({
      where: { empresaId },
      select: { id: true, nombre: true },
    });
    const existente = candidatos.find((s) => normalizar(s.nombre) === normalizar(nombre));
    if (existente) {
      return NextResponse.json({ error: "ya_existe", mensaje: "Ya está en Mis rubros.", id: existente.id }, { status: 409 });
    }

    const idsMTOP = apu.materiales.map((m) => m.precioMTOPId).filter((x): x is string => !!x);
    const [preciosMTOP, categorias] = await Promise.all([
      idsMTOP.length > 0
        ? db.precioMTOP.findMany({ where: { id: { in: idsMTOP } }, select: { id: true, precioUnitario: true } })
        : Promise.resolve([]),
      db.categoriaLaboral.findMany({ select: { nombre: true, jornal: true } }),
    ]);
    const precioMTOPPorId = new Map(preciosMTOP.map((p) => [p.id, p.precioUnitario]));

    const materialesSinVinculo = apu.materiales.filter((m) => !m.precioMTOPId).map((m) => m.descripcion);

    const materiales = apu.materiales.map((m) => {
      const precioUnit = redondearPrecio(m.precioUnit);
      const referencia = m.precioMTOPId ? precioMTOPPorId.get(m.precioMTOPId) : undefined;
      return {
        descripcion: m.descripcion,
        unidad: m.unidad,
        cantidad: m.rendimiento,
        precioUnit,
        precioTotal: redondearPrecio(m.rendimiento * precioUnit),
        precioMTOPId: m.precioMTOPId,
        precioReferencia: referencia != null ? redondearPrecio(referencia) : null,
      };
    });
    // ids generados acá para mapear mano de obra → equipo (equipoOrigenId →
    // nuevoEquipoId); los equipos se crean antes que la mano de obra.
    const equipoIdMap = new Map<string, string>();
    const equipos = apu.equipos.map((eq) => {
      const costoUnit = redondearPrecio(costoUnitEfectivo(eq));
      const id = randomUUID();
      equipoIdMap.set(eq.id, id);
      return {
        id,
        descripcion: eq.descripcion,
        unidad: eq.unidad,
        cantidad: eq.rendimiento,
        costoUnit,
        costoTotal: redondearPrecio(eq.rendimiento * costoUnit),
        costoReferencia: null,
      };
    });
    const manoObra = apu.manoObra.map((mo) => {
      const jornal = redondearPrecio(mo.jornalRef);
      const porUnidad = jornal / mo.rendimiento;
      const jornalCatalogo = categorias.find((c) => normalizar(c.nombre) === normalizar(mo.categoria))?.jornal;
      return {
        descripcion: mo.categoria,
        categoria: mo.categoria,
        cantidad: mo.rendimiento,
        jornal,
        costoTotal: redondearPrecio(Number.isFinite(porUnidad) ? porUnidad : 0),
        aportesPatronalesPct: apu.aportesPatronalesPct,
        jornalReferencia: jornalCatalogo != null ? redondearPrecio(jornalCatalogo) : null,
        jornadasHoras: mo.jornadaHs,
        equipoId: mo.equipoRelacionadoId ? equipoIdMap.get(mo.equipoRelacionadoId) ?? null : null,
      };
    });

    // Mismos totales que el APU del proyecto (costoDirectoUnitario): la mano
    // de obra respeta las líneas de armado de equipos propios y suma Aportes
    // Patronales.
    const sumMat = apu.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
    const sumMO = sumManoObra(apu.manoObra, apu.equipos);
    const costoManoObra = sumMO + montoAportesPatronales(sumMO, apu.aportesPatronalesPct);
    const costoEquipos = sumEquipos(apu.equipos);
    const costoTotal = sumMat + costoManoObra + costoEquipos;
    const precioUY = redondearPrecio(calcularPrecioUnitario(costoTotal, apu.utilidadPct));

    const hoy = new Date().toISOString().slice(0, 10);
    const notasInternas = [
      `Copiado del rubro ${rubro.codigo} "${nombre}" (capítulo "${rubro.capitulo.nombre}", proyecto "${rubro.capitulo.proyecto.nombre}") el ${hoy}. Utilidad ${apu.utilidadPct}%.`,
      ...(materialesSinVinculo.length > 0 ? [`materiales_sin_vinculo: ${JSON.stringify(materialesSinVinculo)}`] : []),
    ].join("\n");

    const subrubro = await db.$transaction(async (tx) => {
      const creado = await tx.subrubroEmpresa.create({
        data: { empresaId, nombre, unidad, precioUY, origen: "proyecto", codigo: rubro.codigo || null, notasInternas },
        select: { id: true },
      });
      const apuEmpresa = await tx.aPUEmpresa.create({
        data: {
          subrubroId: creado.id,
          empresaId,
          costoMateriales: redondearPrecio(sumMat),
          costoEquipos: redondearPrecio(costoEquipos),
          costoManoObra: redondearPrecio(costoManoObra),
          costoTotal: redondearPrecio(costoTotal),
          gastosGeneralesPct: apu.gastosGeneralesPct,
          utilidadPct: apu.utilidadPct,
        },
        select: { id: true },
      });
      const apuId = apuEmpresa.id;
      if (materiales.length > 0) await tx.materialAPUEmpresa.createMany({ data: materiales.map((m) => ({ ...m, apuId })) });
      if (equipos.length > 0) await tx.equipoAPUEmpresa.createMany({ data: equipos.map((eq) => ({ ...eq, apuId })) });
      if (manoObra.length > 0) await tx.manoObraAPUEmpresa.createMany({ data: manoObra.map((mo) => ({ ...mo, apuId })) });
      return creado;
    });

    return NextResponse.json({ id: subrubro.id, precioUY, materialesSinVinculo }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/rubros/[id]/guardar-en-mi-biblioteca]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
