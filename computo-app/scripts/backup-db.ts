// Dump completo de la base de producción (pg_dump) — capa extra de seguridad
// además del backup automático de Render (PITR + export lógico, retención
// 7 días). Pensado para correr a mano antes de cambios grandes en el
// esquema o los datos (migraciones, scripts de corrección masiva, etc.).
//
// Ejecutar:
//   npx tsx scripts/backup-db.ts
//
// Requiere pg_dump (PostgreSQL 18 client tools). Si no está en el PATH,
// definí PG_DUMP_PATH con la ruta completa al ejecutable.
//
// El archivo queda en computo-app/backups/, con fecha y hora en el nombre.
// Para restaurar, ver el procedimiento en CURRENT_SPRINT.md.

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✗ Falta DATABASE_URL en el entorno (.env)");
  process.exit(1);
}

function resolverPgDump(): string {
  if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH;
  const candidatosWindows = [
    "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe",
  ];
  for (const candidato of candidatosWindows) {
    if (existsSync(candidato)) return candidato;
  }
  return "pg_dump"; // asume que está en el PATH (Linux/Mac, o Windows con PATH ya configurado)
}

const backupsDir = path.join(__dirname, "..", "backups");
mkdirSync(backupsDir, { recursive: true });

const fecha = new Date().toISOString().replace(/:/g, "-").slice(0, 19); // 2026-07-10T22-15-00
const archivo = path.join(backupsDir, `computo-plus-${fecha}.sql`);
const pgDump = resolverPgDump();

console.log(`Base: ${DATABASE_URL.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@")}`);
console.log(`Herramienta: ${pgDump}`);
console.log(`Iniciando dump completo → ${archivo}\n`);

const resultado = spawnSync(
  pgDump,
  ["--format=plain", "--no-owner", "--no-privileges", "--file", archivo, DATABASE_URL],
  { stdio: "inherit" }
);

if (resultado.error) {
  console.error(`\n✗ No se pudo ejecutar pg_dump: ${resultado.error.message}`);
  console.error("  Verificá que esté instalado, o definí PG_DUMP_PATH con la ruta completa.");
  process.exit(1);
}

if (resultado.status !== 0) {
  console.error(`\n✗ pg_dump terminó con error (código ${resultado.status}) — revisá el detalle arriba.`);
  process.exit(resultado.status ?? 1);
}

console.log(`\n✓ Backup completo — ${archivo}`);
