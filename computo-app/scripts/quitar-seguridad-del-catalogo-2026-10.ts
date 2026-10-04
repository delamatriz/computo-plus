// Biblioteca — saca "Seguridad y Trabajos en Altura" del catálogo
// (CapituloCatalogo) ahora que sus rubros viven dentro de "Implantación y
// Replanteo".
//
// Lo que había (relevado oct-2026): no es una cáscara vacía — el capítulo del
// catálogo tiene 11 subrubros reales (2.1 Cerco de obra perimetral … 2.11
// Botiquín), sin subcapítulos, y 7 capítulos de proyecto lo referencian
// (Capitulo.capituloCatalogoId, sin onDelete: bloquean el borrado).
//
// Qué hace, en orden, en UNA transacción:
//  1. Crea (si falta) el subcapítulo "Seguridad y Trabajos en Altura" dentro de
//     "Implantación y Replanteo" y le MUEVE los 11 subrubros (mismo id, mismo
//     APU y precio, mismo orden relativo) — así no se pierde ninguno y siguen
//     apareciendo en "Ver subrubros típicos" de Implantación. Los códigos se
//     RENUMERAN con el esquema de Implantación, igual que los 1.1.x del
//     subcapítulo "Equipos y Maquinaria de Obra": <capítulo>.<n° de subcapítulo>.<n>
//     → 2.1…2.11 pasan a 1.2.1…1.2.11. Nada depende de los códigos viejos (no
//     figuran en el código, los seeds ni los prompts; el rubro de un proyecto no
//     guarda el código de Biblioteca).
//  2. Borra la fila CapituloCatalogo "Seguridad y Trabajos en Altura", SOLO si
//     ya no tiene subrubros, subcapítulos ni capítulos de proyecto.
//
// Orden de ejecución: DESPUÉS de la migración de proyectos
// (migrar-estructura-proyectos-2026-10.ts), que borra los 7 capítulos de
// proyecto. Mientras alguno exista, este script en --apply se NIEGA a escribir
// (el dry-run muestra el bloqueo).
//
// Idempotente: sin el catálogo viejo, no hace nada. El seed
// seed-capitulo-catalogo-seguridad-altura.ts (upsert que lo resucitaría) debe
// retirarse a scripts/_historico/ junto con este paso.
//
// Ejecutar (dry-run): npx tsx scripts/quitar-seguridad-del-catalogo-2026-10.ts
// Ejecutar (real):     npx tsx scripts/quitar-seguridad-del-catalogo-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const NOMBRE_SEGURIDAD = "Seguridad y Trabajos en Altura";
const NOMBRE_IMPLANTACION = "Implantación y Replanteo";
const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const seg = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_SEGURIDAD } });
  if (!seg) {
    console.log(`= "${NOMBRE_SEGURIDAD}" ya no está en el catálogo. Sin cambios.`);
    await db.$disconnect();
    return;
  }
  const impl = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_IMPLANTACION } });
  if (!impl) throw new Error(`No existe "${NOMBRE_IMPLANTACION}" en el catálogo`);

  const subrubros = await db.subrubroEstandar.findMany({ where: { capituloId: seg.id }, orderBy: [{ orden: "asc" }, { codigo: "asc" }] });
  const subcaps = await db.subcapituloCatalogo.count({ where: { capituloCatalogoId: seg.id } });
  const capsProyecto = await db.capitulo.findMany({
    where: { capituloCatalogoId: seg.id },
    select: { id: true, nombre: true, titulo: { select: { nombre: true, proyecto: { select: { nombre: true } } } }, _count: { select: { rubros: true } } },
  });

  console.log(`── "${NOMBRE_SEGURIDAD}" en el catálogo ──`);
  console.log(`  subrubros: ${subrubros.length} · subcapítulos: ${subcaps} · capítulos de proyecto que lo referencian: ${capsProyecto.length}`);
  for (const s of subrubros) console.log(`    ${s.codigo.padEnd(5)} ${s.descripcion.slice(0, 62).padEnd(62)} ${s.unidad.padEnd(3)} $${money(s.precioUY).padStart(10)}  activo=${s.activo}`);

  const subcapExistente = await db.subcapituloCatalogo.findFirst({ where: { capituloCatalogoId: impl.id, nombre: NOMBRE_SEGURIDAD } });
  const maxOrdenSub = (await db.subcapituloCatalogo.aggregate({ where: { capituloCatalogoId: impl.id }, _max: { orden: true } }))._max.orden ?? -1;
  console.log(`\n── Paso 1: mover los subrubros a "${NOMBRE_IMPLANTACION}" › "${NOMBRE_SEGURIDAD}" ──`);
  console.log(`  subcapítulo: ${subcapExistente ? "= ya existe" : `+ se crea (orden ${maxOrdenSub + 1})`} · ${subrubros.length} subrubros cambian de capítulo y de código (ids, APU y precios sin cambio)`);
  // Esquema de código de Implantación: 1.<orden del subcapítulo + 1>.<n> (como 1.1.1 en "Equipos y Maquinaria").
  const ordenSub = subcapExistente?.orden ?? maxOrdenSub + 1;
  const prefijo = `1.${ordenSub + 1}`;
  const codigosNuevos = new Map(subrubros.map((s, i) => [s.id, `${prefijo}.${i + 1}`]));
  const ocupados = await db.subrubroEstandar.findMany({ where: { codigo: { in: [...codigosNuevos.values()] }, id: { notIn: subrubros.map((s) => s.id) } }, select: { codigo: true } });
  if (ocupados.length > 0) throw new Error(`Códigos ya ocupados: ${ocupados.map((o) => o.codigo).join(", ")} — no se escribe nada`);
  for (const s of subrubros) console.log(`    ${s.codigo.padEnd(5)} → ${codigosNuevos.get(s.id)!.padEnd(7)} ${s.descripcion.slice(0, 60)}`);

  const bloqueos: string[] = [];
  if (capsProyecto.length > 0) {
    for (const c of capsProyecto) bloqueos.push(`capítulo de proyecto «${c.nombre}» (${c.titulo.proyecto.nombre.trim()} / ${c.titulo.nombre}, ${c._count.rubros} rubro(s))`);
  }
  console.log(`\n── Paso 2: borrar CapituloCatalogo "${NOMBRE_SEGURIDAD}" ──`);
  if (bloqueos.length > 0) {
    console.log(`  ⛔ BLOQUEADO — todavía lo referencian ${bloqueos.length} capítulo(s) de proyecto (la migración de proyectos los borra; correr esa antes):`);
    for (const b of bloqueos) console.log(`     · ${b}`);
  } else {
    console.log("  ✔ nada lo referencia: se borra la fila (después de mover los subrubros).");
  }

  if (aplicar) {
    if (bloqueos.length > 0) throw new Error("Hay capítulos de proyecto que referencian el capítulo del catálogo: correr antes migrar-estructura-proyectos-2026-10.ts. No se escribe nada.");
    await db.$transaction(
      async (tx) => {
        const sub = subcapExistente ?? (await tx.subcapituloCatalogo.create({ data: { capituloCatalogoId: impl.id, nombre: NOMBRE_SEGURIDAD, orden: maxOrdenSub + 1 } }));
        for (const s of subrubros) {
          const r = await tx.subrubroEstandar.updateMany({ where: { id: s.id, capituloId: seg.id }, data: { capituloId: impl.id, subcapituloId: sub.id, codigo: codigosNuevos.get(s.id)! } });
          if (r.count !== 1) throw new Error(`${s.codigo} cambió mientras tanto — se aborta`);
        }
        const restantes = await tx.subrubroEstandar.count({ where: { capituloId: seg.id } });
        if (restantes > 0 || subcaps > 0) throw new Error("Quedan subrubros o subcapítulos en el capítulo viejo — se aborta");
        await tx.capituloCatalogo.delete({ where: { id: seg.id } });
      },
      { timeout: 120_000 }
    );
  }

  console.log(aplicar ? "\nAPLICADO." : "\nDRY RUN: no se escribió nada. Para aplicar: --apply (con el OK de Luis, después de la migración de proyectos).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
