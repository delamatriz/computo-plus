import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datosCorreccionPrecio } from "@/lib/resolverPrecioMTOP";
import type { CandidatoImportacion } from "@/lib/similitudDescripcion";
import { buscarCoincidenciasPorTexto } from "@/lib/recalcularPrecioRubro";
import { requerirAdminOSuperadmin } from "@/lib/sesion";
import { codigoParaEmpresa } from "@/lib/catalogoPrecios";
import { crearAvisoPreciosActualizados } from "@/lib/avisos";
import {
  clasificarListaOficial,
  fechaListaONormalizada,
  numeroListaONormalizado,
  parsearUnidadMTOP,
  precioUnitarioDeLista,
} from "@/lib/listaMTOP";
import { mesUruguayISO } from "@/lib/fechaUruguay";

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
  /** Cómo se encontró el material existente: por código (SKU) o por descripción */
  via?: "codigo" | "descripcion";
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
//
// Quién importa: el SUPERADMIN escribe sobre el catálogo global (empresaId null), incluida la
// lista oficial. Un ADMIN solo puede importar la lista de un proveedor comercial y lo que sube
// queda a nombre de su empresa (empresaId): solo ella lo ve, y nada de lo global se toca. Para
// el ADMIN el proveedor es obligatorio y listaOficial: true se rechaza.
//
// Cada importación deja un registro ImportacionPrecios (sección "Listas importadas" de
// /materiales). Solo los materiales NUEVOS quedan vinculados a él: un material que ya existía y
// esta importación actualiza sigue en la importación que lo creó (o sin ninguna), para que
// eliminar una lista no se lleve materiales que estaban desde antes.
export async function POST(req: NextRequest) {
  const sesion = await requerirAdminOSuperadmin();
  if (sesion instanceof NextResponse) return sesion;
  const esSuper = sesion.rol === "SUPERADMIN";
  // Dueño de las filas que se leen y se escriben: null = catálogo global.
  const empresaDuenia = esSuper ? null : sesion.empresaId;
  try {
    const body = await req.json().catch(() => null);
    const proveedor = typeof body?.proveedor === "string" ? body.proveedor.trim() : "";
    const filasCrudas = Array.isArray(body?.filas) ? body.filas : null;

    // Lista oficial MTOP (proveedor null en la base): proveedor vacío + listaOficial: true.
    // El flag explícito evita que un import comercial sin proveedor (ej. un PDF sin
    // membrete) termine escrito sobre la lista oficial por un campo en blanco.
    if (!esSuper && (!proveedor || body?.listaOficial === true)) {
      return NextResponse.json(
        {
          error: body?.listaOficial === true
            ? "Solo el Administrador de CÓMPUTO+ puede importar la lista oficial"
            : "Falta proveedor",
        },
        { status: 400 }
      );
    }
    const esOficial = !proveedor && body?.listaOficial === true;
    if (!proveedor && !esOficial) {
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

    if (esOficial) {
      return await importarListaOficial(filas, filasCrudas.length, body, sesion.empresaId, sesion.id);
    }

    const importacion = await db.importacionPrecios.create({
      data: { proveedor, empresaId: empresaDuenia, creadoPorId: sesion.id },
      select: { id: true },
    });

    // Candidatos del mismo proveedor — una sola consulta para toda la
    // importación (no una por fila). Mismo criterio que la lista oficial:
    // primero código exacto (el SKU del proveedor, que se mantiene de un mes
    // a otro aunque cambie el nombre), después similitud de descripción. Un
    // candidato se usa una sola vez, para que dos filas del archivo no
    // terminen las dos actualizando el mismo material existente.
    const candidatos: CandidatoImportacion[] = await db.precioMTOP.findMany({
      where: { proveedor, empresaId: empresaDuenia },
      select: { id: true, codigo: true, descripcion: true, precioUnitario: true },
    });
    // El código guardado de una empresa lleva su prefijo (codigoParaEmpresa):
    // se compara contra el del archivo con el mismo prefijo.
    const coincidencias = clasificarListaOficial(
      filas.map((f: FilaImportacion) => {
        const c = f.codigo?.trim();
        return {
          codigo: c ? (empresaDuenia ? codigoParaEmpresa(empresaDuenia, c) : c) : undefined,
          descripcion: f.descripcion.trim(),
        };
      }),
      candidatos
    );

    const fechaLista = mesUruguayISO(); // "YYYY-MM", mes actual en Uruguay
    const detalle: DetalleFila[] = [];
    let actualizados = 0;
    let nuevos = 0;

    for (const [i, fila] of filas.entries()) {
      const descripcion = fila.descripcion.trim();
      const unidad = fila.unidad.trim();
      const coincidencia = coincidencias[i];

      if (coincidencia) {
        // Por código el nombre puede haber cambiado en la lista nueva: se toma
        // el del archivo. Por descripción se deja el que ya tenía.
        const cambiaNombre = coincidencia.via === "codigo" && coincidencia.candidato.descripcion !== descripcion;
        const actualizado = await db.precioMTOP.update({
          where: { id: coincidencia.candidato.id },
          data: {
            ...datosCorreccionPrecio(fila.precioUnitario, coincidencia.candidato.precioUnitario),
            ...(cambiaNombre ? { descripcion } : {}),
          },
        });
        actualizados++;
        detalle.push({
          descripcion,
          accion: "actualizado",
          codigo: actualizado.codigo,
          precioAnterior: coincidencia.candidato.precioUnitario,
          precioNuevo: fila.precioUnitario,
          via: coincidencia.via,
        });
        continue;
      }

      // Nuevo material — mismo criterio de fechaUltimaVerificacion que
      // una corrección: un precio recién subido por el usuario desde su
      // propia lista ya está "verificado hoy", no tiene sentido que el
      // job automático de FEAT-AI-006 lo vuelva a chequear de inmediato.
      const codigoArchivo = fila.codigo?.trim();
      let codigoFinal = codigoArchivo
        ? (empresaDuenia ? codigoParaEmpresa(empresaDuenia, codigoArchivo) : codigoArchivo)
        : generarCodigoInterno();
      const dataBase = {
        empresaId: empresaDuenia,
        descripcion,
        unidad,
        cantidadUnidad: `1 ${unidad}`,
        cantidad: 1,
        proveedor,
        numeroLista: 0,
        fechaLista,
        importacionId: importacion.id,
        ...datosCorreccionPrecio(fila.precioUnitario, null),
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

    // Lo que importa un ADMIN es privado y el matching por texto nunca lo elige (ver
    // lib/catalogoPrecios.ts), así que no puede volver ambiguo a ningún material: sin chequeo.
    const ambiguosDetectados = esSuper ? await detectarAmbiguos(sesion.empresaId) : [];

    // Solo el catálogo global avisa a las empresas (campanita); lo de un ADMIN es privado.
    if (esSuper) await crearAvisoPreciosActualizados(sesion.id, actualizados + nuevos, proveedor);

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

async function detectarAmbiguos(empresaId: string): Promise<AmbiguoDetectado[]> {
  // Chequeo de ambigüedad post-importación — el catálogo recién cambió
  // (altas + correcciones de arriba), así que un material sin vínculo
  // real (precioMTOPId null, ver Paso A/B/C de la migración fuera del
  // matching por texto) que hoy resuelve sano por contains() podría
  // volverse ambiguo con las filas nuevas, en silencio, igual que pasó
  // con "Cemento Portland" antes de tener el vínculo. Universo barato de
  // recorrer (4 materiales sin vínculo en toda la base al momento de
  // escribir esto) — se corre siempre, sincrónico, en esta misma
  // request.
  // Solo materiales de proyectos de la empresa del usuario: la lista de
  // precios es compartida, pero el aviso habla de SUS proyectos.
  const materialesSinVinculo = await db.materialAPU.findMany({
    where: { precioMTOPId: null, apu: { rubro: { capitulo: { proyecto: { empresaId: empresaId } } } } },
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
  return ambiguosDetectados;
}

// Lista oficial MTOP (proveedor null). Matching: 1) código exacto, 2) si no hay código,
// similitud de descripción, 3) si tampoco, fila nueva (ver lib/listaMTOP). Cada fila trae
// `unidad` con su presentación ("100 Kg") y `precioUnitario` = el precio de LISTA con IVA
// (por la presentación, no por unidad); el servidor deriva cantidad, unidad y precio por
// unidad igual que la carga original de la lista (precioConIva = precio de lista,
// precioUnitario = lista / cantidad). numeroLista y fechaLista salen del encabezado del
// Excel (parseados en el cliente, normalizados acá); sin ellos, 0 y el mes actual.
async function importarListaOficial(
  filasValidas: FilaImportacion[],
  totalCrudas: number,
  body: { numeroLista?: unknown; fechaLista?: unknown },
  empresaId: string,
  usuarioId: string
) {
  const numeroLista = numeroListaONormalizado(body.numeroLista);
  const fechaLista = fechaListaONormalizada(body.fechaLista);
  // Lista oficial: proveedor null y catálogo global. No se puede eliminar desde /materiales.
  const importacion = await db.importacionPrecios.create({
    data: {
      proveedor: null,
      empresaId: null,
      creadoPorId: usuarioId,
      descripcion: numeroLista > 0 ? `Lista Oficial MTOP N° ${numeroLista} (${fechaLista})` : `Lista Oficial MTOP (${fechaLista})`,
    },
    select: { id: true },
  });

  // Presentación ilegible ("kg" sí vale, "" no): no se puede derivar el precio por unidad.
  const parseadas = filasValidas.map((f) => ({ fila: f, u: parsearUnidadMTOP(f.unidad) }));
  const conUnidad = parseadas.filter((p): p is { fila: FilaImportacion; u: NonNullable<typeof p.u> } => p.u != null);

  // Un código repetido dentro del archivo (p. ej. en la hoja principal y en NUEVOS
  // MATERIALES): vale el primero; los demás se omiten. proveedor null no tiene unicidad
  // en la base (NULL no choca en el índice), así que acá es la única barrera.
  const vistos = new Set<string>();
  const items = conUnidad.filter(({ fila }) => {
    const c = fila.codigo?.trim();
    if (!c) return true;
    if (vistos.has(c)) return false;
    vistos.add(c);
    return true;
  });

  const candidatos = await db.precioMTOP.findMany({
    where: { proveedor: null, empresaId: null },
    select: { id: true, codigo: true, descripcion: true, precioUnitario: true },
  });
  const coincidencias = clasificarListaOficial(
    items.map(({ fila }) => ({ codigo: fila.codigo, descripcion: fila.descripcion.trim() })),
    candidatos
  );

  const detalle: DetalleFila[] = [];
  let actualizados = 0;
  let nuevos = 0;

  for (let i = 0; i < items.length; i++) {
    const { fila, u } = items[i];
    const descripcion = fila.descripcion.trim();
    const precioUnit = precioUnitarioDeLista(fila.precioUnitario, u.cantidad);
    const coincidencia = coincidencias[i];

    if (coincidencia) {
      const actualizado = await db.precioMTOP.update({
        where: { id: coincidencia.candidato.id },
        data: {
          ...datosCorreccionPrecio(precioUnit, coincidencia.candidato.precioUnitario),
          precioConIva: fila.precioUnitario,
          // unidad, cantidad y cantidadUnidad van juntas: precioUnitario es por esa unidad.
          // La descripción no se toca (puede estar curada a mano).
          unidad: u.unidad,
          cantidad: u.cantidad,
          cantidadUnidad: u.cantidadUnidad,
          numeroLista,
          fechaLista,
        },
      });
      actualizados++;
      detalle.push({
        descripcion,
        accion: "actualizado",
        codigo: actualizado.codigo,
        precioAnterior: coincidencia.candidato.precioUnitario,
        precioNuevo: precioUnit,
        via: coincidencia.via,
        nota:
          coincidencia.via === "descripcion"
            ? "El código no existía en el catálogo — se encontró por similitud de descripción."
            : undefined,
      });
      continue;
    }

    const codigo = fila.codigo?.trim() || generarCodigoInterno();
    const creado = await db.precioMTOP.create({
      data: {
        codigo,
        descripcion,
        unidad: u.unidad,
        cantidadUnidad: u.cantidadUnidad,
        cantidad: u.cantidad,
        proveedor: null,
        numeroLista,
        fechaLista,
        importacionId: importacion.id,
        ...datosCorreccionPrecio(precioUnit, null),
        precioConIva: fila.precioUnitario,
      },
    });
    nuevos++;
    detalle.push({ descripcion, accion: "nuevo", codigo: creado.codigo, precioNuevo: precioUnit });
  }

  const ambiguosDetectados = await detectarAmbiguos(empresaId);
  // La lista oficial solo la importa el SUPERADMIN (ver el chequeo en POST): avisa a las empresas.
  await crearAvisoPreciosActualizados(usuarioId, actualizados + nuevos);
  return NextResponse.json({
    ok: true,
    resumen: { actualizados, nuevos, total: items.length, omitidas: totalCrudas - items.length },
    detalle,
    ambiguosDetectados,
  });
}
