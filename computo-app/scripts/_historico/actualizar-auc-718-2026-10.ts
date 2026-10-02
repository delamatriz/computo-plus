// LeyesSociales.aucPct — 71,4% → 71,8% en proyectos existentes.
//
// Fuente: Decreto 341/018 (BPS / MTSS), AUC 71,8% desde noviembre de 2018
// (cargas salariales 29,9%). Verificado oct-2026. El default viejo (0.714,
// valor de 2017) había quedado en el modelo; el default nuevo vive en
// schema.prisma (@default(0.718)) y en src/lib/auc.ts (AUC_PCT_DEFAULT).
//
// SOLO toca las filas que tienen EXACTAMENTE 0.714 (el default viejo): un
// valor distinto (personalizado a mano) no se pisa. Idempotente — después de
// aplicar, esas filas valen 0.718 y una segunda corrida no encuentra nada.
// El AUC es solo informativo (no entra al precio de ningún rubro), así que
// este script no cambia Costo Total ni Precio Final de ningún proyecto.
//
// No toca APU.aportesPatronalesPct ni los aportes patronales de LeyesSociales
// (FOCER, FSC/FOCAP, FOSVOC, FRL, Fondo de Garantía, SNIS adicional).
//
// Ejecutar (dry-run): npx tsx scripts/actualizar-auc-718-2026-10.ts
// Ejecutar (real):     npx tsx scripts/actualizar-auc-718-2026-10.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const AUC_VIEJO = 0.714;
const AUC_NUEVO = 0.718;

const fmt = (n: number) => Math.round(n).toLocaleString("es-UY");

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const filas = await db.leyesSociales.findMany({
    include: { proyecto: { select: { nombre: true } } },
    orderBy: { proyecto: { nombre: "asc" } },
  });

  const afectadas = filas.filter((f) => f.aucPct === AUC_VIEJO);
  console.log("── LeyesSociales ──");
  for (const f of filas) {
    const accion = f.aucPct === AUC_VIEJO ? "→ se actualiza" : f.aucPct === AUC_NUEVO ? "= ya está en 71,8%" : "· personalizado, NO se toca";
    const antes = f.montoImponibleMO * f.aucPct;
    const despues = f.montoImponibleMO * AUC_NUEVO;
    console.log(
      `  ${f.proyecto.nombre.trim().padEnd(38)} aucPct ${f.aucPct}  ${accion}` +
        (f.aucPct === AUC_VIEJO ? `   AUC informativo $${fmt(antes)} → $${fmt(despues)} (+$${fmt(despues - antes)})` : "")
    );
  }
  console.log(`\nFilas afectadas: ${afectadas.length} de ${filas.length}`);

  if (aplicar && afectadas.length > 0) {
    // where con el valor leído: si alguien lo editó entre la lectura y la
    // escritura, esa fila no se pisa.
    let n = 0;
    for (const f of afectadas) {
      const r = await db.leyesSociales.updateMany({ where: { id: f.id, aucPct: AUC_VIEJO }, data: { aucPct: AUC_NUEVO } });
      n += r.count;
    }
    console.log(`Actualizadas: ${n}`);
  } else if (aplicar) {
    console.log("Nada para actualizar.");
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
