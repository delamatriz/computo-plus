// Marca puntual "A cotizar" para los 10 insumos de los 8 códigos
// documentados en PENDIENTES-FASE2.md como "sin fuente confiable" (Fase
// 2, bug "clona a $0"): 6.6.6, 7.4.7, 7.4.8, 5.2.1, 5.2.2, 5.2.3, 7.5.1,
// 7.5.2. Hoy ninguno de estos insumos tiene fila en PrecioMTOP — por eso
// no muestran NINGÚN badge en /rubros (ni ámbar), y el precio resuelve
// a $0 en silencio. Este script crea esas 10 filas con precio $0 (no se
// inventa ningún precio) y motivoVerificacion="sin_precio_referencia" —
// valor puntual nuevo que BadgeVerificacion (rubros/page.tsx) usa para
// mostrar el badge gris "A cotizar" en vez del ámbar genérico.
//
// SOLO estos 10 insumos puntuales — no es un mecanismo general para
// cualquier material sin precio.
//
// Idempotente por codigo (upsert). Dry-run por defecto.
//
// Ejecutar (dry-run): npx tsx scripts/fix-fase2-8-pendientes-sin-precio.ts
// Ejecutar (real):     npx tsx scripts/fix-fase2-8-pendientes-sin-precio.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA_HOY = "2026-08";

interface InsumoPendiente {
  codigo: string;
  descripcion: string;
  unidad: string;
  // Códigos de PENDIENTES-FASE2.md donde aparece este insumo — solo
  // informativo en el log, no se persiste.
  codigosSubrubro: string[];
}

const insumos: InsumoPendiente[] = [
  {
    codigo: "MAT-PEND-ESPUMA-AUTOTRABANTE",
    descripcion: "Espuma plast autotrabante",
    unidad: "m2",
    codigosSubrubro: ["6.6.6"],
  },
  {
    codigo: "MAT-PEND-ESPEJO-3MM",
    descripcion: "Espejo 3mm",
    unidad: "m2",
    codigosSubrubro: ["7.4.7"],
  },
  {
    codigo: "MAT-PEND-ADHESIVO-ESPEJO",
    descripcion: "Adhesivo para espejo",
    unidad: "kg",
    codigosSubrubro: ["7.4.7"],
  },
  {
    codigo: "MAT-PEND-ESPEJO-4MM",
    descripcion: "Espejo 4mm",
    unidad: "m2",
    codigosSubrubro: ["7.4.8"],
  },
  {
    codigo: "MAT-PEND-LOSA-STALTON-10",
    descripcion: "Losa Stalton H=10cm",
    unidad: "m2",
    codigosSubrubro: ["5.2.1"],
  },
  {
    codigo: "MAT-PEND-LOSA-STALTON-15",
    descripcion: "Losa Stalton H=15cm",
    unidad: "m2",
    codigosSubrubro: ["5.2.2"],
  },
  {
    codigo: "MAT-PEND-LOSA-STALTON-19",
    descripcion: "Losa Stalton H=19cm",
    unidad: "m2",
    codigosSubrubro: ["5.2.3"],
  },
  {
    codigo: "MAT-PEND-CORTINA-PVC",
    descripcion: "Cortina de enrollar PVC",
    unidad: "m2",
    codigosSubrubro: ["7.5.1"],
  },
  {
    codigo: "MAT-PEND-CORTINA-ALUM-POLIURET",
    descripcion: "Cortina de enrollar aluminio poliuretánica",
    unidad: "m2",
    codigosSubrubro: ["7.5.2"],
  },
  {
    codigo: "MAT-PEND-CAJON-CORTINA",
    descripcion: "Cajón para cortina de enrollar",
    unidad: "ml",
    codigosSubrubro: ["7.5.1", "7.5.2"],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);
  console.log(`Total insumos a marcar: ${insumos.length} (cubren 8 códigos de PENDIENTES-FASE2.md)\n`);

  let creados = 0;
  let actualizados = 0;

  for (const item of insumos) {
    const existente = await db.precioMTOP.findUnique({ where: { codigo: item.codigo } });
    const accion = existente ? "actualizar" : "crear";
    console.log(
      `  [${accion}] ${item.codigo} — "${item.descripcion}" (${item.unidad}) — códigos: ${item.codigosSubrubro.join(", ")}`
    );

    if (existente) actualizados++;
    else creados++;

    if (aplicar) {
      await db.precioMTOP.upsert({
        where: { codigo: item.codigo },
        create: {
          codigo: item.codigo,
          descripcion: item.descripcion,
          cantidadUnidad: `1 ${item.unidad}`,
          unidad: item.unidad,
          cantidad: 1,
          precioConIva: 0,
          precioUnitario: 0,
          numeroLista: 0,
          fechaLista: FECHA_HOY,
          requiereVerificacion: true,
          motivoVerificacion: "sin_precio_referencia",
        },
        update: {
          descripcion: item.descripcion,
          cantidadUnidad: `1 ${item.unidad}`,
          unidad: item.unidad,
          precioConIva: 0,
          precioUnitario: 0,
          requiereVerificacion: true,
          motivoVerificacion: "sin_precio_referencia",
        },
      });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`A crear:      ${creados}`);
  console.log(`A actualizar: ${actualizados}`);
  console.log(aplicar ? "\nAplicado." : "\nDry-run — nada se escribió.");

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
