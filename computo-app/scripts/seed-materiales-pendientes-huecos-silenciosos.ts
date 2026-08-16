// Crea 12 filas "A cotizar" en PrecioMTOP para los 13 materiales de la
// Biblioteca (MaterialAPUEstandar) que hoy son un "hueco silencioso": sin
// ningún match en PrecioMTOP, sin badge, precio $0 sin ningún aviso —
// peor que "A cotizar" (que sí muestra el badge gris), directamente
// invisible en la UI (BadgeVerificacion ni se renderiza cuando
// `fuente` es null, ver rubros/page.tsx).
//
// Mismo patrón exacto que las 10 filas "A cotizar" ya existentes de
// Fase 2 (Espuma plast autotrabante, Espejo 3mm/4mm, Losas Stalton,
// Cortina de enrollar) — precioUnitario/precioConIva en 0,
// motivoVerificacion: "sin_precio_referencia", numeroLista: 0.
//
// 13 materiales → 12 filas: "Bulon con arandela de goma" aparece 2 veces
// en la Biblioteca (subrubros cubierta-004 y cubierta-006) con texto
// IDÉNTICO — como el matching de /descompuesto es por
// `descripcion.contains(...)`, una sola fila resuelve las dos. "Chapa
// acanalada galvanizada N°27" y "...prepintada N°27" SÍ son productos
// distintos (terminaciones distintas) y llevan una fila cada una.
//
// Excluye a propósito los 12 "Honorario profesional — a completar
// manualmente según arancel SAU vigente" del mismo relevamiento — son
// intencionales, no un hueco real.
//
// Modo dry-run (default): solo muestra qué se crearía, no escribe nada.
// Modo aplicar: agregar --apply para escribir en la base.
//
// Ejecutar:
//   npx tsx scripts/seed-materiales-pendientes-huecos-silenciosos.ts              (dry-run)
//   npx tsx scripts/seed-materiales-pendientes-huecos-silenciosos.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");
const FECHA_LISTA = "2026-08";

const NUEVAS = [
  { codigo: "MAT-PEND-CHAPA-GALV-N27", descripcion: "Chapa acanalada galvanizada N°27", unidad: "m2" },
  { codigo: "MAT-PEND-CHAPA-PREPINT-N27", descripcion: "Chapa acanalada prepintada N°27", unidad: "m2" },
  { codigo: "MAT-PEND-BULON-ARANDELA-GOMA", descripcion: "Bulon con arandela de goma", unidad: "u" },
  { codigo: "MAT-PEND-RADIADOR-AGUA-CALIENTE", descripcion: "Radiador de agua caliente", unidad: "u" },
  { codigo: "MAT-PEND-CANO-COBRE-CALEFACCION", descripcion: "Caño cobre para calefacción", unidad: "ml" },
  { codigo: "MAT-PEND-ACCESORIOS-RADIADOR", descripcion: "Accesorios instalación radiador", unidad: "gl" },
  { codigo: "MAT-PEND-CALDERA-GAS", descripcion: "Caldera a gas para calefacción", unidad: "u" },
  { codigo: "MAT-PEND-ACCESORIOS-CALDERA", descripcion: "Accesorios instalación caldera", unidad: "gl" },
  { codigo: "MAT-PEND-MANTA-CALEFACTORA-PISO", descripcion: "Manta calefactora eléctrica para piso", unidad: "m2" },
  { codigo: "MAT-PEND-TERMOSTATO-PISO-RADIANTE", descripcion: "Termostato para piso radiante", unidad: "u" },
  { codigo: "MAT-PEND-CANO-PEX-PISO-RADIANTE", descripcion: "Caño PEX para piso radiante", unidad: "ml" },
  { codigo: "MAT-PEND-COLECTOR-PISO-RADIANTE", descripcion: "Colector para piso radiante", unidad: "u" },
];

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");

  const existentes = await p.precioMTOP.findMany({
    where: { codigo: { in: NUEVAS.map((n) => n.codigo) } },
    select: { codigo: true },
  });
  const codigosExistentes = new Set(existentes.map((e) => e.codigo));

  let creados = 0;
  for (const n of NUEVAS) {
    if (codigosExistentes.has(n.codigo)) {
      console.log(`⚠ Ya existe: ${n.codigo} — se omite`);
      continue;
    }
    console.log(`${modoAplicar ? "✓" : "→"} ${n.codigo} — "${n.descripcion}" (${n.unidad})`);
    if (modoAplicar) {
      await p.precioMTOP.create({
        data: {
          codigo: n.codigo,
          descripcion: n.descripcion,
          cantidadUnidad: `1 ${n.unidad}`,
          unidad: n.unidad,
          cantidad: 1,
          precioConIva: 0,
          precioUnitario: 0,
          numeroLista: 0,
          fechaLista: FECHA_LISTA,
          requiereVerificacion: true,
          motivoVerificacion: "sin_precio_referencia",
        },
      });
    }
    creados++;
  }

  console.log(`\nFilas ${modoAplicar ? "creadas" : "que se crearían"}: ${creados} de ${NUEVAS.length}`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
