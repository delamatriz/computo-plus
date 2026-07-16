// Fase 2, Etapa 4 — backfill de Capitulo.capituloCatalogoId (capítulos
// reales de proyecto) contra el catálogo canónico. Reusa el alias de
// CAPITULOS_SAU (page.tsx) UNA SOLA VEZ, como script de migración — no
// como dependencia en tiempo de ejecución (eso sigue siendo obtenerMapeoSAU
// en la app, sin cambios en esta etapa).
//
// Modo por defecto: DRY RUN — no escribe nada, solo imprime qué matchea
// con qué y qué queda sin resolver, para revisión manual.
// Modo real: agregar --apply.
//
// Idempotente: si un Capitulo ya tiene capituloCatalogoId seteado (a mano
// o por una corrida anterior), no lo toca — nunca pisa un valor ya resuelto.
//
// Ejecutar (dry-run): npx tsx scripts/backfill-capitulo-catalogo.ts
// Ejecutar (real):     npx tsx scripts/backfill-capitulo-catalogo.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

// Copia exacta de CAPITULOS_SAU (src/app/proyectos/[id]/page.tsx) al
// momento de esta migración — solo la parte relevante para este backfill
// (alias -> capitulos). No se importa desde page.tsx a propósito: es un
// componente de cliente con hooks, no un módulo seguro de importar en un
// script de Node, y el propio diseño de la Etapa 4 pide reusarlo "una
// sola vez, como script de migración", no como dependencia compartida.
type MapeoSAU = { alias: string[]; capitulos: string[] };
const CAPITULOS_SAU: MapeoSAU[] = [
  { alias: ["Implantación y Replanteo", "Trabajos preliminares"], capitulos: ["Implantación y Replanteo"] },
  { alias: ["Excavaciones y Movimiento de Tierra"], capitulos: ["Excavaciones y Movimientos de Tierra"] },
  { alias: ["Movimiento de tierra y fundaciones"], capitulos: ["Excavaciones y Movimientos de Tierra", "Cimentaciones"] },
  { alias: ["Demoliciones y Picados", "Picado de mamposteria", "Picado de mampostería"], capitulos: ["Demoliciones"] },
  { alias: ["Cimentaciones"], capitulos: ["Cimentaciones"] },
  { alias: ["Estructura de Hormigón Armado", "Estructura"], capitulos: ["Estructura"] },
  { alias: ["Albañilería"], capitulos: ["Albañilería"] },
  { alias: ["Mampostería y muros"], capitulos: ["Albañilería"] },
  { alias: ["Revoques y enlucidos"], capitulos: ["Albañilería"] },
  { alias: ["Pisos, Zócalos y Revestimientos", "Revestimientos y pisos"], capitulos: ["Albañilería"] },
  { alias: ["Impermeabilizaciones y Aislaciones"], capitulos: ["Albañilería"] },
  { alias: ["Pinturas", "Pintura"], capitulos: ["Subcontratos - Pinturas"] },
  { alias: ["Carpintería"], capitulos: ["Subcontratos - Carpinterías"] },
  { alias: ["Herrería y metálica", "Herrería y metalica"], capitulos: ["Subcontratos - Carpinterías"] },
  { alias: ["Vidrios y Espejos", "Vidriería"], capitulos: ["Subcontratos - Vidrios"] },
  { alias: ["Yeso y Cielorrasos"], capitulos: ["Subcontratos - Yeso"] },
  { alias: ["Sistemas Constructivos No Tradicionales"], capitulos: ["Sistemas No Tradicionales"] },
  { alias: ["Equipamiento"], capitulos: ["Subcontratos - Acondicionamientos"] },
  { alias: ["Obras exteriores y paisajismo", "Obra Exterior / Jardín", "Obra Exterior y Jardín"], capitulos: ["Subcontratos - Acondicionamientos"] },
  { alias: ["Cubierta / Techos", "Cubierta"], capitulos: ["Cubierta / Techos"] },
  { alias: ["Instalación Sanitaria"], capitulos: ["Instalación Sanitaria"] },
  { alias: ["Instalación Eléctrica"], capitulos: ["Instalación Eléctrica"] },
  { alias: ["Instalación Térmica / Aire Acondicionado", "Instalación Térmica"], capitulos: ["Instalación Térmica / Aire Acondicionado"] },
  { alias: ["Ascensor"], capitulos: ["Ascensor"] },
];

// Mismo criterio de match que obtenerMapeoSAU en page.tsx: exacto por
// alias, case-insensitive, trim.
function resolverAlias(nombreCapitulo: string): MapeoSAU | undefined {
  const norm = nombreCapitulo.trim().toLowerCase();
  return CAPITULOS_SAU.find((m) => m.alias.some((a) => a.toLowerCase() === norm));
}

async function main() {
  const aplicar = process.argv.includes("--apply");

  const [proyectos, catalogos] = await Promise.all([
    db.proyecto.findMany({ include: { capitulos: { orderBy: { orden: "asc" } } } }),
    db.capituloCatalogo.findMany(),
  ]);
  const catalogoPorNombre = new Map(catalogos.map((c) => [c.nombre, c]));

  let matcheados = 0;
  let sinMatch = 0;
  let ambiguos = 0;
  let yaResueltos = 0;
  let actualizados = 0;

  for (const p of proyectos) {
    console.log(`\n=== ${p.nombre} (${p.id}) ===`);
    for (const c of p.capitulos) {
      if (c.capituloCatalogoId) {
        console.log(`  [ya resuelto] "${c.nombre}" -> capituloCatalogoId=${c.capituloCatalogoId} (no se toca)`);
        yaResueltos++;
        continue;
      }

      const mapeo = resolverAlias(c.nombre);
      if (!mapeo) {
        console.log(`  [SIN MATCH] "${c.nombre}" -> capituloCatalogoId: null (sin alias en CAPITULOS_SAU)`);
        sinMatch++;
        continue;
      }
      if (mapeo.capitulos.length > 1) {
        console.log(
          `  [AMBIGUO] "${c.nombre}" -> alias resuelve a ${mapeo.capitulos.length} capítulos (${mapeo.capitulos.join(", ")}) -> capituloCatalogoId: null (no se fuerza un match dudoso)`
        );
        ambiguos++;
        continue;
      }

      const nombreCatalogo = mapeo.capitulos[0];
      const catalogo = catalogoPorNombre.get(nombreCatalogo);
      if (!catalogo) {
        console.log(`  [SIN CATALOGO] "${c.nombre}" -> alias resuelve a "${nombreCatalogo}" pero no existe ese CapituloCatalogo -> capituloCatalogoId: null`);
        sinMatch++;
        continue;
      }

      console.log(`  [match] "${c.nombre}" -> "${nombreCatalogo}" (capituloCatalogoId=${catalogo.id})`);
      matcheados++;

      if (aplicar) {
        await db.capitulo.update({ where: { id: c.id }, data: { capituloCatalogoId: catalogo.id } });
        actualizados++;
      }
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);
  console.log(`Matcheados:        ${matcheados}`);
  console.log(`Sin match (alias): ${sinMatch}`);
  console.log(`Ambiguos:          ${ambiguos}`);
  console.log(`Ya resueltos antes: ${yaResueltos}`);
  if (aplicar) console.log(`Filas actualizadas: ${actualizados}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
