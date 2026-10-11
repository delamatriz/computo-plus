import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { estadoEfectivo, verificarCupoFuncionAsistida } from "@/lib/acceso";
import { whatsappContacto } from "@/lib/config-prueba";
import { requerirSesion } from "@/lib/sesion";

// Estado de la cuenta de la empresa del usuario: prueba, días que quedan,
// cupos de funciones asistidas y el link de contacto. Lo usan <AvisoPrueba />
// (header) y las pantallas que avisan del cupo antes de invocar una función.
export async function GET() {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const empresa = await db.empresa.findUnique({
      where: { id: sesion.empresaId },
      select: { estado: true, fechaVencimientoPrueba: true },
    });
    if (!empresa) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

    const estado = estadoEfectivo(empresa);
    const ms = empresa.fechaVencimientoPrueba ? empresa.fechaVencimientoPrueba.getTime() - Date.now() : null;
    const [calculoRapido, proyectoAsistido, asistidos] = await Promise.all([
      verificarCupoFuncionAsistida(sesion.empresaId, "calculo_rapido"),
      verificarCupoFuncionAsistida(sesion.empresaId, "proyecto_ia"),
      db.consumoFuncionesAsistidas.findMany({
        where: { empresaId: sesion.empresaId, tipo: "proyecto_ia", proyectoId: { not: null } },
        select: { proyectoId: true },
      }),
    ]);

    return NextResponse.json({
      estado,
      fechaVencimientoPrueba: empresa.fechaVencimientoPrueba,
      // Días calendario que quedan, redondeado hacia arriba (el último día cuenta como 1).
      diasRestantes: estado === "PRUEBA" && ms !== null ? Math.max(0, Math.ceil(ms / 86_400_000)) : null,
      cupos: { calculoRapido, proyectoAsistido },
      proyectosAsistidos: asistidos.map((a) => a.proyectoId),
      contacto: whatsappContacto(sesion.email),
    });
  } catch (err) {
    console.error("[GET /api/cuenta/estado]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
