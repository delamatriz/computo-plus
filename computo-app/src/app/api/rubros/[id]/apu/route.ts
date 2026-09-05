import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sumarAportesPatronalesPct } from "@/lib/apu-calc";

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
    const body = await req.json();

    // eslint-disable-next-line prefer-const
    let { utilidadPct, aportesPatronalesPct } = body;
    const { porcentajePiedra = 0.30, materiales = [], manoObra = [], equipos = [] } = body;

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
                        frlPct: true, fondoGarantiaPct: true, snisAdicionalPct: true,
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
            data: { gastosGeneralesPct: 0, utilidadPct, aportesPatronalesPct, porcentajePiedra },
          })
        : await tx.aPU.create({
            data: { rubroId, gastosGeneralesPct: 0, utilidadPct, aportesPatronalesPct, porcentajePiedra },
          });

      const apuId = apu.id;

      // Recrear materiales + componentes
      await tx.materialAPU.deleteMany({ where: { apuId } });
      for (let i = 0; i < materiales.length; i++) {
        const m = materiales[i];
        const mat = await tx.materialAPU.create({
          data: {
            apuId,
            descripcion:  m.descripcion  ?? "",
            unidad:       m.unidad       ?? "",
            rendimiento:  m.rendimiento  ?? 0,
            precioUnit:   m.precioUnit   ?? 0,
            dosificacion: m.dosificacion ?? null,
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
          },
        });
        if (Array.isArray(m.componentes)) {
          for (let j = 0; j < m.componentes.length; j++) {
            const c = m.componentes[j];
            await tx.componenteAPU.create({
              data: {
                materialId:           mat.id,
                descripcion:          c.descripcion          ?? "",
                unidad:               c.unidad               ?? "",
                rendimientoPorUnidad: c.rendimientoPorUnidad ?? 0,
                precioUnit:           c.precioUnit           ?? 0,
                orden:                j,
              },
            });
          }
        }
      }

      // Recrear mano de obra y equipos — se borran ambos primero (mano de obra
      // antes que equipos, por la FK equipoRelacionadoId) y se recrean en el
      // orden inverso: equipos primero, para poder mapear el id de equipo que
      // el front manda (que puede ser temporal) al id real recién creado, y
      // así resolver equipoRelacionadoId de cada línea de mano de obra.
      await tx.manoObraAPU.deleteMany({ where: { apuId } });
      await tx.equipoAPU.deleteMany({ where: { apuId } });

      const equipoIdMap = new Map<string, string>();
      for (let i = 0; i < equipos.length; i++) {
        const eq = equipos[i];
        const creado = await tx.equipoAPU.create({
          data: {
            apuId,
            descripcion:     eq.descripcion     ?? "",
            unidad:          eq.unidad          ?? "",
            rendimiento:     eq.rendimiento     ?? 0,
            costoUnit:       eq.costoUnit       ?? 0,
            modoCosteo:      eq.modoCosteo      ?? "ALQUILADO",
            costoUnitPropio: eq.costoUnitPropio ?? null,
            orden:           i,
            motivoVerificacion: eq.motivoVerificacion ?? null,
          },
        });
        if (eq.id) equipoIdMap.set(eq.id, creado.id);
      }

      for (let i = 0; i < manoObra.length; i++) {
        const mo = manoObra[i];
        await tx.manoObraAPU.create({
          data: {
            apuId,
            categoria:   mo.categoria   ?? "",
            jornadaHs:   mo.jornadaHs   ?? 8,
            rendimiento: mo.rendimiento ?? 1,
            jornalRef:   mo.jornalRef   ?? 0,
            orden:       i,
            equipoRelacionadoId: mo.equipoRelacionadoId
              ? equipoIdMap.get(mo.equipoRelacionadoId) ?? null
              : null,
          },
        });
      }

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
    });

    return NextResponse.json(apuCompleto);
  } catch (err) {
    console.error("[PUT /api/rubros/[id]/apu]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rubroId } = await params;
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
