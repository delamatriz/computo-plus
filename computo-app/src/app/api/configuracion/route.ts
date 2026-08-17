import { NextResponse } from "next/server";
import { db } from "@/lib/db";

async function getOrCreateConfiguracion() {
  const existente = await db.configuracion.findFirst();
  if (existente) return existente;
  return db.configuracion.create({ data: {} });
}

export async function GET() {
  try {
    const config = await getOrCreateConfiguracion();
    return NextResponse.json(config);
  } catch (err) {
    console.error("[GET /api/configuracion]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const config = await getOrCreateConfiguracion();

    const data: { convenioFechaVigente?: Date; convenioImagenUrl?: string | null } = {};
    if (body.convenioFechaVigente !== undefined) {
      data.convenioFechaVigente = body.convenioFechaVigente
        ? new Date(body.convenioFechaVigente)
        : undefined;
    }
    if (body.convenioImagenUrl !== undefined) {
      data.convenioImagenUrl = body.convenioImagenUrl || null;
    }

    const actualizada = await db.configuracion.update({
      where: { id: config.id },
      data,
    });
    return NextResponse.json(actualizada);
  } catch (err) {
    console.error("[PATCH /api/configuracion]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
