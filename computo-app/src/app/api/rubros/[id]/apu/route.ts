import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redondearPrecio, sumarAportesPatronalesPct } from "@/lib/apu-calc";
import { requerirRubro } from "@/lib/sesion";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

// Mismo guard que el resto de las escrituras de rubro/capítulo/título (ver
// api/rubros/[id]/route.ts) — presupuesto entregado es de solo lectura
// hasta "Habilitar edición". Era el único endpoint de mutación de rubro sin
// este chequeo: se podía seguir editando materiales/mano de obra/equipos de
// un proyecto ya FINALIZADO. Se chequea ANTES de abrir la transacción con
// el lock (ver más abajo) — si total va a rechazar el request, no tiene
// sentido tomar el SELECT ... FOR UPDATE primero.
async function proyectoFinalizado(rubroId: string): Promise<boolean> {
  const rubro = await db.rubro.findUnique({
    where: { id: rubroId },
    select: { capitulo: { select: { proyecto: { select: { estado: true } } } } },
  });
  return rubro?.capitulo.proyecto.estado === "FINALIZADO";
}

// Forma de cada línea que manda el front (DrawerAPU) en el PUT. Todo
// opcional: los defaults se resuelven al armar las filas.
interface ComponenteEntrada {
  descripcion?: string;
  unidad?: string;
  rendimientoPorUnidad?: number;
  precioUnit?: number;
}
interface MaterialEntrada {
  descripcion?: string;
  unidad?: string;
  rendimiento?: number;
  precioUnit?: number;
  motivoVerificacion?: string | null;
  proveedor?: string | null;
  notaProcedencia?: string | null;
  fechaUltimaVerificacion?: string | null;
  precioMTOPId?: string | null;
  componentes?: ComponenteEntrada[];
}
interface EquipoEntrada {
  id?: string;
  descripcion?: string;
  unidad?: string;
  rendimiento?: number;
  costoUnit?: number;
  modoCosteo?: string;
  costoUnitPropio?: number | null;
  motivoVerificacion?: string | null;
}
interface ManoObraEntrada {
  categoria?: string;
  jornadaHs?: number;
  rendimiento?: number;
  jornalRef?: number;
  equipoRelacionadoId?: string | null;
}

// PUT — reemplaza el APU completo del rubro (upsert + recrear hijos)
//
// Envuelto en una transacción con lock explícito (ver el SELECT ... FOR
// UPDATE justo abajo) — antes, cada operación (deleteMany + N creates) era
// un round-trip suelto a la DB, sin ninguna protección contra dos PUT
// concurrentes para el mismo rubro (ej. el guardado debounced de
// guardarApuActual() superpuesto con el disparo inmediato de
// aplicarPrecioAPU() al clickear "Aplicar al rubro"). Sin lock, ambos
// requests podían borrar y recrear sin verse, dejando materiales/mano de
// obra/equipos duplicados (incidente real: 2 filas de más en HOGAR DE
// ANCIANOS → Vigas y carreras). Un $transaction "pelado" (sin el SELECT
// FOR UPDATE) NO alcanza para evitarlo: el mecanismo de Postgres que
// re-chequea filas en conflicto (EvalPlanQual) solo revisa las filas que
// el DELETE ya tenía en la mira al bloquearse, no vuelve a escanear la
// tabla buscando filas nuevas insertadas por la otra transacción mientras
// esperaba — de ahí el lock explícito sobre la fila de Rubro (no sobre
// APU/MaterialAPU, que se borran y recrean acá adentro): al ser la fila
// que SIEMPRE existe para un rubro real, un segundo PUT que llegue
// mientras el primero está en curso queda bloqueado en este SELECT hasta
// que el primero haga commit completo, y recién ahí vuelve a evaluar el
// estado ya actualizado — sin ventana para duplicar.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rubroId } = await params;
    const acceso = await requerirRubro(rubroId);
    if (acceso instanceof NextResponse) return acceso;

    if (await proyectoFinalizado(rubroId)) {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    const body = await req.json();

    // eslint-disable-next-line prefer-const
    let { utilidadPct, aportesPatronalesPct } = body;
    const { porcentajePiedra = 0.30, dosificacion = null, utilidadFija = false } = body;
    const materiales: MaterialEntrada[] = Array.isArray(body.materiales) ? body.materiales : [];
    const manoObra: ManoObraEntrada[] = Array.isArray(body.manoObra) ? body.manoObra : [];
    const equipos: EquipoEntrada[] = Array.isArray(body.equipos) ? body.equipos : [];

    const apuCompleto = await db.$transaction(async (tx) => {
      // Lock explícito — ver comentario de la función. Se ignora el
      // resultado, es puramente para tomar el lock; si el rubro no existe
      // no bloquea nada y el resto sigue igual que antes (falla más abajo
      // con el mismo error que ya daba, ej. FK inválida al crear el APU).
      await tx.$queryRaw`SELECT id FROM "Rubro" WHERE id = ${rubroId} FOR UPDATE`;

      // El cliente (DrawerAPU) siempre manda un valor explícito — este
      // fallback solo entra en juego si el body no los trae. Usa el default
      // del proyecto en vez de 10/10,2 fijo (ver Proyecto.utilidadPctDefault
      // y LeyesSociales del proyecto). gastosGeneralesPct ya NO se lee del
      // body ni tiene fallback — Gastos Generales dejó de prorratearse por
      // rubro, es un monto agregado a nivel proyecto (ver costoAgregado.ts);
      // el campo se fuerza a 0 más abajo, campo inerte conservado en el
      // modelo por ahora.
      if (utilidadPct == null || aportesPatronalesPct == null) {
        const rubro = await tx.rubro.findUnique({
          where: { id: rubroId },
          select: {
            capitulo: {
              select: {
                proyecto: {
                  select: {
                    utilidadPctDefault: true,
                    leyesSociales: {
                      select: {
                        focerPatronalPct: true, fscFocapPct: true, fosvocPct: true,
                        frlPct: true, fondoGarantiaPct: true, 
                      },
                    },
                  },
                },
              },
            },
          },
        });
        const proyectoDefaults = rubro?.capitulo?.proyecto;
        if (utilidadPct == null) {
          utilidadPct = proyectoDefaults?.utilidadPctDefault ?? 10;
        }
        if (aportesPatronalesPct == null) {
          aportesPatronalesPct = sumarAportesPatronalesPct(proyectoDefaults?.leyesSociales);
        }
      }

      // Upsert APU
      const apuExistente = await tx.aPU.findUnique({ where: { rubroId } });

      const apu = apuExistente
        ? await tx.aPU.update({
            where: { rubroId },
            data: { gastosGeneralesPct: 0, utilidadPct, aportesPatronalesPct, porcentajePiedra, dosificacion, utilidadFija },
          })
        : await tx.aPU.create({
            data: { rubroId, gastosGeneralesPct: 0, utilidadPct, aportesPatronalesPct, porcentajePiedra, dosificacion, utilidadFija },
          });

      const apuId = apu.id;

      // Recrear materiales + componentes — en bloque (createMany), no una
      // consulta por línea: con N creates sueltos, un APU de 30+ líneas
      // pasaba el timeout de la transacción (P2028) y el autosave fallaba
      // sin que el usuario se enterara. createMany no devuelve ids, así que
      // se generan acá para poder colgar los componentes de su material.
      await tx.materialAPU.deleteMany({ where: { apuId } });
      const materialesData = materiales.map((m, i) => ({
        id: randomUUID(),
        apuId,
        descripcion:  m.descripcion  ?? "",
        unidad:       m.unidad       ?? "",
        rendimiento:  m.rendimiento  ?? 0,
        precioUnit:   redondearPrecio(m.precioUnit ?? 0),
        orden:        i,
        // Se recrea todo el APU en cada autosave — sin esto, el motivo
        // clonado de la biblioteca se perdía apenas el usuario tocaba
        // cualquier otro campo del APU (ver clonar-apu/route.ts). Mismo
        // criterio para proveedor/fechaUltimaVerificacion (ver BadgeVerificacion).
        motivoVerificacion: m.motivoVerificacion ?? null,
        proveedor: m.proveedor ?? null,
        notaProcedencia: m.notaProcedencia ?? null,
        fechaUltimaVerificacion: m.fechaUltimaVerificacion ? new Date(m.fechaUltimaVerificacion) : null,
        // Vínculo real con PrecioMTOP (ver agregarDesdeMTOP en
        // proyectos/[id]/page.tsx) — antes de este campo, ni codigoMTOP
        // ni precioMTOPOrig llegaban a persistirse acá, así que el
        // vínculo con el catálogo se perdía apenas se recreaba el APU.
        precioMTOPId: m.precioMTOPId ?? null,
      }));
      const componentesData = materiales.flatMap((m, i) =>
        Array.isArray(m.componentes)
          ? m.componentes.map((c, j) => ({
              materialId:           materialesData[i].id,
              descripcion:          c.descripcion          ?? "",
              unidad:               c.unidad               ?? "",
              rendimientoPorUnidad: c.rendimientoPorUnidad ?? 0,
              precioUnit:           redondearPrecio(c.precioUnit ?? 0),
              orden:                j,
            }))
          : []
      );
      if (materialesData.length > 0) await tx.materialAPU.createMany({ data: materialesData });
      if (componentesData.length > 0) await tx.componenteAPU.createMany({ data: componentesData });

      // Recrear mano de obra y equipos — se borran ambos primero (mano de obra
      // antes que equipos, por la FK equipoRelacionadoId) y se recrean en el
      // orden inverso: equipos primero, para poder mapear el id de equipo que
      // el front manda (que puede ser temporal) al id real recién creado, y
      // así resolver equipoRelacionadoId de cada línea de mano de obra.
      await tx.manoObraAPU.deleteMany({ where: { apuId } });
      await tx.equipoAPU.deleteMany({ where: { apuId } });

      // Mismo criterio en bloque: el id de cada equipo se genera acá y se
      // mapea desde el id que mandó el front (puede ser temporal).
      const equipoIdMap = new Map<string, string>();
      const equiposData = equipos.map((eq, i) => {
        const id = randomUUID();
        if (eq.id) equipoIdMap.set(eq.id, id);
        return {
          id,
          apuId,
          descripcion:     eq.descripcion     ?? "",
          unidad:          eq.unidad          ?? "",
          rendimiento:     eq.rendimiento     ?? 0,
          costoUnit:       redondearPrecio(eq.costoUnit ?? 0),
          modoCosteo:      eq.modoCosteo      ?? "ALQUILADO",
          costoUnitPropio: eq.costoUnitPropio == null ? null : redondearPrecio(eq.costoUnitPropio),
          orden:           i,
          motivoVerificacion: eq.motivoVerificacion ?? null,
        };
      });
      if (equiposData.length > 0) await tx.equipoAPU.createMany({ data: equiposData });

      const manoObraData = manoObra.map((mo, i) => ({
        apuId,
        categoria:   mo.categoria   ?? "",
        jornadaHs:   mo.jornadaHs   ?? 8,
        rendimiento: mo.rendimiento ?? 1,
        jornalRef:   mo.jornalRef   ?? 0,
        orden:       i,
        equipoRelacionadoId: mo.equipoRelacionadoId
          ? equipoIdMap.get(mo.equipoRelacionadoId) ?? null
          : null,
      }));
      if (manoObraData.length > 0) await tx.manoObraAPU.createMany({ data: manoObraData });

      // Devolver APU completo
      return tx.aPU.findUnique({
        where: { id: apuId },
        include: {
          materiales: {
            orderBy: { orden: "asc" },
            include: { componentes: { orderBy: { orden: "asc" } } },
          },
          manoObra: { orderBy: { orden: "asc" } },
          equipos:  { orderBy: { orden: "asc" } },
        },
      });
    }, {
      // Red de seguridad además del createMany: la base está en otra región
      // que el dev local, y el lock FOR UPDATE puede esperar a otro PUT.
      timeout: 15_000,
      maxWait: 10_000,
    });

    return NextResponse.json(apuCompleto);
  } catch (err) {
    console.error("[PUT /api/rubros/[id]/apu]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — toggle puntual de utilidadFija (candado de la Utilidad del
// rubro), sin tocar materiales/mano de obra/equipos ni recrear nada —
// a propósito más liviano que el PUT de arriba, que reemplaza el APU
// completo. Si el rubro todavía no tiene APU persistido (candado
// tocado antes de la primera "Aplicar al rubro"), se crea uno vacío con
// los mismos defaults de proyecto que ya usa el PUT, para no dejarlo en
// un estado inconsistente.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rubroId } = await params;
    const acceso = await requerirRubro(rubroId);
    if (acceso instanceof NextResponse) return acceso;

    if (await proyectoFinalizado(rubroId)) {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    const body = await req.json();
    const utilidadFija = body?.utilidadFija === true;

    const apuExistente = await db.aPU.findUnique({ where: { rubroId } });
    if (apuExistente) {
      const apu = await db.aPU.update({ where: { rubroId }, data: { utilidadFija } });
      return NextResponse.json(apu);
    }

    const rubro = await db.rubro.findUnique({
      where: { id: rubroId },
      select: {
        capitulo: {
          select: {
            proyecto: {
              select: {
                utilidadPctDefault: true,
                leyesSociales: {
                  select: {
                    focerPatronalPct: true, fscFocapPct: true, fosvocPct: true,
                    frlPct: true, fondoGarantiaPct: true, 
                  },
                },
              },
            },
          },
        },
      },
    });
    const proyectoDefaults = rubro?.capitulo?.proyecto;
    const utilidadPct = proyectoDefaults?.utilidadPctDefault ?? 10;
    const aportesPatronalesPct = sumarAportesPatronalesPct(proyectoDefaults?.leyesSociales);

    const apu = await db.aPU.create({
      data: { rubroId, gastosGeneralesPct: 0, utilidadPct, aportesPatronalesPct, utilidadFija },
    });
    return NextResponse.json(apu);
  } catch (err) {
    console.error("[PATCH /api/rubros/[id]/apu]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rubroId } = await params;
    const acceso = await requerirRubro(rubroId);
    if (acceso instanceof NextResponse) return acceso;
    const apu = await db.aPU.findUnique({
      where: { rubroId },
      include: {
        materiales: {
          orderBy: { orden: "asc" },
          include: { componentes: { orderBy: { orden: "asc" } } },
        },
        manoObra: { orderBy: { orden: "asc" } },
        equipos:  { orderBy: { orden: "asc" } },
      },
    });
    if (!apu) return NextResponse.json(null);
    return NextResponse.json(apu);
  } catch (err) {
    console.error("[GET /api/rubros/[id]/apu]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
