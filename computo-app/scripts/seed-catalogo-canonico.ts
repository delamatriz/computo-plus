// Fase 2, Etapa 1 — siembra el catálogo canónico (CapituloCatalogo /
// SubcapituloCatalogo) desde los valores REALES hoy en SubrubroEstandar
// (activo: true). Puramente aditivo: nada en la app lee estas tablas
// todavía — eso llega en etapas posteriores (ver
// FASE2-DISENO-UNIFICACION-TAXONOMIAS.md).
//
// Nota: la auditoría original (sesión previa) relevó 31 combinaciones
// (capitulo, subcapitulo). Entre esa auditoría y esta siembra se agregó
// Patología de Fachada, se movieron 6 códigos fuera de Acondicionamientos
// (creando el capítulo "Ascensor" y sumando subcapítulos a Instalación
// Sanitaria/Eléctrica/Térmica — sin nuevos subcapítulos ahí) y se separó
// Equipamiento/Obra Exterior dentro de Acondicionamientos. El conteo real
// al día de hoy es 18 capítulos / 46 combinaciones (34 con subcapítulo
// real + 12 capítulos sin subcapítulo, contados una vez cada uno). Este
// script siembra desde la realidad actual, no desde el número viejo.
//
// Idempotente vía upsert.
//
// Ejecutar: npx tsx scripts/seed-catalogo-canonico.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

async function main() {
  const subrubros = await p.subrubroEstandar.findMany({
    where: { activo: true },
    select: { capitulo: true, subcapitulo: true },
  });

  const capitulosUnicos = [...new Set(subrubros.map((s) => s.capitulo))].sort();

  const subcapitulosPorCapitulo = new Map<string, Set<string>>();
  subrubros.forEach((s) => {
    if (!s.subcapitulo) return;
    if (!subcapitulosPorCapitulo.has(s.capitulo)) subcapitulosPorCapitulo.set(s.capitulo, new Set());
    subcapitulosPorCapitulo.get(s.capitulo)!.add(s.subcapitulo);
  });

  let capitulosCreados = 0;
  let capitulosExistentes = 0;
  let subcapitulosCreados = 0;
  let subcapitulosExistentes = 0;

  for (let i = 0; i < capitulosUnicos.length; i++) {
    const nombre = capitulosUnicos[i];

    const capExistente = await p.capituloCatalogo.findUnique({ where: { nombre } });
    const cap = capExistente
      ? capExistente
      : await p.capituloCatalogo.create({ data: { nombre, orden: i } });

    if (capExistente) {
      capitulosExistentes++;
      console.log(`= CapituloCatalogo "${nombre}" ya existe`);
    } else {
      capitulosCreados++;
      console.log(`+ CapituloCatalogo creado: "${nombre}"`);
    }

    const subcaps = [...(subcapitulosPorCapitulo.get(nombre) ?? [])].sort();
    for (let j = 0; j < subcaps.length; j++) {
      const subNombre = subcaps[j];
      const subExistente = await p.subcapituloCatalogo.findUnique({
        where: { capituloCatalogoId_nombre: { capituloCatalogoId: cap.id, nombre: subNombre } },
      });
      if (subExistente) {
        subcapitulosExistentes++;
        console.log(`  = SubcapituloCatalogo "${subNombre}" ya existe`);
      } else {
        await p.subcapituloCatalogo.create({
          data: { capituloCatalogoId: cap.id, nombre: subNombre, orden: j },
        });
        subcapitulosCreados++;
        console.log(`  + SubcapituloCatalogo creado: "${subNombre}"`);
      }
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Capítulos:    ${capitulosCreados} creados, ${capitulosExistentes} ya existían (total ${capitulosUnicos.length})`);
  console.log(`Subcapítulos: ${subcapitulosCreados} creados, ${subcapitulosExistentes} ya existían`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
