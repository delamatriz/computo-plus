// Primer EventoSistema — anuncia el lanzamiento del panel de
// notificaciones (campanita del Header) recién implementado.
//
// Alta manual, sin formulario de UI (ver modelo EventoSistema en
// schema.prisma) — se ejecuta una vez y no hace falta idempotencia.
//
// Ejecutar: npx tsx scripts/seed-evento-notificaciones-activadas.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

async function main() {
  const evento = await db.eventoSistema.create({
    data: {
      titulo: "Sistema de notificaciones activado",
      descripcion:
        "Ahora podés ver acá los avisos importantes del sistema y los materiales que necesitan tu revisión.",
    },
  });
  console.log("EventoSistema creado:", evento);
  await db.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
