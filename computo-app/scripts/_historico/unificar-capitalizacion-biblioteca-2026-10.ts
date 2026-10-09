// Biblioteca — unifica la capitalización de SubrubroEstandar.descripcion
// (activos e inactivos) a "oración": primera letra en mayúscula, el resto en
// minúscula, respetando siglas, unidades, medidas y marcas (regla de Luis,
// oct-2026). La regla y sus listas viven en src/lib/capitalizarDescripcion.ts,
// la misma que usa el presupuesto al mostrar descripciones.
//
// Marca con ⚠ los casos que la regla no puede resolver con certeza (posibles
// siglas o marcas no listadas); se convierten igual, el ⚠ es para revisarlos.
//
// Solo cambia descripcion. No toca códigos, capítulos, notas internas,
// materiales ni ningún otro modelo. Los rubros de proyectos son copias y no
// cambian.
//
// Idempotente: aplicar la regla dos veces da lo mismo (se comprueba antes de
// escribir).
//
// Ejecutar (dry-run): npx tsx scripts/unificar-capitalizacion-biblioteca-2026-10.ts
//   (con --todos lista todos los cambios, no solo los primeros 20)
// Ejecutar (real):     npx tsx scripts/unificar-capitalizacion-biblioteca-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { capitalizarConDudas } from "../src/lib/capitalizarDescripcion";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

async function main() {
  const aplicar = process.argv.includes("--apply");
  const todos = process.argv.includes("--todos");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const subs = await db.subrubroEstandar.findMany({ select: { id: true, codigo: true, descripcion: true, activo: true } });
  subs.sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  // Primera pasada: siglas no listadas que aparecen en descripciones que NO
  // están todas en mayúscula (ahí se distinguen); en la segunda se marcan
  // también dentro de descripciones en mayúsculas.
  const siglasDetectadas = new Set<string>();
  for (const s of subs) {
    for (const d of capitalizarConDudas(s.descripcion).dudas) {
      const m = d.match(/^«(.+)» parece sigla no listada$/);
      if (m) siglasDetectadas.add(m[1].toLocaleUpperCase("es"));
    }
  }

  const cambios: { id: string; codigo: string; activo: boolean; antes: string; despues: string; dudas: string[] }[] = [];
  let conDudasSinCambio = 0;
  for (const s of subs) {
    const { texto, dudas } = capitalizarConDudas(s.descripcion, siglasDetectadas);
    const otra = capitalizarConDudas(texto).texto;
    if (otra !== texto) throw new Error(`La regla no es estable en ${s.codigo}: «${texto}» → «${otra}» — no se escribe nada`);
    if (texto !== s.descripcion) cambios.push({ id: s.id, codigo: s.codigo, activo: s.activo, antes: s.descripcion, despues: texto, dudas });
    else if (dudas.length) conDudasSinCambio++;
  }

  const conDudas = cambios.filter((c) => c.dudas.length > 0);
  const mostrar = todos ? cambios : cambios.slice(0, 20);
  console.log(`── ${todos ? "Todos los cambios" : "Primeros 20 cambios"} ──`);
  for (const c of mostrar) {
    console.log(`${c.dudas.length ? "⚠ " : "  "}${c.codigo.padEnd(8)}${c.activo ? "" : "[inactivo] "}«${c.antes}»\n${" ".repeat(10)}→ «${c.despues}»${c.dudas.length ? `\n${" ".repeat(10)}  ${c.dudas.join("; ")}` : ""}`);
  }

  console.log(`\n── ⚠ A revisar (${conDudas.length}) ──`);
  for (const c of conDudas) console.log(`  ${c.codigo.padEnd(8)}«${c.antes}»\n${" ".repeat(10)}→ «${c.despues}» — ${c.dudas.join("; ")}`);

  const activos = subs.filter((s) => s.activo).length;
  console.log(
    `\nTotal subrubros: ${subs.length} (${activos} activos, ${subs.length - activos} inactivos)` +
      `\nCambian: ${cambios.length} · Quedan iguales: ${subs.length - cambios.length} · Con ⚠: ${conDudas.length}` +
      (conDudasSinCambio ? ` (+${conDudasSinCambio} sin cambio con ⚠)` : "")
  );

  if (cambios.length === 0) {
    console.log("\n= Ya está todo aplicado. Sin cambios.");
    await db.$disconnect();
    return;
  }
  if (aplicar) {
    await db.$transaction(async (tx) => {
      for (const c of cambios) {
        const r = await tx.subrubroEstandar.updateMany({ where: { id: c.id, descripcion: c.antes }, data: { descripcion: c.despues } });
        if (r.count !== 1) throw new Error(`${c.codigo} cambió mientras tanto — se aborta todo`);
      }
    }, { timeout: 180000 });
  }
  console.log(aplicar ? "\nAPLICADO." : "\nDRY RUN: no se escribió nada. Para aplicar: --apply (con el OK de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
