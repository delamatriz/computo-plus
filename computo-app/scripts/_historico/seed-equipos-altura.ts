// Agrega EquipoAPUEstandar (Andamio tubular) a los APUEstandar de subrubros
// que típicamente requieren trabajo en altura/fachada (revoques exteriores,
// pintura exterior, cubierta, cerco perimetral), en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-equipos-altura.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const ANDAMIO_TUBULAR = { descripcion: "Andamio tubular", unidad: "hs", rendimiento: 0.15 };

const CODIGOS = [
  "6.2.9", // REVOQUE GRUESO MURO EXTERIOR
  "6.2.10", // REVOQUE FINO MURO EXTERIOR
  "6.2.11", // BALAI EN FACHADA
  "6.2.8", // CAPA HIDROFUGADA MURO EXTERIOR
  "7.1.14", // PINTURA LATEX MURO EXTERIOR
  "7.1.15", // PINTURA LATEX SIN ENDUIDO MURO EXTERIOR
  "7.1.2", // ENDUIDO PLÁSTICO TECHOS EXTERIORES
  "7.1.4", // ENDUIDO PLÁSTICO MUROS EXTERIORES
  "cubierta-001",
  "cubierta-002",
  "cubierta-003",
  "cubierta-004",
  "cubierta-005",
  "cubierta-006",
  "1.3", // CERCO TEJIDO GALVANIZADO
];

async function main() {
  let agregados = 0;
  let yaTenian = 0;
  let sinApu = 0;
  let noEncontrados = 0;

  for (const codigo of CODIGOS) {
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

    const yaTiene = subrubro.apuEstandar.equipos.some(
      (e) => e.descripcion.trim().toLowerCase() === ANDAMIO_TUBULAR.descripcion.toLowerCase()
    );

    if (yaTiene) {
      console.log(`⊘ ${codigo} (${subrubro.descripcion}) ya tiene andamio cargado — se omite`);
      yaTenian++;
      continue;
    }

    await p.equipoAPUEstandar.create({
      data: {
        apuId: subrubro.apuEstandar.id,
        descripcion: ANDAMIO_TUBULAR.descripcion,
        unidad: ANDAMIO_TUBULAR.unidad,
        rendimiento: ANDAMIO_TUBULAR.rendimiento,
      },
    });

    console.log(`✓ ${codigo} (${subrubro.descripcion}) — agregado: ${ANDAMIO_TUBULAR.descripcion}`);
    agregados++;
  }

  console.log("\n── Resumen ──");
  console.log(`Agregados:       ${agregados}`);
  console.log(`Ya tenían andamio: ${yaTenian}`);
  console.log(`Sin APU:         ${sinApu}`);
  console.log(`No encontrados:  ${noEncontrados}`);
  console.log(`Total definidos: ${CODIGOS.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
