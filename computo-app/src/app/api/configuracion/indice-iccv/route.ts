import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSuperadmin } from "@/lib/sesion";

const VARIANTES_VALIDAS = ["publica", "privada"] as const;

export async function GET() {
  const filas = await db.indiceICCVMensual.findMany({
    orderBy: [{ mes: "desc" }, { variante: "asc" }],
  });
  return NextResponse.json(filas);
}

// Carga manual de un mes/variante — upsert por (mes, variante): volver a
// cargar el mismo mes/variante corrige el valor en vez de duplicar la
// fila (Luis puede haberse equivocado al tipear).
export async function POST(req: NextRequest) {
  const authCheck = await requerirSuperadmin();
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { mes, variante, valor } = await req.json();

    if (typeof mes !== "string" || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: "Mes inválido — formato esperado YYYY-MM" }, { status: 400 });
    }
    if (typeof variante !== "string" || !VARIANTES_VALIDAS.includes(variante as (typeof VARIANTES_VALIDAS)[number])) {
      return NextResponse.json({ error: "Variante inválida — debe ser 'publica' o 'privada'" }, { status: 400 });
    }
    const valorNum = typeof valor === "number" ? valor : parseFloat(valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const fila = await db.indiceICCVMensual.upsert({
      where: { mes_variante: { mes, variante } },
      create: { mes, variante, valor: valorNum },
      update: { valor: valorNum },
    });

    return NextResponse.json(fila);
  } catch (err) {
    console.error("[POST /api/configuracion/indice-iccv]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
