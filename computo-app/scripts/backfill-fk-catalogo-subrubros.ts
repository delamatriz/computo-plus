// Fase 2, Etapa 2 — backfill de SubrubroEstandar.capituloId/subcapituloId
// contra el catálogo canónico sembrado en la Etapa 1. Match exacto de
// nombre (capitulo string viejo === CapituloCatalogo.nombre) — debe ser
// 1:1 sin excepción, porque el catálogo se generó desde estos mismos
// datos. Las columnas viejas (capitulo/subcapitulo String) NO se tocan.
//
// Idempotente: solo escribe si el valor actual difiere del esperado.
//
// Ejecutar: npx tsx scripts/backfill-fk-catalogo-subrubros.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

async function main() {
  const [subrubros, capitulos, subcapitulos] = await Promise.all([
    p.subrubroEstandar.findMany({ where: { activo: true } }),
    p.capituloCatalogo.findMany(),
    p.subcapituloCatalogo.findMany(),
  ]);

  const capitulosPorNombre = new Map(capitulos.map((c) => [c.nombre, c]));

  let actualizados = 0;
  let yaCorrectos = 0;
  let sinMatchCapitulo = 0;
  let sinMatchSubcapitulo = 0;

  for (const sub of subrubros) {
    const capCatalogo = capitulosPorNombre.get(sub.capitulo);
    if (!capCatalogo) {
      console.warn(`✗ ${sub.codigo} — sin CapituloCatalogo para "${sub.capitulo}"`);
      sinMatchCapitulo++;
      continue;
    }

    let subcapCatalogo: (typeof subcapitulos)[number] | undefined;
    if (sub.subcapitulo) {
      subcapCatalogo = subcapitulos.find(
        (s) => s.capituloCatalogoId === capCatalogo.id && s.nombre === sub.subcapitulo
      );
      if (!subcapCatalogo) {
        console.warn(`✗ ${sub.codigo} — sin SubcapituloCatalogo para "${sub.capitulo}" :: "${sub.subcapitulo}"`);
        sinMatchSubcapitulo++;
        continue;
      }
    }

    const nuevoCapituloId = capCatalogo.id;
    const nuevoSubcapituloId = subcapCatalogo?.id ?? null;

    if (sub.capituloId === nuevoCapituloId && sub.subcapituloId === nuevoSubcapituloId) {
      yaCorrectos++;
      continue;
    }

    await p.subrubroEstandar.update({
      where: { id: sub.id },
      data: { capituloId: nuevoCapituloId, subcapituloId: nuevoSubcapituloId },
    });
    actualizados++;
  }

  console.log("── Resumen ──");
  console.log(`Actualizados:            ${actualizados}`);
  console.log(`Ya estaban correctos:     ${yaCorrectos}`);
  console.log(`Sin match de capítulo:    ${sinMatchCapitulo}`);
  console.log(`Sin match de subcapítulo: ${sinMatchSubcapitulo}`);
  console.log(`Total procesados:         ${subrubros.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
