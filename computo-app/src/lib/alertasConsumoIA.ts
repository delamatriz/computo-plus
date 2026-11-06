// Job diario de consumo de IA (nov-2026): por cada empresa que pasó el umbral
// de ATENCIÓN o de ALERTA de su plan en el mes en curso, deja un EventoAdmin
// (lo ve solo el SUPERADMIN: campanita y /admin → Eventos del sistema) y, si
// es ALERTA, manda un mail de respaldo a computo@delamatriz.com.
//
// Una sola vez por empresa, por mes y por nivel: si ya existe el evento de
// ese nivel para esa empresa desde el 1° del mes (hora de Uruguay), no se
// repite. Una empresa que pasa directo a ALERTA genera solo ALERTA.

import { db } from "@/lib/db";
import { enviarAlertaConsumoIA } from "@/lib/mail";
import { mesActualUruguay, resumenConsumoIA, textoAvisoConsumo, TIPO_EVENTO_CONSUMO } from "@/lib/consumoIA";

export interface ResultadoVerificacionConsumo {
  mes: string;
  revisadas: number;
  avisosNuevos: { empresa: string; nivel: "ATENCION" | "ALERTA"; gastoUSD: number }[];
  mails: number;
  errores: string[];
}

export async function verificarConsumoIA({ simular = false }: { simular?: boolean } = {}): Promise<ResultadoVerificacionConsumo> {
  const ahora = new Date();
  const resumen = await resumenConsumoIA(ahora);
  const { desde } = mesActualUruguay(ahora);
  const resultado: ResultadoVerificacionConsumo = { mes: resumen.mes, revisadas: resumen.empresas.length, avisosNuevos: [], mails: 0, errores: [] };

  for (const e of resumen.empresas) {
    if (e.nivel === "NORMAL") continue;
    const tipo = TIPO_EVENTO_CONSUMO[e.nivel];
    const yaAvisado = await db.eventoAdmin.findFirst({
      where: { tipo, empresaId: e.empresaId, createdAt: { gte: desde } },
      select: { id: true },
    });
    if (yaAvisado) continue;

    resultado.avisosNuevos.push({ empresa: e.nombre, nivel: e.nivel, gastoUSD: e.gastoMes });
    if (simular) continue;

    await db.eventoAdmin.create({
      data: { tipo, empresaId: e.empresaId, detalle: textoAvisoConsumo(e.nivel, e.nombre, e.gastoMes) },
    });
    if (e.nivel === "ALERTA") {
      try {
        await enviarAlertaConsumoIA({ empresa: e.nombre, plan: e.plan, gastoUSD: e.gastoMes, llamadas: e.llamadasMes, mes: resumen.mes });
        resultado.mails++;
      } catch (err) {
        // El aviso en la campanita ya quedó: el mail es respaldo, no se reintenta.
        console.error(`[verificar-consumo-ia] mail de alerta de ${e.nombre}`, err);
        resultado.errores.push(`mail ${e.nombre}`);
      }
    }
  }
  return resultado;
}
