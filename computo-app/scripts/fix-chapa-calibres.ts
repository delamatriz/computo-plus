// Expansión de biblioteca — Chapa de cubierta con 3 calibres reales
// (N°27/25/24) y distinción correcta de perfil (ondulada vs.
// trapezoidal — "acanalada" no es un perfil real, era una denominación
// genérica heredada del import SAU). Prepintada SOLO existe en perfil
// trapezoidal (confirmado con el usuario, no es un descuido).
//
// Reemplaza a cubierta-004/005/006 (se desactivan: activo: false, no se
// borran — mismo patrón que 7.2.19/7.2.20, contrapiso 6.6.3 y
// cubierta-008).
//
// MO: mismo criterio/categoría que ya usaban cubierta-004/005/006
// (Oficial albañil + Peón), con rendimiento ajustado a la baja para
// N°24 (más grueso, más lento de manipular — mismo patrón que
// isopanel-003):
//   - Ondulada: N°27 rend=12 (igual que cubierta-004 original), N°25=11,
//     N°24=10.
//   - Trapezoidal (galvanizada y prepintada, mismo perfil): N°27 rend=14
//     (igual que cubierta-005 original), N°25=13, N°24=12.
//
// Materiales reusados: "Tornillos autoperforantes para chapa" (ya real,
// $6/u) en los 9. "Bulón con arandela de goma" se usa en ondulada y en
// prepintada (mismo patrón que cubierta-004/006 originales), NO en
// trapezoidal galvanizada (mismo patrón que cubierta-005 original, que
// nunca lo usó) — no tenía PrecioMTOP real, se le agrega uno nuevo acá
// (estimación, ver abajo) porque se va a usar en 6 de los 9 códigos
// nuevos.
//
// Precios de chapa (los 9, genuinamente nuevos) — derivados de una
// fuente real cruzada, no estimados a ciegas:
//  - Base real: Lista MTOP N°599 (código 75) "Chapa de hierro
//    galvanizado, ondulada, Nro. 24" = $463,57/kg (fuente oficial).
//  - Peso por m² por calibre: fichas técnicas de chapa ondulada
//    (Sagosa/proveedores regionales, mismo sistema de calibres que
//    Uruguay) — N°27≈3,58 kg/m², N°25≈4,46 kg/m² (verificado con 2
//    tamaños de chapa distintos, consistente), N°24≈5,00 kg/m²
//    (interpolado por espesor).
//  - Ondulada = $463,57/kg × peso/m² de cada calibre.
//  - Trapezoidal = ondulada × 1,12 (perfil más rígido/complejo, mayor
//    consumo de acero por m² y menor oferta de proveedores — confirma
//    la hipótesis del usuario: ondulada es más económica).
//  - Prepintada = trapezoidal × 1,18 (terminación adicional).
//  Es una estimación DERIVADA de una fuente real (no una cotización
//  directa en $/m² de plaza) — marcada así.
//
// GG=15%/Util=10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-chapa-calibres.ts
// Ejecutar (real):     npx tsx scripts/fix-chapa-calibres.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const NOMBRE_CAPITULO = "Cubierta / Techos";

const TORNILLOS = { descripcion: "Tornillos autoperforantes para chapa", unidad: "u", precioUnitario: 6 };
const BULON_NUEVO = { codigo: "MAT-BULON-ARANDELA-GOMA", descripcion: "Bulón con arandela de goma", unidad: "u", precioUnitario: 28 };

const PRECIO_KG_BASE_MTOP = 463.57; // código 75, Lista MTOP N°599
const PESO_M2 = { "027": 3.58, "025": 4.46, "024": 5.0 };
const PREMIO_TRAPEZOIDAL = 1.12;
const PREMIO_PREPINTADA = 1.18;

const precioOndulada = (calibre: keyof typeof PESO_M2) => Math.round(PRECIO_KG_BASE_MTOP * PESO_M2[calibre] * 100) / 100;
const precioTrapezoidal = (calibre: keyof typeof PESO_M2) => Math.round(precioOndulada(calibre) * PREMIO_TRAPEZOIDAL * 100) / 100;
const precioPrepintada = (calibre: keyof typeof PESO_M2) => Math.round(precioTrapezoidal(calibre) * PREMIO_PREPINTADA * 100) / 100;

const PRECIOS_CHAPA = [
  { codigo: "MAT-CHAPA-OND-027", descripcion: "Chapa ondulada galvanizada N°27 (~0,40mm)", unidad: "m2", precioUnitario: precioOndulada("027") },
  { codigo: "MAT-CHAPA-OND-025", descripcion: "Chapa ondulada galvanizada N°25 (~0,50mm)", unidad: "m2", precioUnitario: precioOndulada("025") },
  { codigo: "MAT-CHAPA-OND-024", descripcion: "Chapa ondulada galvanizada N°24 (~0,56mm)", unidad: "m2", precioUnitario: precioOndulada("024") },
  { codigo: "MAT-CHAPA-TRAP-027", descripcion: "Chapa trapezoidal galvanizada N°27 (~0,40mm)", unidad: "m2", precioUnitario: precioTrapezoidal("027") },
  { codigo: "MAT-CHAPA-TRAP-025", descripcion: "Chapa trapezoidal galvanizada N°25 (~0,50mm)", unidad: "m2", precioUnitario: precioTrapezoidal("025") },
  { codigo: "MAT-CHAPA-TRAP-024", descripcion: "Chapa trapezoidal galvanizada N°24 (~0,56mm)", unidad: "m2", precioUnitario: precioTrapezoidal("024") },
  { codigo: "MAT-CHAPA-PREP-027", descripcion: "Chapa trapezoidal prepintada N°27 (~0,40mm)", unidad: "m2", precioUnitario: precioPrepintada("027") },
  { codigo: "MAT-CHAPA-PREP-025", descripcion: "Chapa trapezoidal prepintada N°25 (~0,50mm)", unidad: "m2", precioUnitario: precioPrepintada("025") },
  { codigo: "MAT-CHAPA-PREP-024", descripcion: "Chapa trapezoidal prepintada N°24 (~0,56mm)", unidad: "m2", precioUnitario: precioPrepintada("024") },
] as const;

type Def = {
  codigo: string;
  descripcion: string;
  chapaCodigo: (typeof PRECIOS_CHAPA)[number]["codigo"];
  usaBulon: boolean;
  moRendimiento: number;
};
const CODIGOS: Def[] = [
  { codigo: "chapa-ond-027", descripcion: "Chapa ondulada galvanizada N°27 (~0,40mm) - económica", chapaCodigo: "MAT-CHAPA-OND-027", usaBulon: true, moRendimiento: 12 },
  { codigo: "chapa-ond-025", descripcion: "Chapa ondulada galvanizada N°25 (~0,50mm) - superior", chapaCodigo: "MAT-CHAPA-OND-025", usaBulon: true, moRendimiento: 11 },
  { codigo: "chapa-ond-024", descripcion: "Chapa ondulada galvanizada N°24 (~0,56mm) - premium", chapaCodigo: "MAT-CHAPA-OND-024", usaBulon: true, moRendimiento: 10 },
  { codigo: "chapa-trap-027", descripcion: "Chapa trapezoidal galvanizada N°27 (~0,40mm) - económica", chapaCodigo: "MAT-CHAPA-TRAP-027", usaBulon: false, moRendimiento: 14 },
  { codigo: "chapa-trap-025", descripcion: "Chapa trapezoidal galvanizada N°25 (~0,50mm) - superior", chapaCodigo: "MAT-CHAPA-TRAP-025", usaBulon: false, moRendimiento: 13 },
  { codigo: "chapa-trap-024", descripcion: "Chapa trapezoidal galvanizada N°24 (~0,56mm) - premium", chapaCodigo: "MAT-CHAPA-TRAP-024", usaBulon: false, moRendimiento: 12 },
  { codigo: "chapa-prep-027", descripcion: "Chapa trapezoidal prepintada N°27 (~0,40mm) - económica", chapaCodigo: "MAT-CHAPA-PREP-027", usaBulon: true, moRendimiento: 14 },
  { codigo: "chapa-prep-025", descripcion: "Chapa trapezoidal prepintada N°25 (~0,50mm) - superior", chapaCodigo: "MAT-CHAPA-PREP-025", usaBulon: true, moRendimiento: 13 },
  { codigo: "chapa-prep-024", descripcion: "Chapa trapezoidal prepintada N°24 (~0,56mm) - premium", chapaCodigo: "MAT-CHAPA-PREP-024", usaBulon: true, moRendimiento: 12 },
];

const CODIGOS_A_DESACTIVAR = ["cubierta-004", "cubierta-005", "cubierta-006"];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const capitulo = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_CAPITULO } });
  if (!capitulo) {
    console.error(`Falta CapituloCatalogo "${NOMBRE_CAPITULO}" — abortando.`);
    await db.$disconnect();
    process.exit(1);
  }

  // ── 1. Desactivar cubierta-004/005/006 ────────────────────────────────
  console.log("── Desactivar (activo: false, NO se borra) ──");
  for (const codigo of CODIGOS_A_DESACTIVAR) {
    const s = await db.subrubroEstandar.findUnique({ where: { codigo } });
    if (!s) {
      console.log(`  ⚠ ${codigo} no encontrado`);
      continue;
    }
    console.log(`  ${codigo} — "${s.descripcion}" — activo: ${s.activo} → false`);
    if (aplicar) await db.subrubroEstandar.update({ where: { codigo }, data: { activo: false } });
  }

  // ── 2. PrecioMTOP nuevos (9 chapas + 1 bulón) ────────────────────────
  console.log("\n── PrecioMTOP nuevos ──");
  const todosLosPrecios = [...PRECIOS_CHAPA, BULON_NUEVO];
  for (const p of todosLosPrecios) {
    const existente = await db.precioMTOP.findUnique({ where: { codigo: p.codigo } });
    console.log(`  ${existente ? "= ya existe" : "+ nuevo"} — ${p.codigo} — ${p.descripcion} ($${p.precioUnitario}/${p.unidad})`);
    if (aplicar) {
      await db.precioMTOP.upsert({
        where: { codigo: p.codigo },
        create: {
          codigo: p.codigo,
          descripcion: p.descripcion,
          cantidadUnidad: `1 ${p.unidad}`,
          unidad: p.unidad,
          cantidad: 1,
          precioConIva: p.precioUnitario,
          precioUnitario: p.precioUnitario,
          numeroLista: 0,
          fechaLista: FECHA,
        },
        update: { precioUnitario: p.precioUnitario, precioConIva: p.precioUnitario },
      });
    }
  }

  // ── 3. Crear los 9 SubrubroEstandar + APUEstandar ────────────────────
  console.log("\n── SubrubroEstandar + APUEstandar nuevos ──");
  const precioPorCodigoChapa = new Map(PRECIOS_CHAPA.map((p) => [p.codigo, p]));
  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const jornalOficialAlbanil = jornalPorNombre("Oficial albañil");
  const jornalPeon = jornalPorNombre("Peón");

  for (const def of CODIGOS) {
    const chapa = precioPorCodigoChapa.get(def.chapaCodigo)!;
    const sumMat =
      1.1 * chapa.precioUnitario + 8 * TORNILLOS.precioUnitario + (def.usaBulon ? 4 * BULON_NUEVO.precioUnitario : 0);
    const sumMO = jornalOficialAlbanil / def.moRendimiento + jornalPeon / def.moRendimiento;
    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`\n  + crea ${def.codigo} — ${def.descripcion} (M2) — $${precioUY}/M2`);
    console.log(`      material: ${chapa.descripcion} — rendimiento 1.1 m2 — $${chapa.precioUnitario}/m2`);
    console.log(`      material: ${TORNILLOS.descripcion} — rendimiento 8 u — $${TORNILLOS.precioUnitario}/u`);
    if (def.usaBulon) console.log(`      material: ${BULON_NUEVO.descripcion} — rendimiento 4 u — $${BULON_NUEVO.precioUnitario}/u`);
    console.log(`      MO: Oficial albañil + Peón — rendimiento ${def.moRendimiento} M2/jornada c/u`);
    console.log(`      sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);

    if (!aplicar) continue;

    const subrubro = await db.subrubroEstandar.upsert({
      where: { codigo: def.codigo },
      create: { codigo: def.codigo, descripcion: def.descripcion, unidad: "M2", precioUY, fechaBase: FECHA, origen: "manual", capituloId: capitulo.id, subcapituloId: null },
      update: { descripcion: def.descripcion, unidad: "M2", precioUY, fechaBase: FECHA, capituloId: capitulo.id },
    });

    const apuExistente = await db.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });
    const apu = apuExistente
      ? await db.aPUEstandar.update({ where: { subrubroId: subrubro.id }, data: {} })
      : await db.aPUEstandar.create({ data: { subrubroId: subrubro.id } });

    await db.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: chapa.descripcion, unidad: "m2", rendimiento: 1.1 } });
    await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: TORNILLOS.descripcion, unidad: TORNILLOS.unidad, rendimiento: 8 } });
    if (def.usaBulon) {
      await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: BULON_NUEVO.descripcion, unidad: BULON_NUEVO.unidad, rendimiento: 4 } });
    }
    await db.manoObraAPUEstandar.create({ data: { apuId: apu.id, categoria: "Oficial albañil", jornadaHs: 8, rendimiento: def.moRendimiento } });
    await db.manoObraAPUEstandar.create({ data: { apuId: apu.id, categoria: "Peón", jornadaHs: 8, rendimiento: def.moRendimiento } });
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);
  if (aplicar) {
    const total = await db.subrubroEstandar.count({ where: { capituloId: capitulo.id, activo: true } });
    console.log(`Total SubrubroEstandar activos en "${NOMBRE_CAPITULO}": ${total}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
