// Fase 2, Etapa 5 — puebla ParticionSubcapitulo con los 7 casos de
// partición ya confirmados en el diagnóstico previo (Albañilería reparte a
// Pisos/Impermeabilizaciones/Muros/Revoques; Subcontratos - Carpinterías
// reparte a Herrería y metálica; Subcontratos - Acondicionamientos reparte
// a Equipamiento/Obra Exterior). NO incluye "Movimiento de tierra y
// fundaciones" (alias → 2 capítulos) — no se usa en ningún proyecto real
// hoy, queda sin cubrir a propósito.
//
// Modo por defecto: DRY RUN. Modo real: --apply.
// Idempotente: upsert por subcapituloId (@unique).
//
// Ejecutar (dry-run): npx tsx scripts/poblar-particion-subcapitulo.ts
// Ejecutar (real):     npx tsx scripts/poblar-particion-subcapitulo.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

type Particion = {
  capituloCatalogo: string;
  capituloRealDestino: string;
  subcapitulos: string[];
};

const PARTICIONES: Particion[] = [
  {
    capituloCatalogo: "Albañilería",
    capituloRealDestino: "Pisos, Zócalos y Revestimientos",
    subcapitulos: ["Pisos, Zócalos y Otros", "Revestimientos", "Contrapisos"],
  },
  {
    capituloCatalogo: "Albañilería",
    capituloRealDestino: "Impermeabilizaciones y Aislaciones",
    subcapitulos: ["Impermeabilizaciones y Aislaciones"],
  },
  {
    capituloCatalogo: "Albañilería",
    capituloRealDestino: "Mampostería y muros",
    subcapitulos: [
      "Elevación de Muros — Ladrillo de Campo",
      "Elevación de Muros — Ticholos",
      "Elevación de Muros — Bloque Hormigón",
      "Elevación de Muros — Ladrillo de Vidrio",
    ],
  },
  {
    capituloCatalogo: "Albañilería",
    capituloRealDestino: "Revoques y enlucidos",
    subcapitulos: [
      "Revoques — Cielorraso",
      "Revoques — Muros Interiores",
      "Revoques — Muros Exteriores",
      "Revoques — Otros",
    ],
  },
  {
    capituloCatalogo: "Subcontratos - Carpinterías",
    capituloRealDestino: "Herrería y metálica",
    subcapitulos: ["Hierro"],
  },
  {
    capituloCatalogo: "Subcontratos - Acondicionamientos",
    capituloRealDestino: "Equipamiento",
    subcapitulos: ["Equipamiento"],
  },
  {
    capituloCatalogo: "Subcontratos - Acondicionamientos",
    capituloRealDestino: "Obra Exterior / Jardín",
    subcapitulos: ["Obra Exterior / Jardín"],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");

  let resueltos = 0;
  let sinMatch = 0;
  let creados = 0;
  let yaExistian = 0;

  for (const p of PARTICIONES) {
    const catalogo = await db.capituloCatalogo.findUnique({ where: { nombre: p.capituloCatalogo } });
    if (!catalogo) {
      console.log(`[SIN CATALOGO] "${p.capituloCatalogo}" no existe -> se saltan sus ${p.subcapitulos.length} subcapítulos`);
      sinMatch += p.subcapitulos.length;
      continue;
    }

    for (const nombreSubcap of p.subcapitulos) {
      const subcapitulo = await db.subcapituloCatalogo.findUnique({
        where: { capituloCatalogoId_nombre: { capituloCatalogoId: catalogo.id, nombre: nombreSubcap } },
      });
      if (!subcapitulo) {
        console.log(`  [SIN SUBCAPITULO] "${p.capituloCatalogo}" :: "${nombreSubcap}" -> no existe en SubcapituloCatalogo`);
        sinMatch++;
        continue;
      }

      const existente = await db.particionSubcapitulo.findUnique({ where: { subcapituloId: subcapitulo.id } });
      const accion = existente
        ? existente.capituloRealDestino === p.capituloRealDestino
          ? "ya existía (igual)"
          : `ya existía (destino distinto: "${existente.capituloRealDestino}" -> se actualiza a "${p.capituloRealDestino}")`
        : "nuevo";

      console.log(
        `  [${accion}] "${p.capituloCatalogo}" :: "${nombreSubcap}" (subcapituloId=${subcapitulo.id}) -> capituloRealDestino="${p.capituloRealDestino}"`
      );
      resueltos++;
      if (existente) yaExistian++;
      else creados++;

      if (aplicar) {
        await db.particionSubcapitulo.upsert({
          where: { subcapituloId: subcapitulo.id },
          create: { subcapituloId: subcapitulo.id, capituloRealDestino: p.capituloRealDestino },
          update: { capituloRealDestino: p.capituloRealDestino },
        });
      }
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);
  console.log(`Resueltos:  ${resueltos}`);
  console.log(`Sin match:  ${sinMatch}`);
  console.log(`Nuevos:     ${creados}`);
  console.log(`Ya existían: ${yaExistian}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
