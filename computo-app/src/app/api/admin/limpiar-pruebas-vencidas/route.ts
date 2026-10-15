import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { limpiarPruebasVencidas } from "@/lib/limpiezaPruebas";

// Limpieza semanal de pruebas abandonadas (ver lib/limpiezaPruebas.ts). La
// llama un Cron Job de Render, sin sesión: se autoriza con
//   Authorization: Bearer <CRON_SECRET>
// (por eso src/proxy.ts deja pasar esta ruta sin login). Sin CRON_SECRET
// configurado, falla cerrado: nunca corre.
//   POST                       → borra y devuelve { eliminadas, empresas }
//   POST ?simular=1            → solo lista lo que borraría
function autorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const recibido = req.headers.get("authorization") ?? "";
  const esperado = `Bearer ${secreto}`;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[limpiar-pruebas-vencidas] falta CRON_SECRET: no se ejecuta");
    return NextResponse.json({ error: "No configurado" }, { status: 503 });
  }
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const simular = req.nextUrl.searchParams.get("simular") === "1";
    const resultado = await limpiarPruebasVencidas({ simular });
    console.log(`[limpiar-pruebas-vencidas] ${simular ? "simulación" : "ejecutada"}:`, JSON.stringify(resultado));
    return NextResponse.json(simular ? { ...resultado, simulacion: true } : resultado);
  } catch (err) {
    console.error("[limpiar-pruebas-vencidas]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
