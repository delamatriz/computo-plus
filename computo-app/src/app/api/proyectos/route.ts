import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolverCapituloCatalogoId } from "@/lib/capituloCatalogoResolver";

export async function GET() {
  try {
    const proyectos = await db.proyecto.findMany({
      orderBy: { createdAt: "desc" },
      include: { capitulos: true },
    });
    return NextResponse.json(proyectos);
  } catch (err) {
    console.error("[GET /api/proyectos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nombre,
      subtitulo,
      cliente,
      tipo,
      tipoContratacion,
      moneda,
      area,
      descripcion,
      direccion,
      fechaInicio,
      plazoObra,
      diasLaborales,
      requierePlanSeguridad,
      modalidadAltura,
      capitulos,
      titulos,
    } = body;

    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: "El nombre del proyecto es obligatorio" }, { status: 400 });
    }

    // Buscar o crear la empresa por defecto
    let empresa = await db.empresa.findFirst();
    if (!empresa) {
      empresa = await db.empresa.create({
        data: { nombre: "Mi Empresa", rut: "000000000000" },
      });
    }

    type CapituloEntrada = { nombre: string; codigo?: string; color?: string; orden: number };

    // Fase 2, Etapa 5 — resolver capituloCatalogoId de cada capítulo ANTES
    // de crearlo, para que no dependa de un backfill posterior (ver
    // capituloCatalogoResolver.ts). Nunca bloquea: si no matchea, queda
    // undefined/null. Se resuelve para TODOS los capítulos de una — los
    // sueltos y los de cada título — antes de abrir la transacción, porque
    // es de solo lectura y no tiene sentido tenerla abierta mientras se
    // espera esto.
    const capitulosConCatalogo = await Promise.all(
      (capitulos ?? []).map(async (cap: CapituloEntrada, i: number) => ({
        nombre: cap.nombre,
        codigo: cap.codigo || String(i + 1).padStart(2, "0"),
        color: cap.color || "#2563EB",
        orden: cap.orden ?? i + 1,
        capituloCatalogoId: await resolverCapituloCatalogoId(db, cap.nombre),
      }))
    );

    // titulos es opcional y retrocompatible — un asistente que nunca
    // manda este campo (o lo manda vacío) crea el proyecto exactamente
    // igual que antes del feature de Título.
    const titulosConCatalogo = await Promise.all(
      (titulos ?? []).map(
        async (tit: { nombre: string; color?: string; orden?: number; capitulos: CapituloEntrada[] }, tIdx: number) => ({
          nombre: tit.nombre,
          color: tit.color || "#2563EB",
          orden: tit.orden ?? tIdx + 1,
          capitulos: await Promise.all(
            (tit.capitulos ?? []).map(async (cap: CapituloEntrada, i: number) => ({
              nombre: cap.nombre,
              codigo: cap.codigo || `${tIdx + 1}.${i + 1}`,
              color: cap.color || "#2563EB",
              orden: cap.orden ?? i + 1,
              capituloCatalogoId: await resolverCapituloCatalogoId(db, cap.nombre),
            }))
          ),
        })
      )
    );

    // Proyecto + capítulos sueltos se crean de una (nested write, igual
    // que siempre); los títulos van aparte porque Prisma no permite que un
    // nested write de un lado (capitulos) referencie el id de otro nested
    // write hermano (titulos) creado en la misma llamada — por eso hace
    // falta $transaction en vez de un único proyecto.create().
    const proyecto = await db.$transaction(async (tx) => {
      const creado = await tx.proyecto.create({
        data: {
          nombre,
          subtitulo: subtitulo || null,
          cliente: cliente || "",
          tipo: tipo || "VIVIENDA",
          tipoContratacion: tipoContratacion || "PRIVADA",
          moneda: moneda || "USD",
          area: area ? parseFloat(area) : null,
          descripcion: descripcion || "",
          direccion: direccion || "",
          fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
          plazoObra: plazoObra ? parseInt(plazoObra) : null,
          diasLaborales: diasLaborales ? parseInt(diasLaborales) : null,
          requierePlanSeguridad: !!requierePlanSeguridad,
          modalidadAltura: modalidadAltura || null,
          estado: "EN_CURSO",
          empresaId: empresa.id,
          capitulos: {
            create: capitulosConCatalogo,
          },
        },
      });

      for (const tit of titulosConCatalogo) {
        const tituloCreado = await tx.titulo.create({
          data: { nombre: tit.nombre, color: tit.color, orden: tit.orden, proyectoId: creado.id },
        });
        if (tit.capitulos.length > 0) {
          await tx.capitulo.createMany({
            data: tit.capitulos.map((cap: (typeof tit.capitulos)[number]) => ({
              ...cap,
              proyectoId: creado.id,
              tituloId: tituloCreado.id,
            })),
          });
        }
      }

      return tx.proyecto.findUniqueOrThrow({
        where: { id: creado.id },
        include: { capitulos: true, titulos: true },
      });
    });

    return NextResponse.json(proyecto);
  } catch (err) {
    console.error("[POST /api/proyectos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
