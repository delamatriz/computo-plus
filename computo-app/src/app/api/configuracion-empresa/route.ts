import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSesion } from "@/lib/sesion";
import { obtenerConfigEmpresa } from "@/lib/configuracionEmpresa";

export async function GET() {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;

  try {
    const config = await obtenerConfigEmpresa(sesion.empresaId);
    return NextResponse.json(config);
  } catch (err) {
    console.error("[GET /api/configuracion-empresa]", err);
    return NextResponse.json(
      { error: "Error al obtener la configuración de la empresa." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido — se esperaba JSON." },
      { status: 400 }
    );
  }

  const updates: {
    margenEmpresa?: number;
    margenImprevistos?: number;
    monedaDefault?: string;
  } = {};

  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;

    if ("margenEmpresa" in b) {
      const v = b.margenEmpresa;
      if (typeof v !== "number" || isNaN(v) || v < 0 || v > 1) {
        return NextResponse.json(
          { error: "margenEmpresa debe ser un número entre 0 y 1." },
          { status: 400 }
        );
      }
      updates.margenEmpresa = v;
    }

    if ("margenImprevistos" in b) {
      const v = b.margenImprevistos;
      if (typeof v !== "number" || isNaN(v) || v < 0 || v > 1) {
        return NextResponse.json(
          { error: "margenImprevistos debe ser un número entre 0 y 1." },
          { status: 400 }
        );
      }
      updates.margenImprevistos = v;
    }

    if ("monedaDefault" in b) {
      const v = b.monedaDefault;
      if (typeof v !== "string" || !["UYU", "USD", "EUR"].includes(v)) {
        return NextResponse.json(
          { error: "monedaDefault debe ser uno de: UYU, USD, EUR." },
          { status: 400 }
        );
      }
      updates.monedaDefault = v;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No se enviaron campos a actualizar." },
      { status: 400 }
    );
  }

  try {
    await obtenerConfigEmpresa(sesion.empresaId);
    const actualizado = await db.configuracionEmpresa.update({
      where: { empresaId: sesion.empresaId },
      data: updates,
    });
    return NextResponse.json(actualizado);
  } catch (err) {
    console.error("[PATCH /api/configuracion-empresa]", err);
    return NextResponse.json(
      { error: "Error al actualizar la configuración de la empresa." },
      { status: 500 }
    );
  }
}
