import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    const proyecto = await db.proyecto.create({
      data: {
        nombre,
        subtitulo: subtitulo || null,
        cliente: cliente || "",
        tipo: tipo || "VIVIENDA",
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
          create: (capitulos ?? []).map(
            (cap: { nombre: string; codigo?: string; color?: string; orden: number }, i: number) => ({
              nombre: cap.nombre,
              codigo: cap.codigo || String(i + 1).padStart(2, "0"),
              color: cap.color || "#2563EB",
              orden: cap.orden ?? i + 1,
            })
          ),
        },
      },
      include: { capitulos: true },
    });

    return NextResponse.json(proyecto);
  } catch (err) {
    console.error("[POST /api/proyectos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
