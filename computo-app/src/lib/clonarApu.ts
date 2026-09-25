import { db } from "@/lib/db";
import { calcularPrecioUnitario, sumarAportesPatronalesPct } from "@/lib/apu-calc";
import { costoDirectoUnitario } from "@/lib/costoAgregado";

// Mismo guard que PUT /api/rubros/[id]/apu y
// /api/rubros/[id]/actualizar-precio-vigente — un presupuesto FINALIZADO
// es de solo lectura hasta "Habilitar edición". Se tira acá adentro (no
// en cada endpoint que llama a clonarApuAlRubro) para proteger ambos
// llamadores — POST /api/subrubros-estandar/[id]/clonar-apu y
// generarRubrosAutomaticos()/rubrosAutomaticos.ts — con un solo chequeo.
export class ProyectoFinalizadoError extends Error {
  constructor() {
    super(
      "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo."
    );
    this.name = "ProyectoFinalizadoError";
  }
}

/* Clona el APUEstandar de un subrubro de biblioteca al APU real de un rubro
   ya existente — misma lógica que usaba únicamente
   /api/subrubros-estandar/[id]/clonar-apu (extraída acá para que
   rubrosAutomaticos.ts la use directo, sin un fetch interno del servidor
   a sí mismo). Requiere que `rubroId` ya exista; no crea el Rubro. */
export async function clonarApuAlRubro(subrubroId: string, rubroId: string) {
  const rubroConEstado = await db.rubro.findUnique({
    where: { id: rubroId },
    select: { capitulo: { select: { proyecto: { select: { estado: true } } } } },
  });
  if (rubroConEstado?.capitulo.proyecto.estado === "FINALIZADO") {
    throw new ProyectoFinalizadoError();
  }

  const apuEstandar = await db.aPUEstandar.findUnique({
    where: { subrubroId },
    include: { materiales: true, manoObra: true, equipos: true },
  });

  if (!apuEstandar) {
    throw new Error(`El subrubro ${subrubroId} no tiene APU estándar`);
  }

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find(
      (c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
    )?.jornal ?? 0;

  const apuExistente = await db.aPU.findUnique({ where: { rubroId } });

  let aportesPatronalesPct = apuExistente?.aportesPatronalesPct;
  if (aportesPatronalesPct == null) {
    const rubroConProyecto = await db.rubro.findUnique({
      where: { id: rubroId },
      select: {
        capitulo: {
          select: {
            proyecto: {
              select: {
                leyesSociales: {
                  select: {
                    focerPatronalPct: true, fscFocapPct: true, fosvocPct: true,
                    frlPct: true, fondoGarantiaPct: true, snisAdicionalPct: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    aportesPatronalesPct = sumarAportesPatronalesPct(rubroConProyecto?.capitulo?.proyecto?.leyesSociales);
  }

  const apu = apuExistente
    ? await db.aPU.update({
        where: { rubroId },
        data: {
          gastosGeneralesPct: 0,
          utilidadPct: apuEstandar.utilidadPct,
          aportesPatronalesPct,
          porcentajePiedra: apuEstandar.porcentajePiedra,
        },
      })
    : await db.aPU.create({
        data: {
          rubroId,
          gastosGeneralesPct: 0,
          utilidadPct: apuEstandar.utilidadPct,
          aportesPatronalesPct,
          porcentajePiedra: apuEstandar.porcentajePiedra,
        },
      });

  const apuId = apu.id;

  await db.materialAPU.deleteMany({ where: { apuId } });
  await db.manoObraAPU.deleteMany({ where: { apuId } });
  await db.equipoAPU.deleteMany({ where: { apuId } });

  for (let i = 0; i < apuEstandar.materiales.length; i++) {
    const m = apuEstandar.materiales[i];
    const precioMTOP = await db.precioMTOP.findFirst({
      where: { descripcion: { contains: m.descripcion, mode: "insensitive" } },
      orderBy: { id: "asc" },
    });
    const precioUnit = precioMTOP?.precioUnitario ?? 0;

    await db.materialAPU.create({
      data: {
        apuId,
        descripcion: m.descripcion,
        unidad: m.unidad,
        rendimiento: m.rendimiento,
        precioUnit,
        orden: i,
        motivoVerificacion: precioMTOP?.motivoVerificacion ?? null,
        proveedor: precioMTOP?.proveedor ?? null,
        notaProcedencia: precioMTOP?.notaProcedencia ?? null,
        fechaUltimaVerificacion: precioMTOP?.fechaUltimaVerificacion ?? null,
        precioMTOPId: precioMTOP?.id ?? null,
      },
    });
  }

  const equipoIdMap = new Map<string, string>();
  for (let i = 0; i < apuEstandar.equipos.length; i++) {
    const eq = apuEstandar.equipos[i];
    const precioEquipo = await db.precioEquipo.findFirst({
      where: { descripcion: { contains: eq.descripcion, mode: "insensitive" } },
    });
    const costoUnit = precioEquipo?.precioHora ?? 0;

    const creado = await db.equipoAPU.create({
      data: {
        apuId,
        descripcion: eq.descripcion,
        unidad: eq.unidad,
        rendimiento: eq.rendimiento,
        costoUnit,
        orden: i,
        motivoVerificacion: precioEquipo ? null : "sin_costo_referencia",
      },
    });
    equipoIdMap.set(eq.id, creado.id);
  }

  for (let i = 0; i < apuEstandar.manoObra.length; i++) {
    const mo = apuEstandar.manoObra[i];
    await db.manoObraAPU.create({
      data: {
        apuId,
        categoria: mo.categoria,
        jornadaHs: mo.jornadaHs,
        rendimiento: mo.rendimiento,
        jornalRef: jornalPorNombre(mo.categoria),
        orden: i,
        equipoRelacionadoId: mo.equipoRelacionadoId
          ? equipoIdMap.get(mo.equipoRelacionadoId) ?? null
          : null,
      },
    });
  }

  const apuCompleto = await db.aPU.findUnique({
    where: { id: apuId },
    include: { materiales: true, manoObra: true, equipos: true },
  });

  // Fórmula canónica única — ver costoDirectoUnitario en lib/costoAgregado.ts.
  const costoDirecto = costoDirectoUnitario(apuCompleto!);
  const precioUnit = calcularPrecioUnitario(costoDirecto, apuCompleto!.utilidadPct);

  const rubro = await db.rubro.update({
    where: { id: rubroId },
    data: { precioUnit },
  });

  // costoDirecto (sin Utilidad%) se devuelve además de precioUnit (con
  // Utilidad% ya aplicada) porque rubrosAutomaticos.ts necesita despejar
  // cantidad contra el costo directo puro — ver comentario en ese archivo.
  return { apu: apuCompleto, rubro, costoDirecto };
}
