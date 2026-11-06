import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verificarConsumoIA } from "@/lib/alertasConsumoIA";

// Job diario de consumo de IA (ver lib/alertasConsumoIA.ts). Lo llama el GitHub
// Action consumo-ia.yml, sin sesión: se autoriza con Authorization: Bearer
// <CRON_SECRET> (por eso src/proxy.ts deja pasar esta ruta sin login). Sin
// CRON_SECRET configurado, falla cerrado: nunca corre.
//   POST            → genera los avisos que falten y devuelve el resumen
//   POST ?simular=1 → solo cuenta lo que haría, sin crear avisos ni mandar mails
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
    console.error("[verificar-consumo-ia] falta CRON_SECRET: no se ejecuta");
    return NextResponse.json({ error: "No configurado" }, { status: 503 });
  }
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const simular = req.nextUrl.searchParams.get("simular") === "1";
    const resumen = await verificarConsumoIA({ simular });
    console.log(`[verificar-consumo-ia] ${simular ? "simulación" : "ejecutada"}:`, JSON.stringify(resumen));
    return NextResponse.json(simular ? { ...resumen, simulacion: true } : resumen);
  } catch (err) {
    console.error("[verificar-consumo-ia]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
