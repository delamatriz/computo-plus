// Completa los 21 APUs estándar faltantes de Subcontratos - Carpinterías
// (madera, herrajes, equipamiento, hierro y aluminio) en la base de
// PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-carpinterias-completo.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };

type ApuDef = {
  codigo: string;
  descripcion: string; // usada como fallback de búsqueda si no hay match por código
  capituloFallback: string;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
};

const APUS: ApuDef[] = [
  {
    codigo: "7.3.3",
    descripcion: "VENTANA CORREDIZA DE MADERA CON CELOSÍA 1.20x1.00m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Ventana corrediza de madera con celosía 1.20x1.00m", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes mueble", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "7.3.4",
    descripcion: "PUERTA VENTANA CORREDIZA DE MADERA 1.80x2.05m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Puerta ventana corrediza de madera 1.80x2.05m", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes mueble", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.6 },
    ],
  },
  {
    codigo: "7.3.5",
    descripcion: "AMURE DE ABERTURAS DE MADERA",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 2 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.005 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "7.3.6",
    descripcion: "POMO CON LLAVIN",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Pomo con llavín", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "7.3.7",
    descripcion: "CERRADURA TIPO STAR CON MANIJA",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Cerradura tipo star con manija", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 5 },
    ],
  },
  {
    codigo: "7.3.8",
    descripcion: "BISAGRA",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Bisagra", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 16 },
    ],
  },
  {
    codigo: "7.3.11",
    descripcion: "PLACARD DE PUERTAS CORREDIZAS 1.80X2.30X0.65m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Placard de puertas corredizas 1.80x2.30x0.65m", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes mueble", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.7 },
    ],
  },
  {
    codigo: "7.3.12",
    descripcion: "VENTANA EN PERFIL DE HIERRO 1.40x1.10m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Ventana en perfil de hierro 1.40x1.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Pintura anticorrosiva", unidad: "l", rendimiento: 0.3 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.2 },
    ],
  },
  {
    codigo: "7.3.13",
    descripcion: "REJA 1.40x1.10mm",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Tubo cuadrado acero 25x25x2mm", unidad: "kg", rendimiento: 12 },
      { descripcion: "Pintura anticorrosiva", unidad: "l", rendimiento: 0.4 },
      { descripcion: "Electrodos de soldadura", unidad: "u", rendimiento: 8 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "7.3.14",
    descripcion: "PUERTA DE CHAPA CALIBRE 18 0.75x2.05m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Puerta metálica chapa plegada 0.90x2.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes metálicos", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "7.3.15",
    descripcion: "PORTÓN DE GARAGE DOS HOJAS 2.40x2.10m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Portón metálico corredizo 3.00x2.10m", unidad: "u", rendimiento: 0.9 },
      { descripcion: "Tornillos y herrajes metálicos", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "7.3.16",
    descripcion: "MOTOR PARA PORTÓN BATIENTE",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Motor para portón batiente", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios instalación motor portón", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "7.3.17",
    descripcion: "AMURE DE ABERTURAS O REJAS",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 2 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.005 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "7.3.17b",
    descripcion: "PUERTA VENTANA CORREDIZA ALUMINIO SERIE 25 2.00X2.05m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Puerta ventana corrediza aluminio serie 25 2.00x2.05m", unidad: "u", rendimiento: 1 },
      { descripcion: "Silicona para ventanas", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.7 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.7 },
    ],
  },
  {
    codigo: "7.3.18",
    descripcion: "VENTANA CORREDIZA ALUMINIO SERIE 25 1.20X1.10m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Ventana metálica corrediza 1.20x1.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Silicona para ventanas", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.2 },
    ],
  },
  {
    codigo: "7.3.19",
    descripcion: "PUERTA VENTANA CORREDIZA ALUMINIO SERIE GALA DVH 2.80x2.05m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Puerta ventana corrediza aluminio Gala DVH 2.80x2.05m", unidad: "u", rendimiento: 1 },
      { descripcion: "Silicona para ventanas", unidad: "u", rendimiento: 1.5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "7.3.20",
    descripcion: "PUERTA BATIENTE ALUMINIO SERIE GALA 0.90x2.05m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Puerta batiente aluminio Gala 0.90x2.05m", unidad: "u", rendimiento: 1 },
      { descripcion: "Silicona para ventanas", unidad: "u", rendimiento: 0.8 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "7.3.21",
    descripcion: "VENTANA OSCILOBATIENTE ALUMINIO SERIE GALA 1.40x1.10m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Ventana oscilobatiente aluminio Gala 1.40x1.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Silicona para ventanas", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "7.3.22",
    descripcion: "VENTANA CORREDIZA ALUMINIO SERIE GALA 1.40x1.10m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Ventana corrediza aluminio Gala 1.40x1.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Silicona para ventanas", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "7.3.23",
    descripcion: "VENTANA CORREDIZA CON CORTINA LAMA TÉRMICA 1.40x1.10m",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Ventana corrediza con cortina lama térmica 1.40x1.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Silicona para ventanas", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.8 },
    ],
  },
  {
    codigo: "7.3.24",
    descripcion: "AMURE DE ABERTURAS DE ALUMINIO",
    capituloFallback: "Carpinter",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 2 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.005 },
      { descripcion: "Silicona para ventanas", unidad: "u", rendimiento: 0.2 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
];

async function buscarSubrubro(def: ApuDef) {
  const porCodigo = await p.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });
  if (porCodigo) return porCodigo;

  return p.subrubroEstandar.findFirst({
    where: {
      capitulo: { contains: def.capituloFallback, mode: "insensitive" },
      descripcion: { contains: def.descripcion, mode: "insensitive" },
    },
  });
}

async function main() {
  let creados = 0;
  let actualizados = 0;
  let noEncontrados = 0;

  for (const def of APUS) {
    const subrubro = await buscarSubrubro(def);

    if (!subrubro) {
      console.warn(`✗ No se encontró SubrubroEstandar para ${def.codigo} — ${def.descripcion}`);
      noEncontrados++;
      continue;
    }

    const existente = await p.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });

    const apu = existente
      ? await p.aPUEstandar.update({
          where: { subrubroId: subrubro.id },
          data: {},
        })
      : await p.aPUEstandar.create({
          data: { subrubroId: subrubro.id },
        });

    // Reemplazar materiales y MO para que el script sea idempotente
    await p.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await p.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });

    for (const m of def.materiales) {
      await p.materialAPUEstandar.create({
        data: { apuId: apu.id, descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento },
      });
    }
    for (const mo of def.manoObra) {
      await p.manoObraAPUEstandar.create({
        data: { apuId: apu.id, categoria: mo.categoria, jornadaHs: mo.jornadaHs, rendimiento: mo.rendimiento },
      });
    }

    if (existente) {
      console.log(`↻ Actualizado APUEstandar — ${subrubro.codigo} (${subrubro.descripcion})`);
      actualizados++;
    } else {
      console.log(`✓ Creado APUEstandar — ${subrubro.codigo} (${subrubro.descripcion})`);
      creados++;
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Creados:        ${creados}`);
  console.log(`Actualizados:   ${actualizados}`);
  console.log(`No encontrados: ${noEncontrados}`);
  console.log(`Total definidos: ${APUS.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
