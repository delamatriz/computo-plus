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

    // Evento A — convenioImagenUrl solo llega en el body cuando
    // guardarCambios() confirmó una foto nueva del convenio (ver
    // configuracion/page.tsx), nunca en un guardado suelto de un jornal a
    // mano — por eso alcanza esta condición para no generar ruido.
    if (body.convenioImagenUrl !== undefined) {
      // timeZone: "UTC" — "YYYY-MM-DD" del input de fecha se parsea como
      // medianoche UTC; formateado en huso local (Uruguay UTC-3) esa fecha
      // calendario se corre un día para atrás (mismo bug ya documentado y
      // resuelto para este mismo campo en lib/convenioSunca.ts).
      const fecha = body.convenioFechaVigente
        ? new Date(body.convenioFechaVigente).toLocaleDateString("es-UY", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
          })
        : null;
      await db.eventoSistema.create({
        data: {
          titulo: fecha ? `Convenio SUNCA actualizado — vigente desde ${fecha}` : "Convenio SUNCA actualizado",
          descripcion: "Se subió una nueva foto del convenio y se confirmaron los jornales extraídos en Configuración.",
        },
      });
    }

    return NextResponse.json(actualizada);
  } catch (err) {
    console.error("[PATCH /api/configuracion]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
