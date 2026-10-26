import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { actualizarTipoCambio } from "@/lib/tipoCambio";

// Job diario del tipo de cambio del BCU (ver lib/tipoCambio.ts). Lo llama un GitHub Action, sin
// sesión: se autoriza con Authorization: Bearer <CRON_SECRET> (por eso src/proxy.ts deja pasar
// esta ruta sin login). Sin CRON_SECRET configurado, falla cerrado: nunca corre.
//   POST            → consulta el BCU y guarda la cotización del último cierre
//   POST ?simular=1 → solo consulta el BCU, sin escribir
// Si el BCU no responde, devuelve 502 sin escribir nada: la app sigue con el último valor guardado.
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
    console.error("[actualizar-tipo-cambio] falta CRON_SECRET: no se ejecuta");
    return NextResponse.json({ error: "No configurado" }, { status: 503 });
  }
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const simular = req.nextUrl.searchParams.get("simular") === "1";
  try {
    const cierre = await actualizarTipoCambio({ simular });
    console.log(`[actualizar-tipo-cambio] ${simular ? "simulación" : "guardado"}:`, JSON.stringify(cierre));
    return NextResponse.json(simular ? { ...cierre, simulacion: true } : cierre);
  } catch (err) {
    console.error("[actualizar-tipo-cambio] el BCU no respondió o la respuesta no es válida:", err);
    return NextResponse.json({ error: "BCU no disponible" }, { status: 502 });
  }
}
