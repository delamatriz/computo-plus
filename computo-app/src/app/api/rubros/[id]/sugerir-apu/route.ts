import { NextRequest, NextResponse } from "next/server";
import { generarApuParaRubro } from "@/lib/apu";
import { ErrorFuncionNoDisponible } from "@/lib/anthropic-client";
import { requerirRubro } from "@/lib/sesion";
import { consumirFuncionAsistida, devolverConsumo, respuestaFuncionNoDisponible } from "@/lib/acceso";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Para el catch: contacto del usuario y cupo a devolver si el servicio no está disponible.
  let emailContacto = "";
  let consumoId: string | null = null;
  try {
    const { id: rubroId } = await params;
    const acceso = await requerirRubro(rubroId);
    if (acceso instanceof NextResponse) return acceso;
    emailContacto = acceso.email;
    const body = await req.json();
    const { descripcion, unidad, capitulo, tipoObra } = body as {
      descripcion: string;
      unidad: string;
      capitulo: string;
      tipoObra: string;
    };

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    }

    const consumo = await consumirFuncionAsistida(acceso, "proyecto_ia", acceso.proyectoId);
    if (consumo instanceof NextResponse) return consumo;
    consumoId = consumo.consumoId;

    const apu = await generarApuParaRubro(rubroId, { descripcion, unidad, capitulo, tipoObra }, "manual");

    return NextResponse.json({
      materiales: apu.materiales,
      manoObra: apu.manoObra,
      precioUnitarioEstimado: apu.precioUnitarioEstimado,
      origen: apu.origen,
      subrubroBaseId: apu.subrubroBaseId,
    });
  } catch (err) {
    console.error("[sugerir-apu]", err);
    if (err instanceof ErrorFuncionNoDisponible) await devolverConsumo(consumoId);
    const noDisponible = respuestaFuncionNoDisponible(err, emailContacto);
    if (noDisponible) return noDisponible;
    return NextResponse.json({ error: "Error al generar APU" }, { status: 500 });
  }
}
