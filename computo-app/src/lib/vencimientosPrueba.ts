// Flujo de vencimiento de la prueba gratis (oct-2026). Lo corre un job diario de GitHub Actions
// (.github/workflows/vencimientos-prueba.yml) contra POST /api/admin/procesar-vencimientos-prueba.
//
// Para cada empresa en PRUEBA con fecha de vencimiento, según los días que le quedan (mismo
// cálculo que el banner, GET /api/cuenta/estado: días calendario, hacia arriba):
//   - 2 a 3 días (día 11)  → mail "aviso11" una sola vez
//   - 1 día (día 13)       → mail "aviso13" una sola vez
//   - 0 o menos (día 14+)  → mail "aviso14" una sola vez + estado VENCIDA
// Los tramos son rangos, no igualdades exactas: si un día el job no corrió, el aviso sale al
// siguiente en vez de perderse. En cada corrida sale como mucho UN mail por empresa. El estado
// pasa a VENCIDA aunque el mail falle; el aviso solo se marca enviado si el mail salió, así que
// un fallo se reintenta en la corrida siguiente.
//
// A quién se manda: a los usuarios ADMIN con mail verificado de la empresa (si no hay, a cualquier
// usuario verificado); Empresa.email es opcional y no se completa en el registro público.

import { db } from "@/lib/db";
import { enviarAvisoVencimientoPrueba, type TipoAvisoVencimiento } from "@/lib/mail";

export interface ResumenVencimientos {
  procesadas: number;
  vencidasHoy: number;
  mails: { aviso11: number; aviso13: number; aviso14: number };
  /** Mails que no salieron (empresa y motivo); se reintentan en la próxima corrida. */
  errores: { empresa: string; tipo: string; motivo: string }[];
}

const MS_DIA = 86_400_000;

export async function procesarVencimientosPrueba({ simular = false } = {}): Promise<ResumenVencimientos> {
  const ahora = Date.now();
  const empresas = await db.empresa.findMany({
    where: { estado: "PRUEBA", fechaVencimientoPrueba: { not: null } },
    select: {
      id: true,
      nombre: true,
      fechaVencimientoPrueba: true,
      mailAviso11Enviado: true,
      mailAviso13Enviado: true,
      mailAviso14Enviado: true,
      users: { where: { emailVerificado: true }, select: { email: true, rol: true } },
    },
  });

  const resumen: ResumenVencimientos = { procesadas: 0, vencidasHoy: 0, mails: { aviso11: 0, aviso13: 0, aviso14: 0 }, errores: [] };

  for (const e of empresas) {
    resumen.procesadas++;
    const vence = e.fechaVencimientoPrueba!;
    const dias = Math.ceil((vence.getTime() - ahora) / MS_DIA);

    let tipo: TipoAvisoVencimiento | null = null;
    if (dias <= 0) {
      if (!e.mailAviso14Enviado) tipo = "aviso14";
    } else if (dias === 1) {
      if (!e.mailAviso13Enviado) tipo = "aviso13";
    } else if (dias <= 3) {
      if (!e.mailAviso11Enviado) tipo = "aviso11";
    }

    const vencida = dias <= 0;
    if (vencida) resumen.vencidasHoy++;
    if (simular) {
      if (tipo) resumen.mails[tipo]++;
      continue;
    }

    // El estado se asegura siempre, con o sin mail (idempotente: solo toca PRUEBA ya vencida).
    if (vencida) {
      await db.empresa.updateMany({ where: { id: e.id, estado: "PRUEBA" }, data: { estado: "VENCIDA" } });
    }
    if (!tipo) continue;

    const admins = e.users.filter((u) => u.rol === "ADMIN");
    const destinatarios = [...new Set((admins.length > 0 ? admins : e.users).map((u) => u.email))];
    if (destinatarios.length === 0) {
      resumen.errores.push({ empresa: e.nombre, tipo, motivo: "sin usuarios con mail verificado" });
      continue;
    }
    try {
      await enviarAvisoVencimientoPrueba({ para: destinatarios, empresa: e.nombre, tipo, vence });
      const campo = tipo === "aviso11" ? "mailAviso11Enviado" : tipo === "aviso13" ? "mailAviso13Enviado" : "mailAviso14Enviado";
      await db.empresa.update({ where: { id: e.id }, data: { [campo]: true } });
      resumen.mails[tipo]++;
    } catch (err) {
      console.error(`[vencimientos-prueba] mail ${tipo} a ${e.nombre}`, err);
      resumen.errores.push({ empresa: e.nombre, tipo, motivo: err instanceof Error ? err.message : "error" });
    }
  }
  return resumen;
}
