import { db } from "@/lib/db";

interface DatosLogConsumoIA {
  // Identificador estable de qué llamada a Claude generó la fila — ver
  // LogConsumoIA en schema.prisma para la lista de valores usados hoy.
  funcion: string;
  proyectoId?: string | null;
  inputTokens: number;
  outputTokens: number;
  // 1 si la llamada respondió directo, más si necesitó reintentos
  // internos por stop_reason "pause_turn" (ver iccv/verificar-precio-
  // mercado, los dos únicos casos con retry hoy).
  pasos?: number;
}

// Registra el consumo de tokens de una llamada a la API de Claude — se
// llama SIN `await` desde cada function/route (fire-and-forget: nunca
// debe bloquear ni afectar la respuesta real al usuario). El try/catch
// de acá adentro es la garantía de que esta promesa nunca rechaza, así
// que ningún caller necesita su propio `.catch()` — un fallo al
// escribir el log queda solo en la consola del servidor.
export async function registrarLogConsumoIA(datos: DatosLogConsumoIA): Promise<void> {
  try {
    await db.logConsumoIA.create({
      data: {
        funcion: datos.funcion,
        proyectoId: datos.proyectoId ?? null,
        inputTokens: datos.inputTokens,
        outputTokens: datos.outputTokens,
        pasos: datos.pasos ?? 1,
      },
    });
  } catch (err) {
    console.error(`[registrarLogConsumoIA] error al guardar el log (funcion=${datos.funcion})`, err);
  }
}
