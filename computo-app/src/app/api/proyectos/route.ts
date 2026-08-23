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
      clienteRut,
      clienteRazonSocial,
      clienteTelefono,
      clienteEmail,
      tipo,
      tipoContratacion,
      moneda,
      area,
      descripcion,
      direccion,
      fechaInicio,
      fechaPresupuesto,
      plazoObra,
      diasLaborales,
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

    // titulos es opcional — un asistente que nunca manda este campo (o lo
    // manda vacío) deja que se sintetice el título implícito más abajo.
    const titulosConCatalogo = await Promise.all(
      (titulos ?? []).map(
        async (
          tit: {
            nombre: string;
            color?: string;
            orden?: number;
            requierePlanSeguridad?: boolean;
            capitulos: CapituloEntrada[];
          },
          tIdx: number
        ) => ({
          nombre: tit.nombre,
          color: tit.color || "#2563EB",
          orden: tit.orden ?? tIdx + 1,
          requierePlanSeguridad: !!tit.requierePlanSeguridad,
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

    // Todo proyecto tiene siempre al menos un Título — Capitulo.tituloId
    // es obligatorio. Si el asistente no mandó títulos explícitos, los
    // capítulos "sueltos" del body se envuelven en un título implícito con
    // el nombre del proyecto (el caso simple de siempre, sin fricción). Si
    // SÍ hay títulos explícitos y además hay capítulos sueltos, ambos
    // conviven: el implícito se agrega al final.
    const titulosAcrear = [...titulosConCatalogo];
    if (titulosConCatalogo.length === 0 || capitulosConCatalogo.length > 0) {
      titulosAcrear.push({
        nombre,
        color: "#2563EB",
        orden: titulosConCatalogo.length + 1,
        requierePlanSeguridad: false,
        capitulos: capitulosConCatalogo,
      });
    }

    const proyecto = await db.$transaction(async (tx) => {
      const creado = await tx.proyecto.create({
        data: {
          nombre,
          subtitulo: subtitulo || null,
          cliente: cliente || "",
          clienteRut: clienteRut || null,
          clienteRazonSocial: clienteRazonSocial || null,
          clienteTelefono: clienteTelefono || null,
          clienteEmail: clienteEmail || null,
          tipo: tipo || "VIVIENDA",
          tipoContratacion: tipoContratacion || "PRIVADA",
          moneda: moneda || "UYU",
          area: area ? parseFloat(area) : null,
          descripcion: descripcion || "",
          direccion: direccion || "",
          // Sin default a "hoy" a propósito — el wizard ya no la pide (ver
          // proyectos/nuevo/page.tsx), queda null hasta que se cargue desde
          // /editar. Poner la fecha de creación acá mentiría "la obra
          // arrancó hoy" cuando en realidad todavía no se sabe.
          fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
          fechaPresupuesto: fechaPresupuesto ? new Date(fechaPresupuesto) : null,
          plazoObra: plazoObra ? parseInt(plazoObra) : null,
          diasLaborales: diasLaborales ? parseInt(diasLaborales) : null,
          estado: "EN_CURSO",
          empresaId: empresa.id,
        },
      });

      for (const tit of titulosAcrear) {
        const tituloCreado = await tx.titulo.create({
          data: {
            nombre: tit.nombre,
            color: tit.color,
            orden: tit.orden,
            requierePlanSeguridad: tit.requierePlanSeguridad,
            proyectoId: creado.id,
          },
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
