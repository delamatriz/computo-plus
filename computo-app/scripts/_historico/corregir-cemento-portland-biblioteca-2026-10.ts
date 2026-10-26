// Biblioteca — corrige el material "Cemento Portland" (a secas) de los APU
// estándar para que tome el precio del cemento GRIS en obra, no el del blanco.
//
// Por qué: resolverPrecioMaterial busca por "contiene" y, sin coincidencia
// exacta, elige la descripción más corta. Para "Cemento Portland" esa es
// "Cemento Portland blanco (en bolsa)" (código 198, $58,79/kg) en vez del gris
// en obra (código 141, $27,76/kg). Afecta a 6 rubros de mortero/lustrado
// (alisados, revoque lustrado, escalón, umbral, tanques). Relevado el
// 2026-10-26.
//
// Qué escribe: SOLO MaterialAPUEstandar.descripcion de las líneas con
// descripción exactamente "Cemento Portland" de rubros activos, cambiada por
// DESCRIPCION_GRIS — el mismo nombre que ya usan otras 86 líneas del catálogo.
// Con ese nombre la búsqueda encuentra coincidencia exacta con el código 141.
//
// No toca: rendimientos, unidades, precioReferencia, SubrubroEstandar.precioUY
// ("Precio base"), PrecioMTOP ni ningún proyecto (los rubros ya clonados no
// tienen vínculo vivo con la Biblioteca; los 3 que existen hoy no usan el
// blanco). "Cemento Portland blanco (en bolsa)" (usado a propósito) no se toca.
//
// Seguridad: antes de escribir verifica que DESCRIPCION_GRIS resuelva al
// código 141 y que "Cemento Portland" resuelva hoy al blanco (198); si no,
// aborta. Cada update lleva la descripción leída en el where. Con --apply
// imprime antes un respaldo JSON (id y descripción anterior).
//
// Idempotente: una segunda corrida encuentra 0 líneas.
//
// Ejecutar (dry-run): npx tsx scripts/corregir-cemento-portland-biblioteca-2026-10.ts
// Ejecutar (real):     npx tsx scripts/corregir-cemento-portland-biblioteca-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const DESCRIPCION_VIEJA = "Cemento Portland";
const DESCRIPCION_GRIS = "Cemento Portland gris (Montevideo, en bolsa, en obra)";
const CODIGO_GRIS = "141";
const CODIGO_BLANCO = "198";

const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

// Mismo orden que resolverPrecioMaterial (src/lib/resolverPrecioInsumo.ts):
// exacta primero, después la descripción más corta, desempate por código.
async function resolver(descripcion: string) {
  const filas = await db.precioMTOP.findMany({
    where: { descripcion: { contains: descripcion.trim(), mode: "insensitive" }, empresaId: null },
  });
  const objetivo = normalizar(descripcion);
  return [...filas].sort((a, b) => {
    const ea = normalizar(a.descripcion) === objetivo ? 0 : 1;
    const eb = normalizar(b.descripcion) === objetivo ? 0 : 1;
    return ea - eb || a.descripcion.length - b.descripcion.length || a.codigo.localeCompare(b.codigo);
  })[0] ?? null;
}

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const hoy = await resolver(DESCRIPCION_VIEJA);
  const gris = await resolver(DESCRIPCION_GRIS);
  console.log("── Verificación del catálogo de materiales (solo lectura) ──");
  console.log(`  "${DESCRIPCION_VIEJA}" resuelve hoy a: ${hoy?.codigo} "${hoy?.descripcion}" $${hoy?.precioUnitario}/${hoy?.unidad}`);
  console.log(`  "${DESCRIPCION_GRIS}" resuelve a: ${gris?.codigo} "${gris?.descripcion}" $${gris?.precioUnitario}/${gris?.unidad}`);
  if (gris?.codigo !== CODIGO_GRIS) throw new Error(`El nombre del gris no resuelve al código ${CODIGO_GRIS} — no se escribe nada`);
  if (hoy && hoy.codigo !== CODIGO_BLANCO && hoy.codigo !== CODIGO_GRIS) {
    throw new Error(`"${DESCRIPCION_VIEJA}" resuelve a un código inesperado (${hoy.codigo}) — revisar antes de escribir`);
  }
  console.log("  ✔ Coincide con lo relevado.\n");

  const lineas = await db.materialAPUEstandar.findMany({
    where: { descripcion: DESCRIPCION_VIEJA, apu: { subrubro: { activo: true } } },
    select: {
      id: true,
      descripcion: true,
      rendimiento: true,
      unidad: true,
      apu: { select: { utilidadPct: true, subrubro: { select: { codigo: true, descripcion: true, unidad: true } } } },
    },
  });

  console.log(`── Líneas a corregir: ${lineas.length} ──`);
  const precioHoy = hoy?.precioUnitario ?? 0;
  const precioGris = gris.precioUnitario;
  for (const l of lineas) {
    const s = l.apu.subrubro;
    // Diferencia en el precio unitario del rubro (con su Utilidad): rendimiento × diferencia de precio.
    const delta = l.rendimiento * (precioGris - precioHoy) * (1 + l.apu.utilidadPct / 100);
    console.log(`  ${s.codigo} | ${s.descripcion} | ${l.rendimiento} ${l.unidad}/${s.unidad}`);
    console.log(`    material: "${l.descripcion}" → "${DESCRIPCION_GRIS}"`);
    console.log(`    precio del cemento: $${money(precioHoy)} → $${money(precioGris)} | precio unitario del rubro: ${delta < 0 ? "−" : "+"}$${money(Math.abs(delta))}/${s.unidad}`);
  }

  console.log("\n── No se toca ──");
  console.log("  Rendimientos, unidades, precioReferencia, SubrubroEstandar.precioUY (\"Precio base\"), PrecioMTOP y proyectos.");

  if (aplicar && lineas.length > 0) {
    console.log("\n── Respaldo (descripción anterior) ──");
    console.log(JSON.stringify(lineas.map((l) => ({ id: l.id, codigo: l.apu.subrubro.codigo, descripcion: l.descripcion }))));
    await db.$transaction(
      async (tx) => {
        for (const l of lineas) {
          const r = await tx.materialAPUEstandar.updateMany({ where: { id: l.id, descripcion: DESCRIPCION_VIEJA }, data: { descripcion: DESCRIPCION_GRIS } });
          if (r.count !== 1) throw new Error(`${l.apu.subrubro.codigo}: la línea cambió mientras tanto — se aborta sin escribir`);
        }
      },
      { timeout: 60_000, maxWait: 10_000 }
    );
  }

  console.log(`\nRESUMEN: ${lineas.length} línea(s) de material.`);
  console.log(aplicar ? "APLICADO." : "DRY RUN: no se escribió nada. Para aplicar: --apply (con la aprobación de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
