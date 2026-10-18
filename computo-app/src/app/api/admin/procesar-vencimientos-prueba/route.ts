import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { procesarVencimientosPrueba } from "@/lib/vencimientosPrueba";

// Job diario del vencimiento de la prueba (ver lib/vencimientosPrueba.ts). Lo llama un GitHub
// Action, sin sesión: se autoriza con Authorization: Bearer <CRON_SECRET> (por eso src/proxy.ts
// deja pasar esta ruta sin login). Sin CRON_SECRET configurado, falla cerrado: nunca corre.
//   POST            → procesa y devuelve { procesadas, vencidasHoy, mails, errores }
//   POST ?simular=1 → solo cuenta lo que haría, sin mandar mails ni cambiar nada
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
    console.error("[procesar-vencimientos-prueba] falta CRON_SECRET: no se ejecuta");
    return NextResponse.json({ error: "No configurado" }, { status: 503 });
  }
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const simular = req.nextUrl.searchParams.get("simular") === "1";
    const resumen = await procesarVencimientosPrueba({ simular });
    console.log(`[procesar-vencimientos-prueba] ${simular ? "simulación" : "ejecutada"}:`, JSON.stringify(resumen));
    return NextResponse.json(simular ? { ...resumen, simulacion: true } : resumen);
  } catch (err) {
    console.error("[procesar-vencimientos-prueba]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
