// Fase 2 del bug "clona a $0" — Tanda 3 (Subcontratos -
// Acondicionamientos), sub-tanda 3b: Mesadas de piedra (6 códigos,
// subcapítulo Equipamiento).
//
// Confirmado (sin material mal asignado): en los 6 el material del
// APU coincide con lo que el código describe. Ninguno usado en Rubro
// real de HOGAR/Matisse Monet.
//
// Chequeo del orden esperado (granito < travertino < carrara <
// Silestone ≈ Dekton) — pedido explícitamente por el usuario, se
// confirma PARCIALMENTE: Dekton es la más cara del grupo (se
// sostiene), y travertino < carrara < Silestone se sostiene. Pero
// "Granito negro absoluto" NO es el más barato — es el segundo más
// caro, por encima de Silestone. Es una variedad de granito
// específicamente premium/exótica (no el granito gris genérico),
// confirmado con una fuente real (Piemontesa Cerámicas, Uruguay, USD
// 307/m²) que ya de por sí es una cifra alta para un granito.
// Aprobado por el usuario tal cual, sin forzar el orden esperado.
//
// Fuentes de precio:
//  - Granito negro absoluto: Piemontesa Cerámicas (Montevideo), USD
//    307/m² real → $12.540,95/m².
//  - Mármol travertino / Carrara / Silestone / Dekton: se confirmaron
//    3 distribuidores reales en Uruguay (StoneCenter —oficial
//    Cosentino—, Barraca Malvin, Marmolería San Pancracio) pero
//    ninguno publica precio online (piden cotización directa). Se
//    reconstruyó el precio de material implícito en cada uno de los 5
//    valores del Rubrado SAU 2022 (retro-calculando costoDirecto =
//    precioUY/1,265, descontando MO y sellador) y se escalaron los 4
//    restantes por el mismo factor que llevó el granito de su valor
//    2022 implícito a su valor real 2026 confirmado (factor 0,8013).
//    Mantiene el juicio profesional relativo del SAU (fuente uruguaya
//    real, aunque de 2022) anclado a un dato de mercado 2026
//    confirmado — no es cotización directa, pero está fundamentado.
//  - Perfil de aluminio para amure: ⚠️⚠️ sin fuente puntual — Aluminios
//    del Uruguay y Sodimac confirman el producto pero sin precio por
//    metro lineal accesible. Estimación gruesa $180/ml.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-acondicionamientos-mesadas.ts
// Ejecutar (real):     npx tsx scripts/fix-acondicionamientos-mesadas.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const GRANITO_M2 = 12540.95;
const TRAVERTINO_M2 = 7382.46;
const CARRARA_M2 = 8190.54;
const SILESTONE_M2 = 9590.79;
const DEKTON_M2 = 14715.65;
const PERFIL_ALUMINIO_AMURE_ML = 180;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "7.2.11", materialesNuevos: [{ codigoMTOP: "MAT-GRANITO-NEGRO-ABSOLUTO", descripcion: "Granito negro absoluto mesada", unidad: "m2", precio: GRANITO_M2 }] },
  { codigo: "7.2.12", materialesNuevos: [{ codigoMTOP: "MAT-MARMOL-TRAVERTINO", descripcion: "Mármol travertino mesada", unidad: "m2", precio: TRAVERTINO_M2 }] },
  { codigo: "7.2.13", materialesNuevos: [{ codigoMTOP: "MAT-MARMOL-CARRARA", descripcion: "Mármol blanco Carrara mesada", unidad: "m2", precio: CARRARA_M2 }] },
  { codigo: "7.2.14", materialesNuevos: [{ codigoMTOP: "MAT-SILESTONE-BLANCO", descripcion: "Silestone blanco mesada", unidad: "m2", precio: SILESTONE_M2 }] },
  { codigo: "7.2.15", materialesNuevos: [{ codigoMTOP: "MAT-DEKTON-NATURA", descripcion: "Dekton Natura mesada", unidad: "m2", precio: DEKTON_M2 }] },
  { codigo: "7.2.16", materialesNuevos: [{ codigoMTOP: "MAT-PERFIL-ALUM-AMURE", descripcion: "Perfil de aluminio para amure", unidad: "ml", precio: PERFIL_ALUMINIO_AMURE_ML }] },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const todosPrecios = await db.precioMTOP.findMany();
  const resolverPrecioExistente = (desc: string) =>
    todosPrecios.find((p) => p.descripcion.toLowerCase().includes(desc.toLowerCase()))?.precioUnitario ?? 0;

  for (const def of DEFS) {
    const s = await db.subrubroEstandar.findFirst({
      where: { codigo: def.codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true } } },
    });
    if (!s || !s.apuEstandar) {
      console.error(`${def.codigo}: no encontrado — abortando.`);
      continue;
    }

    console.log(`\n${def.codigo} — ${s.descripcion}`);
    let sumMat = 0;

    for (const m of s.apuEstandar.materiales) {
      const nuevo = def.materialesNuevos.find((n) => n.descripcion.toLowerCase() === m.descripcion.toLowerCase());
      if (nuevo) {
        const precio = Math.round(nuevo.precio * 100) / 100;
        console.log(`  material: ${nuevo.descripcion} — $${precio}/${nuevo.unidad} (${nuevo.codigoMTOP}) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;

        if (aplicar) {
          await db.precioMTOP.upsert({
            where: { codigo: nuevo.codigoMTOP },
            create: {
              codigo: nuevo.codigoMTOP,
              descripcion: nuevo.descripcion,
              cantidadUnidad: `1 ${nuevo.unidad}`,
              unidad: nuevo.unidad,
              cantidad: 1,
              precioConIva: precio,
              precioUnitario: precio,
              numeroLista: 0,
              fechaLista: FECHA,
            },
            update: { precioUnitario: precio, precioConIva: precio },
          });
        }
      } else {
        const precio = resolverPrecioExistente(m.descripcion);
        console.log(`  material: ${m.descripcion} — $${precio}/${m.unidad} (ya real, sin cambios) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;
      }
    }

    const sumMO = s.apuEstandar.manoObra.reduce((acc, mo) => {
      const jornal = jornalPorNombre(mo.categoria);
      console.log(`  MO: ${mo.categoria} — rendimiento ${mo.rendimiento} U/jornada (sin cambios)`);
      return acc + jornal / mo.rendimiento;
    }, 0);

    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`  precioUY actual: $${s.precioUY} (fechaBase ${s.fechaBase}) → NUEVO: $${precioUY}`);

    if (aplicar) {
      await db.subrubroEstandar.update({ where: { codigo: def.codigo }, data: { precioUY, fechaBase: FECHA } });
    }
  }

  if (!aplicar) {
    console.log("\nDry-run — nada se escribió.");
  } else {
    console.log("\nAplicado.");
  }
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
