import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rubroCompatibleConFila } from "@/components/metrajes/metrajeFila";
import { unidadPorDimensiones, contarCargados, calcularDesvinculacion } from "@/lib/recalculoUnidadFila";
import { requerirProyecto } from "@/lib/sesion";

const CAMPOS_NUMERICOS = ["largo", "ancho", "alto", "cantidad"] as const;

// PATCH — actualiza una o varias columnas de una fila (edición inline
// desde la Planilla). Si el patch toca rubroId o unidad, valida que la
// unidad de la fila coincida con la del Rubro antes de guardar — no se
// puede vincular una fila a un Rubro de unidad distinta (m² vs m³, etc).
// Si la fila todavía no tenía unidad propia, se autocompleta con la del
// Rubro en el mismo update (ver diseño confirmado — sección 4).
//
// Completar/borrar ANCHO y/o ALTO en una fila que viene de una medición
// (Línea o Área) promueve o degrada la unidad — ver bloque "ANCHO/ALTO
// derivan unidad" más abajo (unidadPorDimensiones, compartida con el
// DELETE de mediciones). El tipo de la medición de origen (LINEA/AREA)
// es la fuente de verdad para la unidad "base" de la que promover — no
// la unidad actual de la fila, que puede estar en null (fila recién
// creada, sin vincular todavía) o haber sido pisada a mano.
//
// medicionAnchoId — cuando el body lo trae (flujo de "medir ANCHO hacia
// una fila existente", ver ícono de regla en PlanillaComputo.tsx), si
// la fila ya tenía uno distinto, esa medición vieja se borra: no tiene
// que quedar como trazo huérfano en el plano sin ningún dato vigente
// detrás. Mismo criterio si ancho se vacía a mano (sin re-medir) y la
// fila tenía una medicionAnchoId — se limpia el vínculo Y se borra la
// medición vieja, no solo el número.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; filaId: string }> }
) {
  try {
    const { id, filaId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const fila = await db.filaMetraje.findUnique({
      where: { id: filaId },
      select: {
        id: true,
        unidad: true,
        rubroId: true,
        ancho: true,
        alto: true,
        medicionAnchoId: true,
        seccionId: true,
        seccion: { select: { rubroId: true } },
        medicion: { select: { tipo: true } },
        documento: { select: { proyectoId: true } },
      },
    });
    if (!fila || fila.documento.proyectoId !== id) {
      return NextResponse.json({ error: "Fila no encontrada" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if ("descripcion" in body) {
      // Puede llegar vacía mientras el usuario está editando el campo
      // (seleccionar todo + retipear pasa por un estado intermedio en
      // blanco) — no se rechaza, igual que el resto de los campos.
      if (typeof body.descripcion !== "string") {
        return NextResponse.json({ error: "descripcion tiene que ser string" }, { status: 400 });
      }
      data.descripcion = body.descripcion;
    }

    for (const campo of CAMPOS_NUMERICOS) {
      if (campo in body) {
        const v = body[campo];
        if (v !== null && (typeof v !== "number" || !isFinite(v))) {
          return NextResponse.json({ error: `${campo} tiene que ser number o null` }, { status: 400 });
        }
        data[campo] = v;
      }
    }

    // Unidad/rubro efectivos tras este patch (lo que viene en el body,
    // o si no viene, lo que la fila ya tenía guardado).
    let unidadEfectiva: string | null = "unidad" in body ? (body.unidad || null) : fila.unidad;
    let rubroIdEfectivo: string | null = "rubroId" in body ? (body.rubroId || null) : fila.rubroId;

    if ("unidad" in body) {
      if (body.unidad !== null && typeof body.unidad !== "string") {
        return NextResponse.json({ error: "unidad tiene que ser string o null" }, { status: 400 });
      }
      data.unidad = body.unidad || null;
    }
    if ("rubroId" in body) {
      if (body.rubroId !== null && typeof body.rubroId !== "string") {
        return NextResponse.json({ error: "rubroId tiene que ser string o null" }, { status: 400 });
      }
      data.rubroId = body.rubroId || null;
      // Desvincular a mano ("Sin vincular") limpia la unidad: si no, la fila
      // queda atada a la unidad del rubro anterior (la hereda al vincularse)
      // y ya no se puede vincular a un rubro de otra unidad. La próxima
      // vinculación vuelve a heredar la unidad del rubro nuevo. No aplica si
      // el mismo patch trae una unidad explícita, ni a la desvinculación
      // automática por cambio de unidad (más abajo), que fija la unidad nueva.
      if (!data.rubroId && fila.rubroId && !("unidad" in body)) {
        data.unidad = null;
        unidadEfectiva = null;
      }
    }
    // Mover la fila a otra sección de la Planilla (o a sueltas con null).
    // No toca el vínculo con el rubro ni la unidad.
    if ("seccionId" in body) {
      if (body.seccionId !== null && typeof body.seccionId !== "string") {
        return NextResponse.json({ error: "seccionId tiene que ser string o null" }, { status: 400 });
      }
      if (body.seccionId) {
        const seccion = await db.seccionPlanilla.findUnique({ where: { id: body.seccionId }, select: { proyectoId: true } });
        if (!seccion || seccion.proyectoId !== id) {
          return NextResponse.json({ error: "Sección no encontrada" }, { status: 404 });
        }
      }
      data.seccionId = body.seccionId || null;
    }
    if ("medicionAnchoId" in body) {
      if (body.medicionAnchoId !== null && typeof body.medicionAnchoId !== "string") {
        return NextResponse.json({ error: "medicionAnchoId tiene que ser string o null" }, { status: 400 });
      }
      data.medicionAnchoId = body.medicionAnchoId || null;
    }

    // Medición de ancho vieja a borrar — ya sea porque se reemplaza por
    // una nueva (medicionAnchoId explícito y distinto) o porque ancho
    // se vació a mano sin re-medir (queda huérfana si no se limpia).
    let medicionAnchoAEliminar: string | null = null;
    if ("medicionAnchoId" in body) {
      if (fila.medicionAnchoId && fila.medicionAnchoId !== data.medicionAnchoId) {
        medicionAnchoAEliminar = fila.medicionAnchoId;
      }
    } else {
      const anchoFinal = "ancho" in body ? (data.ancho as number | null) : fila.ancho;
      if (anchoFinal == null && fila.medicionAnchoId) {
        data.medicionAnchoId = null;
        medicionAnchoAEliminar = fila.medicionAnchoId;
      }
    }

    // ANCHO/ALTO derivan unidad — largo×ancho×alto ya da el número
    // físico correcto sin tocar subtotalFila() (m·m=m², m²·m=m³, la
    // multiplicación genérica ya lo resuelve); lo único que hay que
    // actualizar acá es la ETIQUETA. Se basa en CUÁNTOS de {ancho,
    // alto} quedan cargados tras el patch, no en cuál específicamente
    // (así da igual completar ancho o alto primero). Solo aplica a
    // filas con medición de origen — una fila manual/IA no tiene una
    // "unidad base" de la que promover.
    let desvinculado: { nombre: string; unidadNueva: string } | null = null;
    if (("ancho" in body || "alto" in body) && fila.medicion) {
      const anchoDespues = "ancho" in body ? (data.ancho as number | null) : fila.ancho;
      const altoDespues = "alto" in body ? (data.alto as number | null) : fila.alto;
      const nAntes = contarCargados(fila.ancho, fila.alto);
      const nDespues = contarCargados(anchoDespues, altoDespues);

      if (nAntes !== nDespues) {
        const unidadNueva = unidadPorDimensiones(fila.medicion.tipo === "AREA" ? "AREA" : "LINEA", nDespues);
        data.unidad = unidadNueva;
        unidadEfectiva = unidadNueva;

        // Si la fila ya estaba vinculada a un Rubro, la unidad nueva
        // (siempre distinta de la anterior — ML/M2/M3 nunca coinciden
        // entre sí) ya no puede coincidir con la del rubro viejo — se
        // desvincula sola y se avisa.
        if (rubroIdEfectivo && !("rubroId" in body)) {
          const d = await calcularDesvinculacion(rubroIdEfectivo, unidadNueva);
          if (d) {
            data.rubroId = null;
            rubroIdEfectivo = null;
            desvinculado = d;
          }
        }
      }
    }

    if (rubroIdEfectivo) {
      const rubro = await db.rubro.findUnique({
        where: { id: rubroIdEfectivo },
        select: { unidad: true, capitulo: { select: { proyectoId: true } } },
      });
      if (!rubro) {
        return NextResponse.json({ error: "Rubro no encontrado" }, { status: 404 });
      }
      // Solo se puede vincular a un rubro del mismo proyecto que la fila. Se
      // valida al cambiar el vínculo (no en cada edición de la fila, para no
      // trabar una fila vieja que ya estuviera mal vinculada).
      if ("rubroId" in body && rubro.capitulo.proyectoId !== id) {
        return NextResponse.json({ error: "El rubro no pertenece a este proyecto" }, { status: 400 });
      }
      if (unidadEfectiva) {
        if (!rubroCompatibleConFila(unidadEfectiva, rubro.unidad)) {
          return NextResponse.json(
            { error: `La unidad de la fila (${unidadEfectiva}) no coincide con la del rubro (${rubro.unidad})` },
            { status: 400 }
          );
        }
      } else {
        // Fila sin unidad propia todavía — la hereda del rubro al vincularse.
        data.unidad = rubro.unidad;
      }
    }

    // Cambio de rubro (a mano o por la desvinculación automática de arriba):
    // si la fila estaba suelta o en la sección de un rubro (las que arma
    // "Agrupar por rubro"), pasa a la sección de su rubro nuevo si existe, o
    // a sueltas si no. Una fila en una sección armada a mano se queda donde
    // está. Si el mismo patch elige la sección explícitamente, manda eso.
    if (rubroIdEfectivo !== fila.rubroId && !("seccionId" in body)) {
      const enSeccionManual = fila.seccionId != null && fila.seccion?.rubroId == null;
      if (!enSeccionManual) {
        const destino = rubroIdEfectivo
          ? await db.seccionPlanilla.findFirst({ where: { proyectoId: id, rubroId: rubroIdEfectivo }, select: { id: true } })
          : null;
        const seccionNueva = destino?.id ?? null;
        if (seccionNueva !== fila.seccionId) data.seccionId = seccionNueva;
      }
    }

    let actualizada;
    if (medicionAnchoAEliminar) {
      [actualizada] = await db.$transaction([
        db.filaMetraje.update({ where: { id: filaId }, data }),
        db.medicionDocumento.delete({ where: { id: medicionAnchoAEliminar } }),
      ]);
    } else {
      actualizada = await db.filaMetraje.update({ where: { id: filaId }, data });
    }

    return NextResponse.json({ fila: actualizada, desvinculado, medicionEliminada: medicionAnchoAEliminar });
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/filas-metraje/[filaId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — borra una fila de la Planilla (manual, IA, o vinculada a una
// medición). No debe dejar trazos huérfanos en el plano — si la fila
// tenía medicionId (largo) y/o medicionAnchoId (ancho medido con el
// ícono de regla), esas mediciones se borran también. La de largo
// arrastra la fila sola en cascada (onDelete: Cascade), así que ahí no
// hace falta un delete explícito de la fila; la de ancho es
// onDelete: SetNull a propósito (ver schema), así que si la fila no
// tiene medicionId además, hay que borrarla explícitamente. Dirección
// opuesta a esto (borrar una medición desde el plano) ya limpiaba bien
// la fila — no se toca acá, ver DELETE .../mediciones/[medicionId].
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; filaId: string }> }
) {
  try {
    const { id, filaId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    const fila = await db.filaMetraje.findUnique({
      where: { id: filaId },
      select: { medicionId: true, medicionAnchoId: true, documento: { select: { proyectoId: true } } },
    });
    if (!fila || fila.documento.proyectoId !== id) {
      return NextResponse.json({ error: "Fila no encontrada" }, { status: 404 });
    }

    const operaciones = [];
    if (fila.medicionAnchoId) {
      operaciones.push(db.medicionDocumento.delete({ where: { id: fila.medicionAnchoId } }));
    }
    if (fila.medicionId) {
      operaciones.push(db.medicionDocumento.delete({ where: { id: fila.medicionId } }));
    } else {
      operaciones.push(db.filaMetraje.delete({ where: { id: filaId } }));
    }
    await db.$transaction(operaciones);

    const medicionesEliminadas = [fila.medicionId, fila.medicionAnchoId].filter(
      (m): m is string => m != null
    );
    return NextResponse.json({ ok: true, medicionesEliminadas });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/filas-metraje/[filaId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
