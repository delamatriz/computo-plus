// Limpieza — resetea fechaUltimaVerificacion a null en los registros de
// PrecioMTOP cuyo valor actual proviene del backfill manual de
// fix-feat006-migrar-fuentes-real.ts (Etapa 2, julio), NO de una corrida
// real del job de verificación de precios (FEAT-AI-006, Etapa 3).
//
// Identificación sin ambigüedad, confirmada por investigación: el job
// real (escribirResultado() en lib/verificarPrecioMercado.ts) siempre
// escribe fechaUltimaVerificacion = new Date() — un timestamp real de
// servidor, que nunca cae justo en medianoche UTC — y en el caso
// "variacion_alta" además escribe detalleVerificacion (texto libre de la
// IA). El backfill de julio, en cambio, escribió fechas sueltas
// (YYYY-MM-DD, sin hora) desde un JSON de mapeo manual — por eso quedan
// exactamente en 00:00:00.000Z, y nunca tienen detalleVerificacion.
//
// Criterio de reset:
//   proveedor NOT NULL
//   AND fechaUltimaVerificacion NOT NULL
//   AND hora/minuto/segundo/ms == 0 (medianoche UTC exacta)
//   AND detalleVerificacion IS NULL
//   AND motivoVerificacion IS NULL
//
// El último filtro (motivoVerificacion IS NULL) es a propósito, acotado
// tras revisión con Luis: 51 de los 164 registros con fecha de backfill
// YA tienen una clasificación de fuente legítima asignada en la misma
// auditoría de Etapa 2 (tarifa_oficial_organismo, derivado_recalculo_
// proporcional, derivado_modelo_regresion, fuente_debil_cruzada,
// sin_cotizacion_fresca) — esos quedan fuera del universo "elegible" de
// todos modos (ver elegibles/route.ts, motivoVerificacion: null), así
// que tocarles la fecha no cambiaría nada visualmente, pero se decidió
// no resetear más campos de los que el badge nuevo realmente necesita.
//
// Sin este reset, el campo no puede usarse para el badge "Pendiente de
// verificar" (todo backfill parece "ya verificado", aunque el job de IA
// nunca corrió sobre ese material) — ver investigación previa.
//
// Modo dry-run (default): solo muestra qué cambiaría, no escribe nada.
// Modo aplicar: agregar --apply para escribir en DB.
//
// Ejecutar:
//   npx tsx scripts/limpiar-fecha-verificacion-falsa.ts              (dry-run)
//   npx tsx scripts/limpiar-fecha-verificacion-falsa.ts --apply       (escribe en DB)

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");

function esMedianocheExacta(fecha: Date): boolean {
  return (
    fecha.getUTCHours() === 0 &&
    fecha.getUTCMinutes() === 0 &&
    fecha.getUTCSeconds() === 0 &&
    fecha.getUTCMilliseconds() === 0
  );
}

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");
  console.log();

  // Universo a inspeccionar: todos los que tienen proveedor Y fecha —
  // el filtro de medianoche exacta + sin detalle se aplica en memoria
  // (Prisma no tiene un operador nativo de "hora == 0" portable).
  const candidatos = await p.precioMTOP.findMany({
    where: {
      proveedor: { not: null },
      fechaUltimaVerificacion: { not: null },
      motivoVerificacion: null,
    },
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      fechaUltimaVerificacion: true,
      detalleVerificacion: true,
      motivoVerificacion: true,
      requiereVerificacion: true,
    },
    orderBy: { codigo: "asc" },
  });

  const aResetear = candidatos.filter(
    (c) => esMedianocheExacta(c.fechaUltimaVerificacion!) && !c.detalleVerificacion
  );
  const noAfectados = candidatos.filter((c) => !aResetear.includes(c));

  console.log(`Con proveedor + fechaUltimaVerificacion seteada + SIN motivoVerificacion: ${candidatos.length}`);
  console.log(`  -> cumplen el patrón de backfill (medianoche exacta, sin detalle): ${aResetear.length}`);
  console.log(`  -> NO cumplen (fecha con hora real, o con detalleVerificacion — se dejan intactos): ${noAfectados.length}`);
  console.log();

  if (noAfectados.length > 0) {
    console.log("Registros que NO se tocan (por si alguno sí viene de una corrida real):");
    for (const c of noAfectados) {
      console.log(
        `  ${c.codigo} — fecha=${c.fechaUltimaVerificacion!.toISOString()} detalle=${c.detalleVerificacion ? "sí" : "no"}`
      );
    }
    console.log();
  }

  console.log(`Registros a resetear (fechaUltimaVerificacion → null):`);
  for (const c of aResetear) {
    console.log(
      `  ${modoAplicar ? "✓" : "→"} ${c.codigo} — "${c.descripcion.slice(0, 50)}" — fecha actual: ${c.fechaUltimaVerificacion!.toISOString().slice(0, 10)}`
    );
  }

  console.log();
  console.log(`Total a resetear: ${aResetear.length} de ${candidatos.length} con proveedor+fecha.`);

  if (modoAplicar) {
    if (aResetear.length > 0) {
      await p.precioMTOP.updateMany({
        where: { id: { in: aResetear.map((c) => c.id) } },
        data: { fechaUltimaVerificacion: null },
      });
      console.log(`\n✓ ${aResetear.length} registros actualizados (fechaUltimaVerificacion = null).`);
    } else {
      console.log("\nNada para aplicar.");
    }
  } else {
    console.log("\nPara aplicar de verdad: npx tsx scripts/limpiar-fecha-verificacion-falsa.ts --apply");
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
