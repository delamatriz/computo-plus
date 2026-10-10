// Multi-tenant (oct-2026) — backfill de LogConsumoIA.empresaId.
//
// Reglas, solo para filas con empresaId en null:
//  - Con proyectoId: la empresa del proyecto (Proyecto.empresaId).
//  - Sin proyectoId: DE LA MATRIZ (única empresa antes del multi-tenant).
//  - Con proyectoId de un proyecto que ya no existe (LogConsumoIA.proyectoId
//    no es FK, los proyectos de prueba borrados dejan logs huérfanos): también
//    DE LA MATRIZ, por la misma razón. Se listan aparte en el resumen.
//  - Con proyecto sin empresaId (Proyecto.empresaId es nullable): ídem.
//
// Idempotente: cada updateMany filtra por empresaId null, así que una segunda
// corrida da 0 cambios y nunca pisa un log ya asignado.
//
// Ejecutar (dry-run, no escribe nada):  npx tsx scripts/backfill-logs-ia-empresa.ts
// Ejecutar (real):                       npx tsx scripts/backfill-logs-ia-empresa.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(aplicar ? "Modo: APPLY (escribe en la base)" : "Modo: DRY-RUN (no escribe nada)");

  const empresas = await db.empresa.findMany({
    where: { nombre: { contains: "De La Matriz", mode: "insensitive" } },
    select: { id: true, nombre: true, slug: true },
  });
  if (empresas.length !== 1) {
    console.error(`Se esperaba 1 empresa "De La Matriz", hay ${empresas.length}:`, empresas);
    process.exitCode = 1;
    return;
  }
  const matriz = empresas[0];
  console.log(`Empresa por defecto: ${matriz.nombre} (slug=${matriz.slug ?? "—"}, id=${matriz.id})`);

  const total = await db.logConsumoIA.count();
  const logs = await db.logConsumoIA.findMany({
    where: { empresaId: null },
    select: { id: true, proyectoId: true },
  });
  console.log(`LogConsumoIA: ${total} en total, ${logs.length} sin empresaId`);
  if (logs.length === 0) {
    console.log("Nada que hacer.");
    return;
  }

  const proyectoIds = [...new Set(logs.map((l) => l.proyectoId).filter((id): id is string => !!id))];
  const proyectos = await db.proyecto.findMany({
    where: { id: { in: proyectoIds } },
    select: { id: true, nombre: true, empresaId: true },
  });
  const proyectoPorId = new Map(proyectos.map((p) => [p.id, p]));

  // empresaId destino → ids de log
  const destino = new Map<string, string[]>();
  const agregar = (empresaId: string, logId: string) => {
    const lista = destino.get(empresaId) ?? [];
    lista.push(logId);
    destino.set(empresaId, lista);
  };
  let sinProyecto = 0;
  let huerfanos = 0;
  let proyectosSinEmpresa = 0;
  const proyectosHuerfanos = new Set<string>();
  for (const log of logs) {
    if (!log.proyectoId) {
      sinProyecto++;
      agregar(matriz.id, log.id);
      continue;
    }
    const proyecto = proyectoPorId.get(log.proyectoId);
    if (!proyecto) {
      huerfanos++;
      proyectosHuerfanos.add(log.proyectoId);
      agregar(matriz.id, log.id);
      continue;
    }
    if (!proyecto.empresaId) {
      proyectosSinEmpresa++;
      agregar(matriz.id, log.id);
      continue;
    }
    agregar(proyecto.empresaId, log.id);
  }

  const nombresEmpresa = new Map(
    (await db.empresa.findMany({ where: { id: { in: [...destino.keys()] } }, select: { id: true, nombre: true } })).map(
      (e) => [e.id, e.nombre]
    )
  );

  console.log(`  - Sin proyectoId → ${matriz.nombre}: ${sinProyecto}`);
  console.log(`  - Con proyecto existente: ${logs.length - sinProyecto - huerfanos} (${proyectos.length} proyectos)`);
  console.log(`    de esos, proyecto sin empresaId → ${matriz.nombre}: ${proyectosSinEmpresa}`);
  console.log(`  - Con proyecto borrado → ${matriz.nombre}: ${huerfanos} (${proyectosHuerfanos.size} proyectoId huérfanos)`);
  console.log("Asignación por empresa:");
  for (const [empresaId, ids] of destino) {
    console.log(`  - ${nombresEmpresa.get(empresaId) ?? empresaId}: ${ids.length} logs`);
  }

  if (!aplicar) {
    console.log(`\nDry-run: se asignarían ${logs.length} logs. Correr con --apply para escribir.`);
    return;
  }

  let escritos = 0;
  for (const [empresaId, ids] of destino) {
    const r = await db.logConsumoIA.updateMany({
      where: { id: { in: ids }, empresaId: null },
      data: { empresaId },
    });
    escritos += r.count;
  }
  console.log(`\n✓ ${escritos} logs asignados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
