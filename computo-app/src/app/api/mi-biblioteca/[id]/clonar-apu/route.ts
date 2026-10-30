import { NextRequest, NextResponse } from "next/server";
import { ProyectoFinalizadoError } from "@/lib/clonarApu";
import { clonarApuEmpresaAlRubro } from "@/lib/clonarApuEmpresa";
import { requerirRubro } from "@/lib/sesion";

// POST — copia el APU de un rubro de Mis rubros (SubrubroEmpresa) al APU real
// de un rubro de proyecto ya creado ("+ Mis rubros" en el presupuesto), y le
// pone el nombre y la unidad del de Mis rubros. Equivalente a
// /api/subrubros-estandar/[id]/clonar-apu para el catálogo global.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subrubroId } = await params;
    const { rubroId } = await req.json().catch(() => ({}));
    if (!rubroId) return NextResponse.json({ error: "Falta rubroId" }, { status: 400 });

    // El rubro tiene que ser de la empresa del usuario; el de Mis rubros
    // también (se filtra por esa misma empresa adentro).
    const acceso = await requerirRubro(rubroId);
    if (acceso instanceof NextResponse) return acceso;

    const resultado = await clonarApuEmpresaAlRubro(subrubroId, rubroId, acceso.empresaId);
    if (!resultado) return NextResponse.json({ error: "Rubro de Mis rubros no encontrado" }, { status: 404 });
    return NextResponse.json({ apu: resultado.apu, rubro: resultado.rubro });
  } catch (err) {
    if (err instanceof ProyectoFinalizadoError) {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: err.message }, { status: 403 });
    }
    console.error("[POST /api/mi-biblioteca/[id]/clonar-apu]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
