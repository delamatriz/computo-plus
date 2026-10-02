// Agrega EquipoAPUEstandar (hormigonera, vibrador de inmersión, martillo
// neumático) a APUEstandar existentes de Cimentaciones, Estructura,
// Demoliciones y Albañilería que requieren equipo pesado y todavía no
// lo tienen cargado, en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-equipos-pesados.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

type EquipoDef = { descripcion: string; unidad: string; rendimiento: number };

const HORMIGONERA: EquipoDef = { descripcion: "Hormigonera", unidad: "hs", rendimiento: 0.15 };
const VIBRADOR: EquipoDef = { descripcion: "Vibrador de inmersión", unidad: "hs", rendimiento: 0.10 };
const MARTILLO_NEUMATICO: EquipoDef = { descripcion: "Martillo neumático", unidad: "hs", rendimiento: 0.8 };
const HORMIGONERA_CHICA: EquipoDef = { descripcion: "Hormigonera chica", unidad: "hs", rendimiento: 0.08 };

type Grupo = {
  nombre: string;
  codigos: string[];
  equipos: EquipoDef[];
};

const GRUPOS: Grupo[] = [
  {
    nombre: "Cimentaciones — hormigón in situ",
    codigos: [
      "4.1.1", "4.1.2", "4.1.3", "4.1.4",
      "4.2.1", "4.2.2", "4.2.3", "4.2.4", "4.2.5", "4.2.6", "4.2.7", "4.2.8",
    ],
    equipos: [HORMIGONERA, VIBRADOR],
  },
  {
    nombre: "Estructura — hormigón in situ",
    codigos: ["5.1.1", "5.1.2", "5.1.3", "5.2.4", "5.3.3", "5.3.4", "5.3.5", "5.3.6"],
    equipos: [HORMIGONERA, VIBRADOR],
  },
  {
    nombre: "Estructura — hormigón premezclado",
    codigos: ["5.3.1", "5.3.2"],
    equipos: [VIBRADOR],
  },
  {
    nombre: "Demoliciones de hormigón armado",
    codigos: ["3.1", "3.2", "3.3", "3.7"],
    equipos: [MARTILLO_NEUMATICO],
  },
  {
    nombre: "Albañilería — contrapisos de hormigón",
    codigos: ["6.3.2", "6.3.6", "6.6.3"],
    equipos: [HORMIGONERA_CHICA],
  },
];

async function main() {
  let agregados = 0;
  let yaTenian = 0;
  let sinApu = 0;
  let noEncontrados = 0;

  for (const grupo of GRUPOS) {
    console.log(`\n=== ${grupo.nombre} ===`);
    for (const codigo of grupo.codigos) {
      const subrubro = await p.subrubroEstandar.findUnique({
        where: { codigo },
        include: { apuEstandar: { include: { equipos: true } } },
      });

      if (!subrubro) {
        console.warn(`✗ No se encontró SubrubroEstandar para ${codigo}`);
        noEncontrados++;
        continue;
      }

      if (!subrubro.apuEstandar) {
        console.warn(`✗ ${codigo} (${subrubro.descripcion}) no tiene APUEstandar`);
        sinApu++;
        continue;
      }

      if (subrubro.apuEstandar.equipos.length > 0) {
        console.log(`⊘ ${codigo} (${subrubro.descripcion}) ya tiene equipos cargados — se omite`);
        yaTenian++;
        continue;
      }

      await p.equipoAPUEstandar.createMany({
        data: grupo.equipos.map((eq) => ({
          apuId: subrubro.apuEstandar!.id,
          descripcion: eq.descripcion,
          unidad: eq.unidad,
          rendimiento: eq.rendimiento,
        })),
      });

      console.log(
        `✓ ${codigo} (${subrubro.descripcion}) — agregado: ${grupo.equipos.map((e) => e.descripcion).join(", ")}`
      );
      agregados++;
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Agregados:       ${agregados}`);
  console.log(`Ya tenían equipo: ${yaTenian}`);
  console.log(`Sin APU:         ${sinApu}`);
  console.log(`No encontrados:  ${noEncontrados}`);
  console.log(`Total definidos: ${GRUPOS.reduce((acc, g) => acc + g.codigos.length, 0)}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
