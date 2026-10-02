// Lista estándar del wizard (CapituloEstandar) — orden final, sin huecos ni
// duplicados. Esta lista es la FUENTE DE VERDAD del orden: correr el script
// de nuevo siempre converge al mismo resultado.
//
// Cambios respecto del estado anterior (30 capítulos, posiciones 1-30):
//   + Estructura Metálica, Cortinas de Enrollar, Alarmas, Domótica (existían
//     solo en la Biblioteca; mismos nombres exactos de CapituloCatalogo, así
//     que resuelven por nombre sin alias).
//   + Limpieza y Retiro de Obra (nuevo, ÚLTIMO). Requiere correr antes
//     seed-limpieza-retiro-obra-2026-10.ts para que exista en la Biblioteca.
//   - Honorarios Profesionales, Derechos de Construcción y Permisos,
//     Conexiones de Servicios, Gastos Generales de Obra: cáscaras vacías sin
//     Biblioteca (esos conceptos viven en Gastos Generales Detallado, ver
//     ITEMS_SUGERIDOS_GASTOS_ADMIN en gastosGenerales.ts).
//
//   - Imprevistos (oct-2026, segunda corrida de este mismo script): pasó de
//     capítulo vacío sin Biblioteca a un % dentro de Gastos Generales
//     (Proyecto.imprevistosPct, ver calcularCostosIndirectosAgregados). La
//     lista queda en 30 capítulos. Los capítulos "Imprevistos" ya creados
//     en proyectos existentes no se tocan: esto es solo el catálogo.
//
// Nota: seed-capitulos-nuevos.ts (el de la carga original 21-30) hace upsert
// de esos 4 — NO volver a correrlo, los resucitaría. Este script es el que
// manda.
//
// CapituloEstandar es solo una lista de nombres para ofrecer en el wizard:
// los capítulos ya creados en proyectos reales no tienen FK a esta tabla,
// así que ni el reordenado ni el borrado los afecta.
//
// Ejecutar (dry-run): npx tsx scripts/seed-capitulos-estandar-orden-2026-10.ts
// Ejecutar (real):     npx tsx scripts/seed-capitulos-estandar-orden-2026-10.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { obtenerMapeoSAU } from "../src/lib/capitulosSau";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const ORDEN_FINAL = [
  "Implantación y Replanteo",
  "Excavaciones y Movimiento de Tierra",
  "Demoliciones y Picados",
  "Cimentaciones",
  "Estructura de Hormigón Armado",
  "Estructura Metálica",
  "Albañilería",
  "Pisos, Zócalos y Revestimientos",
  "Impermeabilizaciones y Aislaciones",
  "Cubierta / Techos",
  "Instalación Sanitaria",
  "Instalación Eléctrica",
  "Alarmas",
  "Domótica",
  "Instalación Térmica / Aire Acondicionado",
  "Carpintería",
  "Cortinas de Enrollar",
  "Vidrios y Espejos",
  "Yeso y Cielorrasos",
  "Pinturas",
  "Equipamiento",
  "Sistemas Constructivos No Tradicionales",
  "Obra Exterior / Jardín",
  "Instalación de Gas",
  "Instalación Contra Incendio",
  "Ascensor",
  "Ensayo de Suelos",
  "Seguridad y Trabajos en Altura",
  "Instalación Energías Renovables",
  "Limpieza y Retiro de Obra",
];

const ELIMINAR = [
  "Honorarios Profesionales",
  "Derechos de Construcción y Permisos",
  "Conexiones de Servicios",
  "Gastos Generales de Obra",
  "Imprevistos",
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  if (new Set(ORDEN_FINAL).size !== ORDEN_FINAL.length) throw new Error("ORDEN_FINAL tiene nombres duplicados");

  const catalogo = await db.capituloCatalogo.findMany();
  const nombresCatalogo = new Set(catalogo.map((c) => c.nombre));
  const actuales = await db.capituloEstandar.findMany();
  const actualPorNombre = new Map(actuales.map((c) => [c.nombre, c]));

  console.log("── Orden final ──");
  ORDEN_FINAL.forEach((nombre, i) => {
    const orden = i + 1;
    const previo = actualPorNombre.get(nombre);
    const estado = !previo ? "+ nuevo" : previo.orden === orden && previo.origen === "estandar" ? "= igual" : `~ ${previo.orden} → ${orden}`;
    const candidatos = obtenerMapeoSAU(nombre)?.capitulos ?? [nombre];
    const resuelve = candidatos.length === 1 && nombresCatalogo.has(candidatos[0]);
    console.log(`  ${String(orden).padStart(2, "0")}  ${estado.padEnd(10)}  ${resuelve ? "Biblioteca ✓" : "sin Biblioteca"}  ${nombre}`);
  });

  console.log("\n── Se eliminan ──");
  for (const n of ELIMINAR) console.log(`  - ${n} ${actualPorNombre.has(n) ? "(presente)" : "(ya no está)"}`);

  const fueraDeLista = actuales.filter((c) => c.origen === "estandar" && !ORDEN_FINAL.includes(c.nombre) && !ELIMINAR.includes(c.nombre));
  if (fueraDeLista.length > 0) {
    console.warn(`\n⚠ Capítulos "estandar" que no están en ninguna lista y NO se tocan: ${fueraDeLista.map((c) => c.nombre).join(", ")}`);
  }

  if (!nombresCatalogo.has("Limpieza y Retiro de Obra")) {
    console.warn(`\n⚠ "Limpieza y Retiro de Obra" todavía no existe en la Biblioteca (CapituloCatalogo) — correr antes seed-limpieza-retiro-obra-2026-10.ts.`);
  }

  if (aplicar) {
    await db.$transaction(async (tx) => {
      await tx.capituloEstandar.deleteMany({ where: { nombre: { in: ELIMINAR }, origen: "estandar" } });
      for (let i = 0; i < ORDEN_FINAL.length; i++) {
        const nombre = ORDEN_FINAL[i];
        await tx.capituloEstandar.upsert({
          where: { nombre },
          update: { orden: i + 1, origen: "estandar" },
          create: { nombre, orden: i + 1, origen: "estandar", vecesUsado: 1 },
        });
      }
      // Timeout alto: ~31 upserts secuenciales contra la base remota pasan
      // los 5 s por defecto de Prisma (la transacción se revierte entera).
    }, { timeout: 60000 });
    const final = await db.capituloEstandar.findMany({ where: { origen: "estandar" }, orderBy: { orden: "asc" } });
    const sinHuecos = final.every((c, i) => c.orden === i + 1);
    console.log(`\nAplicado. Capítulos estándar: ${final.length} — posiciones ${sinHuecos ? "1..N sin huecos ni duplicados ✓" : "⚠ CON HUECOS/DUPLICADOS"}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
