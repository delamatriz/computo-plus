// Biblioteca — mueve "SANEADO DE REVOQUES Y HORMIGONES EN FACHADA" (7.14.2,
// Albañilería › Patología de Fachada) al capítulo "Demoliciones" (en la Lista
// estándar y en los proyectos se llama "Demoliciones y Picados"), subcapítulo
// "Terminaciones y revestimientos" (donde viven 3.3.1 "Picado de revoques en
// muros" y el resto de los picados de terminaciones).
//
// Qué cambia (el MISMO registro: mismo id, mismo APU, mismo precio):
//   · capituloId       Albañilería → Demoliciones
//   · subcapituloId    Patología de Fachada → Terminaciones y revestimientos
//   · codigo           7.14.2 → próximo libre de 3.3.x (hoy 3.3.7), como el
//                      resto de los rubros de ese subcapítulo (convención
//                      <capítulo>.<subcapítulo>.<n>; hay precedente: los 7.14.x
//                      eran 6.10.x)
//   · orden            al final del subcapítulo
// NO cambia: descripción, unidad, precioUY ($278,17), APU (solo mano de obra:
// Oficial trabajo en altura + Peón a 17,5 m²/jornada, sin materiales), activo.
//
// Qué podría romperse (verificado): nada. Ningún código, seed ni prompt
// referencia 7.14.2 (las menciones en docs son del código viejo 6.10.2); los
// rubros de proyecto no guardan el código de Biblioteca; Cálculo Rápido elige
// subrubros del capítulo en el momento, no por código fijo; el paraguas
// "Albañilería" resuelve sus subcapítulos dinámicamente (Patología de Fachada
// sigue con 7.14.1, 7.14.3 y 7.14.4) y "Demoliciones" tiene su propia entrada.
// Efecto visible: el rubro deja de aparecer en "Ver subrubros típicos" de
// Albañilería y aparece en el de Demoliciones y Picados.
//
// Idempotente: si ya está en Demoliciones no hace nada. Una transacción.
//
// Ejecutar (dry-run): npx tsx scripts/mover-saneado-a-demoliciones-2026-10.ts
// Ejecutar (real):     npx tsx scripts/mover-saneado-a-demoliciones-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const CODIGO_ORIGEN = "7.14.2";
const DESCRIPCION = "SANEADO DE REVOQUES Y HORMIGONES EN FACHADA";
const CAPITULO_DESTINO = "Demoliciones";
const SUBCAPITULO_DESTINO = "Terminaciones y revestimientos";
const PREFIJO_DESTINO = "3.3";

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const destCap = await db.capituloCatalogo.findUnique({ where: { nombre: CAPITULO_DESTINO } });
  if (!destCap) throw new Error(`No existe el capítulo "${CAPITULO_DESTINO}" en el catálogo`);
  const destSub = await db.subcapituloCatalogo.findFirst({ where: { capituloCatalogoId: destCap.id, nombre: SUBCAPITULO_DESTINO } });
  if (!destSub) throw new Error(`No existe el subcapítulo "${SUBCAPITULO_DESTINO}" en "${CAPITULO_DESTINO}"`);

  // ¿Ya movido? (idempotencia: se busca por descripción dentro del destino)
  const yaMovido = await db.subrubroEstandar.findFirst({ where: { capituloId: destCap.id, descripcion: DESCRIPCION } });
  if (yaMovido) {
    console.log(`= Ya está en ${CAPITULO_DESTINO} › ${SUBCAPITULO_DESTINO} como ${yaMovido.codigo}. Sin cambios.`);
    await db.$disconnect();
    return;
  }

  const s = await db.subrubroEstandar.findUnique({
    where: { codigo: CODIGO_ORIGEN },
    include: { capituloCatalogo: true, subcapituloCatalogo: true, apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
  });
  if (!s) throw new Error(`No se encontró ${CODIGO_ORIGEN}`);
  if (s.descripcion.trim() !== DESCRIPCION) throw new Error(`${CODIGO_ORIGEN} ya no es «${DESCRIPCION}» («${s.descripcion}») — abortando`);

  const hermanos = await db.subrubroEstandar.findMany({ where: { subcapituloId: destSub.id } });
  const sufijos = hermanos
    .map((h) => (h.codigo.startsWith(PREFIJO_DESTINO + ".") ? Number(h.codigo.slice(PREFIJO_DESTINO.length + 1)) : NaN))
    .filter(Number.isFinite);
  const codigoNuevo = `${PREFIJO_DESTINO}.${(sufijos.length ? Math.max(...sufijos) : 0) + 1}`;
  if (await db.subrubroEstandar.findUnique({ where: { codigo: codigoNuevo } })) throw new Error(`El código ${codigoNuevo} ya existe`);
  const ordenNuevo = hermanos.reduce((mx, h) => Math.max(mx, h.orden ?? -1), -1) + 1;

  const mo = s.apuEstandar?.manoObra.map((m) => `${m.categoria} ${m.rendimiento} m²/jornada`).join(" + ") ?? "(sin APU)";
  console.log(`  ${s.codigo} «${s.descripcion}» (${s.unidad}) — $${s.precioUY} — APU: ${mo}; materiales ${s.apuEstandar?.materiales.length ?? 0}; equipos ${s.apuEstandar?.equipos.length ?? 0}`);
  console.log(`  capítulo     ${s.capituloCatalogo?.nombre} › ${s.subcapituloCatalogo?.nombre}  →  ${CAPITULO_DESTINO} › ${SUBCAPITULO_DESTINO}`);
  console.log(`  código       ${s.codigo} → ${codigoNuevo}   (orden ${s.orden} → ${ordenNuevo})`);
  console.log("  NO cambia: id, descripción, unidad, precio, APU, activo.");
  console.log(`\n  Hermanos en el destino: ${hermanos.map((h) => h.codigo).sort().join(", ")}`);

  if (aplicar) {
    await db.$transaction(
      async (tx) => {
        const r = await tx.subrubroEstandar.updateMany({
          where: { id: s.id, codigo: s.codigo, capituloId: s.capituloId },
          data: { capituloId: destCap.id, subcapituloId: destSub.id, codigo: codigoNuevo, orden: ordenNuevo },
        });
        if (r.count !== 1) throw new Error(`${CODIGO_ORIGEN} cambió mientras tanto — se aborta`);
      },
      { timeout: 120_000 }
    );
  }
  console.log(aplicar ? "\nAPLICADO." : "\nDRY RUN: no se escribió nada. Para aplicar: --apply (con el OK de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
