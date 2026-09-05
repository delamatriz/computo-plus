import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datosCorreccionPrecio } from "@/lib/resolverPrecioMTOP";
import { mejorCoincidencia, type CandidatoImportacion } from "@/lib/similitudDescripcion";
import { buscarCoincidenciasPorTexto } from "@/lib/recalcularPrecioRubro";

interface AmbiguoDetectado {
  materialAPUId: string;
  proyectoId: string;
  proyectoNombre: string;
  rubroNombre: string;
  descripcion: string;
  candidatos: { id: string; descripcion: string; precio: number }[];
}

interface FilaImportacion {
  codigo?: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number;
}

interface DetalleFila {
  descripcion: string;
  accion: "actualizado" | "nuevo";
  codigo: string;
  precioAnterior?: number;
  precioNuevo: number;
  nota?: string;
}

function generarCodigoInterno(): string {
  return `IMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function esFilaValida(f: unknown): f is FilaImportacion {
  if (!f || typeof f !== "object") return false;
  const r = f as Record<string, unknown>;
  return (
    typeof r.descripcion === "string" &&
    r.descripcion.trim().length > 0 &&
    typeof r.unidad === "string" &&
    r.unidad.trim().length > 0 &&
    typeof r.precioUnitario === "number" &&
    Number.isFinite(r.precioUnitario) &&
    r.precioUnitario > 0
  );
}

// Importación masiva de una lista de precios de un proveedor (Excel/CSV
// ya parseado en el cliente, ver ModalImportarPrecios) — Caso 1 de la
// investigación de materiales, complementa el Caso 2 (corrección
// individual, ver PATCH en ../route.ts). Mismo criterio de clasificación
// que la vista previa (lib/similitudDescripcion, isomorfo) — el server
// recalcula la clasificación acá, nunca confía en la del cliente, para
// que los datos que se escriben sean siempre los que decidió el server.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const proveedor = typeof body?.proveedor === "string" ? body.proveedor.trim() : "";
    const filasCrudas = Array.isArray(body?.filas) ? body.filas : null;

    if (!proveedor) {
      return NextResponse.json({ error: "Falta proveedor" }, { status: 400 });
    }
    if (!filasCrudas || filasCrudas.length === 0) {
      return NextResponse.json({ error: "Falta el array de filas" }, { status: 400 });
    }

    const filas = filasCrudas.filter(esFilaValida);
    if (filas.length === 0) {
      return NextResponse.json(
        { error: "Ninguna fila tiene descripción, unidad y precio válidos" },
        { status: 400 }
      );
    }

    // Candidatos del mismo proveedor — una sola consulta para toda la
    // importación (no una por fila). Se va descartando el candidato ya
    // usado a medida que se matchea, para que dos filas del archivo no
    // terminen las dos actualizando el mismo material existente.
    const candidatosDisponibles: CandidatoImportacion[] = await db.precioMTOP.findMany({
      where: { proveedor },
      select: { id: true, codigo: true, descripcion: true, precioUnitario: true },
    });

    const fechaLista = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const detalle: DetalleFila[] = [];
    let actualizados = 0;
    let nuevos = 0;

    for (const fila of filas) {
      const descripcion = fila.descripcion.trim();
      const unidad = fila.unidad.trim();
      const coincidencia = mejorCoincidencia(descripcion, candidatosDisponibles);

      if (coincidencia) {
        const idx = candidatosDisponibles.findIndex((c) => c.id === coincidencia.candidato.id);
        if (idx >= 0) candidatosDisponibles.splice(idx, 1); // no reusar este candidato en otra fila

        const actualizado = await db.precioMTOP.update({
          where: { id: coincidencia.candidato.id },
          data: datosCorreccionPrecio(fila.precioUnitario),
        });
        actualizados++;
        detalle.push({
          descripcion,
          accion: "actualizado",
          codigo: actualizado.codigo,
          precioAnterior: coincidencia.candidato.precioUnitario,
          precioNuevo: fila.precioUnitario,
        });
        continue;
      }

      // Nuevo material — mismo criterio de fechaUltimaVerificacion que
      // una corrección: un precio recién subido por el usuario desde su
      // propia lista ya está "verificado hoy", no tiene sentido que el
      // job automático de FEAT-AI-006 lo vuelva a chequear de inmediato.
      let codigoFinal = fila.codigo?.trim() || generarCodigoInterno();
      const dataBase = {
        descripcion,
        unidad,
        cantidadUnidad: `1 ${unidad}`,
        cantidad: 1,
        proveedor,
        numeroLista: 0,
        fechaLista,
        ...datosCorreccionPrecio(fila.precioUnitario),
      };

      let nota: string | undefined;
      let creado;
      try {
        creado = await db.precioMTOP.create({ data: { codigo: codigoFinal, ...dataBase } });
      } catch (err) {
        // (codigo, proveedor) ya existía para este proveedor — el código
        // que traía el archivo choca con algo que la similitud de
        // descripción no matcheó. Se genera uno interno y se avisa en el
        // detalle, en vez de perder la fila.
        if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
          codigoFinal = generarCodigoInterno();
          creado = await db.precioMTOP.create({ data: { codigo: codigoFinal, ...dataBase } });
          nota = "El código del archivo ya existía para este proveedor — se generó uno interno.";
        } else {
          throw err;
        }
      }

      nuevos++;
      detalle.push({
        descripcion,
        accion: "nuevo",
        codigo: creado.codigo,
        precioNuevo: fila.precioUnitario,
        nota,
      });
    }

    // Chequeo de ambigüedad post-importación — el catálogo recién cambió
    // (altas + correcciones de arriba), así que un material sin vínculo
    // real (precioMTOPId null, ver Paso A/B/C de la migración fuera del
    // matching por texto) que hoy resuelve sano por contains() podría
    // volverse ambiguo con las filas nuevas, en silencio, igual que pasó
    // con "Cemento Portland" antes de tener el vínculo. Universo barato de
    // recorrer (4 materiales sin vínculo en toda la base al momento de
    // escribir esto) — se corre siempre, sincrónico, en esta misma
    // request.
    const materialesSinVinculo = await db.materialAPU.findMany({
      where: { precioMTOPId: null },
      select: {
        id: true,
        descripcion: true,
        apu: {
          select: {
            rubro: {
              select: {
                descripcion: true,
                capitulo: { select: { proyecto: { select: { id: true, nombre: true } } } },
              },
            },
          },
        },
      },
    });

    const ambiguosDetectados: AmbiguoDetectado[] = [];
    for (const m of materialesSinVinculo) {
      const candidatos = await buscarCoincidenciasPorTexto(m.descripcion);
      if (candidatos.length < 2) continue;
      ambiguosDetectados.push({
        materialAPUId: m.id,
        proyectoId: m.apu.rubro.capitulo.proyecto.id,
        proyectoNombre: m.apu.rubro.capitulo.proyecto.nombre,
        rubroNombre: m.apu.rubro.descripcion,
        descripcion: m.descripcion,
        candidatos: candidatos.map((c) => ({ id: c.id, descripcion: c.descripcion, precio: c.precioUnitario })),
      });
    }

    return NextResponse.json({
      ok: true,
      resumen: { actualizados, nuevos, total: filas.length, omitidas: filasCrudas.length - filas.length },
      detalle,
      ambiguosDetectados,
    });
  } catch (err) {
    console.error("[POST /api/precios-mtop/importar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
