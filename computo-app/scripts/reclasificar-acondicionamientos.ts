// Reclasifica los 32 subrubros de "Subcontratos - Acondicionamientos" —
// hoy todos con subcapitulo=null, mezclando en un solo balde equipamiento
// de baño/cocina (interior) con césped/piscina/deck (exterior), y además
// 6 códigos que ni siquiera son ni una cosa ni la otra (pertenecen a
// Instalación Sanitaria/Eléctrica/Térmica/Ascensor). Ver diagnóstico y
// confirmación del usuario, sesión 15/07/2026.
//
// PASO A — mover a su capítulo real (no son Equipamiento ni Obra
// Exterior/Jardín, están en el capítulo equivocado por completo):
//   7.2.8  (Cámara de inspección)      → Instalación Sanitaria
//   7.2.17 (Puesta eléctrica/datos)    → Instalación Eléctrica
//   7.2.19, 7.2.20 (Equipos Split)     → Instalación Térmica / Aire Acondicionado
//   7.2.30, 7.2.31 (Ascensores)        → Ascensor
// Verificado antes de mover: ninguno de los 6 está clonado en un Rubro
// de HOGAR ni Matisse Monet (sin impacto en proyectos reales).
//
// PASO B — de los 26 restantes que sí quedan en "Subcontratos -
// Acondicionamientos", setear subcapitulo para separar limpio:
//   "Equipamiento" (19) — sanitario, cocina, mesadas, artefactos fijos
//   "Obra Exterior / Jardín" (7) — césped, deck, piscina, toldo, etc.
//
// Idempotente: cada paso chequea el valor actual antes de escribir.
//
// Ejecutar: npx tsx scripts/reclasificar-acondicionamientos.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const MOVER: { codigo: string; capitulo: string }[] = [
  { codigo: "7.2.8", capitulo: "Instalación Sanitaria" },
  { codigo: "7.2.17", capitulo: "Instalación Eléctrica" },
  { codigo: "7.2.19", capitulo: "Instalación Térmica / Aire Acondicionado" },
  { codigo: "7.2.20", capitulo: "Instalación Térmica / Aire Acondicionado" },
  { codigo: "7.2.30", capitulo: "Ascensor" },
  { codigo: "7.2.31", capitulo: "Ascensor" },
];

const EQUIPAMIENTO_CODIGOS = [
  "7.2.1", "7.2.2", "7.2.3", "7.2.4", "7.2.5", "7.2.6",
  "7.2.10", "7.2.11", "7.2.12", "7.2.13", "7.2.14", "7.2.15", "7.2.16",
  "equip-001", "equip-002", "equip-003",
  "7.2.18", "7.2.21", "7.2.22",
];

const OBRA_EXTERIOR_CODIGOS = ["7.2.23", "7.2.24", "7.2.25", "7.2.26", "7.2.27", "7.2.28", "7.2.29"];

async function moverACapituloReal() {
  for (const { codigo, capitulo } of MOVER) {
    const existente = await p.subrubroEstandar.findUnique({ where: { codigo } });
    if (!existente) {
      console.warn(`✗ ${codigo} no encontrado — se omite`);
      continue;
    }
    if (existente.capitulo === capitulo) {
      console.log(`= ${codigo} ya está en "${capitulo}"`);
      continue;
    }
    await p.subrubroEstandar.update({
      where: { codigo },
      data: { capitulo, subcapitulo: null },
    });
    console.log(`+ ${codigo} movido: "${existente.capitulo}" → "${capitulo}"`);
  }
}

async function setSubcapitulo(codigos: string[], subcapitulo: string) {
  for (const codigo of codigos) {
    const existente = await p.subrubroEstandar.findUnique({ where: { codigo } });
    if (!existente) {
      console.warn(`✗ ${codigo} no encontrado — se omite`);
      continue;
    }
    if (existente.subcapitulo === subcapitulo) {
      console.log(`= ${codigo} ya tiene subcapitulo "${subcapitulo}"`);
      continue;
    }
    await p.subrubroEstandar.update({
      where: { codigo },
      data: { subcapitulo },
    });
    console.log(`+ ${codigo} → subcapitulo "${subcapitulo}"`);
  }
}

async function main() {
  console.log("=== PASO A: mover a capítulo real ===");
  await moverACapituloReal();

  console.log("\n=== PASO B: subcapitulo \"Equipamiento\" ===");
  await setSubcapitulo(EQUIPAMIENTO_CODIGOS, "Equipamiento");

  console.log("\n=== PASO B: subcapitulo \"Obra Exterior / Jardín\" ===");
  await setSubcapitulo(OBRA_EXTERIOR_CODIGOS, "Obra Exterior / Jardín");

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
