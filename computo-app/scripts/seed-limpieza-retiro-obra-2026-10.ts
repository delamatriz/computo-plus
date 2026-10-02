// Biblioteca — capítulo nuevo "Limpieza y Retiro de Obra" (código 28) con 8
// rubros (28.1-28.8).
//
// Antes de este script, lo único de "limpieza" en la Biblioteca eran rubros
// sueltos en otros capítulos: 1.4 (limpieza de terreno, Implantación), 4.1
// (desmonte y limpieza, Excavaciones) y 7.14.4 "LIMPIEZA FINAL DE OBRA
// (entrega)" (metido en Albañilería > Patología de Fachada, ubicación
// incorrecta). Este script NO toca ninguno de esos tres.
//
// Código de capítulo 28: el 22 quedó libre cuando se eliminó "Gastos
// Administrativos y Conexiones" y no se reutiliza a propósito, para no
// mezclar códigos viejos con un capítulo nuevo; 28 es el siguiente después
// de 27 (Domótica). CapituloCatalogo.orden = código - 1 (misma relación que
// tienen todos los capítulos existentes).
//
// Convención de precioUY: costoDirecto × (1 + GG) × (1 + Utilidad 10%).
// GG_PCT = 0 — mismo criterio que Implantación (1.11, 1.23) y Eléctrica
// (11.5.1) en la base hoy, y que la nota de APUEstandar en schema.prisma
// ("la biblioteca dejó de aplicar Gastos Generales a su precio de
// referencia"). Ojo: seed-gas-incendio-expansion-2026-09.ts todavía usa 15 —
// esos 9 códigos quedaron con ×1.265, inconsistentes con el resto. Si se
// prefiere el criterio de Gas/Incendio, cambiar GG_PCT a 15 acá.
//
// PrecioMTOP: los materiales nuevos se CREAN si no existen y NO se tocan si
// ya existen (a diferencia de la expansión de Gas/Incendio, que reescribe el
// precio en cada corrida) — así correr el script de nuevo nunca pisa un
// precio corregido a mano o por la verificación automática. Quedan con
// fechaUltimaVerificacion null (= "Pendiente de verificar") porque los
// precios son estimaciones sin revisar.
//
// Reutiliza sin duplicar: IMPL-013 (volqueta/contenedor, ya existente) y
// MAT-INSUMOS-LIMPIEZA-FINAL (ya usado por 7.14.4).
//
// Las descripciones (aptas para imprimir al cliente) y las notasInternas de
// 28.1, 28.3, 28.5, 28.6 y 28.7 se mantienen en
// textos-limpieza-retiro-obra-2026-10.ts: mantener ambos archivos
// sincronizados, o volver a correr este seed revierte los textos. Un rubro
// sin `notasInternas` acá no toca esa columna.
//
// Ejecutar (dry-run): npx tsx scripts/seed-limpieza-retiro-obra-2026-10.ts
// Ejecutar (real):     npx tsx scripts/seed-limpieza-retiro-obra-2026-10.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-10";
const GG_PCT = 0;
const UTIL_PCT = 10;

const CAPITULO = { nombre: "Limpieza y Retiro de Obra", orden: 27 };
const NOTA = "Estimado por IA (Claude), pendiente de revisión manual — biblioteca Limpieza y Retiro de Obra, oct-2026";

const PRECIOS_MTOP_NUEVOS = [
  {
    codigo: "LIMP-001",
    descripcion: "Insumos de limpieza periódica de obra (bolsas de residuos, escobas, palas y herramientas menores)",
    unidad: "gl",
    precioUnitario: 1800,
  },
  {
    codigo: "LIMP-002",
    descripcion: "Insumos de limpieza fina de pisos (detergente neutro, desengrasante, protector y paños)",
    unidad: "m2",
    precioUnitario: 22,
  },
] as const;

// Ya existentes — precio leído en vivo, nunca hardcodeado.
const CODIGOS_REUTILIZADOS = ["IMPL-013", "MAT-INSUMOS-LIMPIEZA-FINAL"] as const;

type MaterialDef = { precioCodigo: string; rendimiento: number };
type ManoObraDef = { categoria: string; rendimiento: number };

const NOTA_NO_SUMAR = "No sumar si ya se presupuestó la limpieza final de obra (28.7), que ya incluye este trabajo.";

const RUBROS: {
  codigo: string;
  descripcion: string;
  notasInternas?: string;
  unidad: string;
  orden: number;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
}[] = [
  {
    // 10 jornadas de peón por mes (media jornada diaria en obra chica/mediana).
    codigo: "28.1",
    descripcion: "Limpieza periódica de obra — mantenimiento mensual",
    notasInternas: "Calculada con 10 jornadas de peón por mes, pensada para obra chica a mediana. Ajustar las jornadas según el tamaño de la obra.",
    unidad: "MES",
    orden: 0,
    materiales: [{ precioCodigo: "LIMP-001", rendimiento: 1 }],
    manoObra: [{ categoria: "Peón", rendimiento: 0.1 }],
  },
  {
    // Mismo APU que 1.11 (Implantación). Se deja igual a pedido: queda
    // duplicado a propósito hasta que se decida cuál conservar.
    codigo: "28.2",
    descripcion: "Alquiler de volqueta — entrega, estadía y retiro",
    unidad: "U",
    orden: 1,
    materiales: [{ precioCodigo: "IMPL-013", rendimiento: 1 }],
    manoObra: [{ categoria: "Peón", rendimiento: 4 }],
  },
  {
    // Volqueta de 6 m3 (PrecioEquipo EQ-VOLQUETA) → 1/6 de volqueta por m3.
    // Carga manual de escombros: ~3 m3 por jornada de peón.
    codigo: "28.3",
    descripcion: "Retiro de escombros (carga manual y volqueta de 6 m³, capacidad estándar en plaza)",
    notasInternas: "El m³ se mide suelto: el volumen que ocupa el material ya cargado en la volqueta, no en banco. Si la cantidad sale de los planos (volumen del elemento demolido), aplicar el factor de esponjamiento del material: el volumen suelto es mayor y la volqueta se llena antes.",
    unidad: "M3",
    orden: 2,
    materiales: [{ precioCodigo: "IMPL-013", rendimiento: 0.1667 }],
    manoObra: [{ categoria: "Peón", rendimiento: 3 }],
  },
  {
    // Media volqueta + 2 jornadas de peón por GL.
    codigo: "28.4",
    descripcion: "Retiro de sobrantes de materiales",
    unidad: "GL",
    orden: 3,
    materiales: [{ precioCodigo: "IMPL-013", rendimiento: 0.5 }],
    manoObra: [{ categoria: "Peón", rendimiento: 0.5 }],
  },
  {
    codigo: "28.5",
    descripcion: "Limpieza de vidrios y aberturas — trabajo puntual, distinto de la limpieza final de obra",
    notasInternas: NOTA_NO_SUMAR,
    unidad: "M2",
    orden: 4,
    materiales: [{ precioCodigo: "MAT-INSUMOS-LIMPIEZA-FINAL", rendimiento: 1 }],
    manoObra: [{ categoria: "Peón", rendimiento: 25 }],
  },
  {
    codigo: "28.6",
    descripcion: "Limpieza fina de pisos — trabajo puntual, distinto de la limpieza final de obra",
    notasInternas: NOTA_NO_SUMAR,
    unidad: "M2",
    orden: 5,
    materiales: [{ precioCodigo: "LIMP-002", rendimiento: 1 }],
    manoObra: [{ categoria: "Peón", rendimiento: 30 }],
  },
  {
    // Mismo APU que 7.14.4 (que sigue en Albañilería > Patología de Fachada).
    codigo: "28.7",
    descripcion: "Limpieza final de obra (entrega) — incluye pisos, vidrios, aberturas y sanitarios; no incluye retiro de escombros ni de sobrantes",
    unidad: "M2",
    orden: 6,
    materiales: [{ precioCodigo: "MAT-INSUMOS-LIMPIEZA-FINAL", rendimiento: 1 }],
    manoObra: [{ categoria: "Peón", rendimiento: 45 }],
  },
  {
    // Desarme de casilla/container y cercos: ~2 jornadas de oficial albañil +
    // 4 de peón, más una volqueta de escombros/descartes.
    codigo: "28.8",
    descripcion: "Desmonte y retiro de obrador",
    unidad: "GL",
    orden: 7,
    materiales: [{ precioCodigo: "IMPL-013", rendimiento: 1 }],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 0.5 },
      { categoria: "Peón", rendimiento: 0.25 },
    ],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  // ── 1. Capítulo de catálogo ────────────────────────────────────────
  console.log("── CapituloCatalogo ──");
  let capitulo = await db.capituloCatalogo.findUnique({ where: { nombre: CAPITULO.nombre } });
  console.log(`  ${capitulo ? "= ya existe" : "+ crea"} "${CAPITULO.nombre}" (orden ${CAPITULO.orden})`);
  if (aplicar) {
    capitulo = await db.capituloCatalogo.upsert({
      where: { nombre: CAPITULO.nombre },
      create: { nombre: CAPITULO.nombre, orden: CAPITULO.orden, activo: true },
      update: { orden: CAPITULO.orden, activo: true },
    });
  }

  // ── 2. PrecioMTOP nuevos (solo crear, nunca pisar) ────────────────
  console.log("\n── PrecioMTOP nuevos ──");
  for (const p of PRECIOS_MTOP_NUEVOS) {
    const existente = await db.precioMTOP.findFirst({ where: { codigo: p.codigo, proveedor: null } });
    console.log(`  ${existente ? "= ya existe (no se toca)" : "+ nuevo"} — ${p.codigo} — ${p.descripcion} ($${p.precioUnitario}/${p.unidad})`);
    if (aplicar && !existente) {
      await db.precioMTOP.create({
        data: {
          codigo: p.codigo,
          descripcion: p.descripcion,
          cantidadUnidad: `1 ${p.unidad}`,
          unidad: p.unidad,
          cantidad: 1,
          precioConIva: p.precioUnitario,
          precioUnitario: p.precioUnitario,
          numeroLista: 0,
          fechaLista: FECHA,
          notaProcedencia: NOTA,
        },
      });
    }
  }

  // ── 3. Precios de referencia (nuevos + reutilizados) ──────────────
  const existentes = await db.precioMTOP.findMany({ where: { codigo: { in: [...CODIGOS_REUTILIZADOS] } } });
  const precioPorCodigo = new Map<string, { descripcion: string; unidad: string; precioUnitario: number }>();
  for (const p of PRECIOS_MTOP_NUEVOS) precioPorCodigo.set(p.codigo, p);
  console.log("\n── Materiales reutilizados (precio en vivo) ──");
  for (const codigo of CODIGOS_REUTILIZADOS) {
    const p = existentes.find((x) => x.codigo === codigo);
    if (!p) {
      console.error(`  ⚠ ${codigo} NO ENCONTRADO en PrecioMTOP — abortando.`);
      await db.$disconnect();
      process.exit(1);
    }
    console.log(`  = ${codigo} — $${p.precioUnitario}/${p.unidad}`);
    precioPorCodigo.set(codigo, { descripcion: p.descripcion, unidad: p.unidad, precioUnitario: p.precioUnitario });
  }

  // ── 4. Jornales vigentes ───────────────────────────────────────────
  const categorias = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) => {
    const c = categorias.find((x) => x.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    if (!c) throw new Error(`Categoría laboral "${nombre}" no existe`);
    return c.jornal;
  };

  // ── 5. SubrubroEstandar + APUEstandar ─────────────────────────────
  console.log("\n── SubrubroEstandar + APUEstandar ──");
  let creados = 0;
  let actualizados = 0;
  for (const def of RUBROS) {
    const sumMat = def.materiales.reduce((s, m) => s + m.rendimiento * precioPorCodigo.get(m.precioCodigo)!.precioUnitario, 0);
    const sumMO = def.manoObra.reduce((s, mo) => s + jornalPorNombre(mo.categoria) / mo.rendimiento, 0);
    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    const yaExiste = await db.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });
    console.log(
      `  ${yaExiste ? "= actualiza" : "+ crea"} ${def.codigo} — ${def.descripcion} (${def.unidad}) — $${precioUY}/${def.unidad}  [mat $${sumMat.toFixed(2)} + MO $${sumMO.toFixed(2)}]`
    );
    for (const m of def.materiales) {
      const p = precioPorCodigo.get(m.precioCodigo)!;
      console.log(`      material: ${p.descripcion} — rend ${m.rendimiento} ${p.unidad} — $${p.precioUnitario}`);
    }
    for (const mo of def.manoObra) console.log(`      MO: ${mo.categoria} — ${mo.rendimiento} ${def.unidad}/jornada — jornal $${jornalPorNombre(mo.categoria)}`);

    if (!aplicar) continue;

    const subrubro = await db.subrubroEstandar.upsert({
      where: { codigo: def.codigo },
      create: {
        codigo: def.codigo,
        descripcion: def.descripcion,
        ...(def.notasInternas !== undefined && { notasInternas: def.notasInternas }),
        unidad: def.unidad,
        precioUY,
        fechaBase: FECHA,
        origen: "manual",
        orden: def.orden,
        capituloId: capitulo!.id,
      },
      update: {
        descripcion: def.descripcion,
        ...(def.notasInternas !== undefined && { notasInternas: def.notasInternas }),
        unidad: def.unidad,
        precioUY,
        fechaBase: FECHA,
        orden: def.orden,
        capituloId: capitulo!.id,
      },
    });
    if (yaExiste) actualizados++;
    else creados++;

    const apuExistente = await db.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });
    const apu = apuExistente
      ? await db.aPUEstandar.update({ where: { subrubroId: subrubro.id }, data: {} })
      : await db.aPUEstandar.create({ data: { subrubroId: subrubro.id } });

    await db.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    for (const m of def.materiales) {
      const p = precioPorCodigo.get(m.precioCodigo)!;
      await db.materialAPUEstandar.create({
        data: { apuId: apu.id, descripcion: p.descripcion, unidad: p.unidad, rendimiento: m.rendimiento },
      });
    }
    for (const mo of def.manoObra) {
      await db.manoObraAPUEstandar.create({
        data: { apuId: apu.id, categoria: mo.categoria, jornadaHs: 8, rendimiento: mo.rendimiento },
      });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO" : "DRY RUN (nada escrito)"}`);
  if (aplicar) {
    console.log(`SubrubroEstandar creados: ${creados}, actualizados: ${actualizados}`);
    console.log(`Total subrubros en "${CAPITULO.nombre}": ${await db.subrubroEstandar.count({ where: { capituloId: capitulo!.id } })}`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
