// Biblioteca — textos de "Limpieza y Retiro de Obra" (28.1, 28.3, 28.5, 28.6,
// 28.7, 28.9): descripción apta para imprimir al cliente + notas internas.
// SOLO texto: no toca precioUY, rendimientos, insumos, APU ni las
// descripciones de los materiales (IMPL-013, LIMP-001, LIMP-002,
// MAT-INSUMOS-LIMPIEZA-FINAL), ni los rubros 28.2, 28.4 y 28.8, ni 7.14.4 /
// 1.11. Tampoco toca los Rubros ya clonados en proyectos: el texto se copia
// al clonar, no hay vínculo vivo (el vínculo Biblioteca → proyecto es por
// subrubroId, y solo para el APU).
//
// Dónde va cada cosa:
//   - descripcion: viaja a Rubro.descripcion al clonar y SALE IMPRESA en el
//     presupuesto, así que describe el alcance — sin instrucciones al usuario
//     ni códigos de subrubro.
//   - notasInternas (SubrubroEstandar.notasInternas): advertencias para quien
//     arma el presupuesto. Se ven solo como tooltip en el panel "Ver
//     subrubros típicos"; no se copian al rubro ni salen en ningún documento.
//
// Riesgos que cubren (relevamiento oct-2026): 28.5 / 28.6 / 28.7 se pueden
// sumar y cobrar dos veces lo mismo; 28.3 usa una volqueta de 6 m³ (capacidad
// estándar en plaza, confirmado por Luis); 28.1 depende del tamaño de obra.
//
// Idempotente: actualiza solo los campos que difieren (segunda corrida =
// nada). Si `notasInternas` no figura para un código, NO se toca. Si un código
// no existe, avisa y NO lo crea. Mantener sincronizado con las descripciones y
// notas de seed-limpieza-retiro-obra-2026-10.ts, para que volver a correr
// aquel seed no revierta estos textos.
//
// Ejecutar (dry-run): npx tsx scripts/textos-limpieza-retiro-obra-2026-10.ts
// Ejecutar (real):     npx tsx scripts/textos-limpieza-retiro-obra-2026-10.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const NOTA_NO_SUMAR = "No sumar si ya se presupuestó la limpieza final de obra (28.7), que ya incluye este trabajo.";

const TEXTOS: { codigo: string; descripcion: string; notasInternas?: string }[] = [
  {
    codigo: "28.1",
    descripcion: "Limpieza periódica de obra — mantenimiento mensual",
    notasInternas:
      "Para reforma u obra de varios meses: 10 jornadas de peón por mes. En una reparación puntual de 1 a 2 días usar 28.9 (limpieza por jornada) en lugar de ajustar este rubro.",
  },
  {
    codigo: "28.3",
    descripcion: "Retiro de escombros (carga manual y volqueta de 6 m³, capacidad estándar en plaza)",
    notasInternas:
      "El m³ se mide suelto: el volumen que ocupa el material ya cargado en la volqueta, no en banco. Si la cantidad sale de los planos (volumen del elemento demolido), aplicar el factor de esponjamiento del material: el volumen suelto es mayor y la volqueta se llena antes.",
  },
  {
    codigo: "28.5",
    descripcion: "Limpieza de vidrios y aberturas — trabajo puntual, distinto de la limpieza final de obra",
    notasInternas: NOTA_NO_SUMAR,
  },
  {
    codigo: "28.6",
    descripcion: "Limpieza fina de pisos — trabajo puntual, distinto de la limpieza final de obra",
    notasInternas: NOTA_NO_SUMAR,
  },
  {
    codigo: "28.7",
    descripcion:
      "Limpieza final de obra (entrega) — incluye pisos, vidrios, aberturas y sanitarios; no incluye retiro de escombros ni de sobrantes",
  },
  // 28.9 se CREA con seed-limpieza-retiro-obra-2026-10.ts (--solo=28.9): este
  // script no crea rubros, solo mantiene su texto y su nota.
  {
    codigo: "28.9",
    descripcion: "Limpieza de obra — por jornada",
    notasInternas:
      "Para reparaciones puntuales de 1 a 2 días: cargar la cantidad de jornadas. En obras de varios meses usar 28.1 (limpieza periódica). No sumar ambos.",
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  let cambios = 0;
  for (const t of TEXTOS) {
    const s = await db.subrubroEstandar.findUnique({ where: { codigo: t.codigo } });
    if (!s) {
      console.warn(`  ⚠ ${t.codigo} no existe — se omite (este script no crea rubros)`);
      continue;
    }
    const cambiaDescripcion = s.descripcion !== t.descripcion;
    const cambiaNota = t.notasInternas !== undefined && s.notasInternas !== t.notasInternas;
    if (!cambiaDescripcion && !cambiaNota) {
      console.log(`  = ${t.codigo} ya está al día`);
      continue;
    }
    cambios++;
    console.log(`  ~ ${t.codigo}  (precioUY $${s.precioUY}/${s.unidad}, no se toca)`);
    if (cambiaDescripcion) {
      console.log(`      descripción antes:   ${s.descripcion}`);
      console.log(`      descripción después: ${t.descripcion}  [${t.descripcion.length} caracteres]`);
    }
    if (cambiaNota) {
      console.log(`      nota interna antes:   ${s.notasInternas ?? "(vacía)"}`);
      console.log(`      nota interna después: ${t.notasInternas}`);
    }
    if (aplicar) {
      // update por codigo (único) y SOLO los campos que cambian
      await db.subrubroEstandar.update({
        where: { codigo: t.codigo },
        data: {
          ...(cambiaDescripcion && { descripcion: t.descripcion }),
          ...(cambiaNota && { notasInternas: t.notasInternas }),
        },
      });
    }
  }

  console.log(`\nRubros a cambiar: ${cambios}${aplicar ? " (aplicados)" : ""}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
