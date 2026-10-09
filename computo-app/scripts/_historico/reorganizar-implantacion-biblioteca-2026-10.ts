// Biblioteca — reorganización de "Implantación y Replanteo" (oct-2026).
//
// 1. Los subrubros directos (sin subcapítulo) pasan a 1.0.1, 1.0.2, … en el
//    orden actual. Así los prefijos 1.1 y 1.2 quedan solo para los
//    subcapítulos Equipos (1.1.x) y Seguridad (1.2.x): hoy 1.1 es "Cartel de
//    obra" y 1.2 "Cerco tejido", y en la Biblioteca parecen padres de esos
//    subcapítulos.
// 2. Subcapítulo nuevo "Cercos y Vallados de Obra" (1.3.x) con:
//      1.3.1 Cerco tejido galvanizado      (hoy 1.2, directo)
//      1.3.2 Barrera con tablas encofrado   (hoy 1.3, directo)
//      1.3.3 Cerco de obra perimetral de chapa (hoy 1.2.1, Seguridad;
//            se le saca "o tela": el APU es solo de chapa)
//      1.3.4 Baranda de protección perimetral (hoy 1.2.2, Seguridad)
//      1.3.5 Vallado peatonal de seguridad  (hoy 1.2.3, Seguridad)
// 3. Seguridad y Trabajos en Altura queda seguida: los activos 1.2.1, 1.2.2,
//    … en su orden actual y el desactivado (ex 1.2.6, plan de seguridad) al
//    final, así la Biblioteca (que solo muestra activos) no tiene huecos.
//
// Solo cambian codigo, orden, subcapituloId y (en uno) descripcion. Ids, APU
// y precios quedan igual. Ningún proyecto se toca: un rubro de proyecto es
// una copia sin vínculo con la Biblioteca, y nada guarda el código de un
// subrubro (Cálculo Rápido y el generador de APU lo usan en el momento,
// contra la Biblioteca en vivo).
//
// Los subrubros se identifican por su descripción, no por el código, así una
// segunda corrida después de aplicar no hace nada. Aborta sin escribir si
// alguno no aparece exactamente una vez o si un código nuevo ya lo usa otro
// subrubro. Como los códigos nuevos de Seguridad reusan los que dejan libres
// los cercos (1.2.1…), se aplica en dos pasos dentro de una transacción:
// primero un código provisorio único y después el definitivo.
//
// Ejecutar (dry-run): npx tsx scripts/reorganizar-implantacion-biblioteca-2026-10.ts
// Ejecutar (real):     npx tsx scripts/reorganizar-implantacion-biblioteca-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const CAPITULO = "Implantación y Replanteo";
const SUBCAP_CERCOS = "Cercos y Vallados de Obra";
const PREFIJO_DIRECTOS = "1.0";
const PREFIJO_CERCOS = "1.3";
const SUBCAP_SEGURIDAD = "Seguridad y Trabajos en Altura";
const PREFIJO_SEGURIDAD = "1.2";

// Subrubros que van a Cercos, en el orden del subcapítulo nuevo. `empieza`
// identifica al subrubro por el comienzo de su descripción (sin distinguir
// mayúsculas); `renombrar`, si corresponde, es la descripción nueva.
const CERCOS: { empieza: string; renombrar?: string }[] = [
  { empieza: "CERCO TEJIDO GALVANIZADO" },
  { empieza: "BARRERA H=2.20 CON TABLAS ENCOFRADO" },
  { empieza: "Cerco de obra perimetral", renombrar: "Cerco de obra perimetral de chapa" },
  { empieza: "Baranda de protección perimetral" },
  { empieza: "Vallado peatonal de seguridad" },
];

const numerico = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const cap = await db.capituloCatalogo.findUnique({
    where: { nombre: CAPITULO },
    include: { subcapitulos: { orderBy: { orden: "asc" } } },
  });
  if (!cap) throw new Error(`No existe el capítulo "${CAPITULO}" en el catálogo`);

  const subs = await db.subrubroEstandar.findMany({
    where: { capituloId: cap.id },
    include: { subcapituloCatalogo: true },
  });
  const nombreSubcap = (s: (typeof subs)[number]) => s.subcapituloCatalogo?.nombre ?? "(directo)";

  // ── Cercos: cada uno tiene que aparecer exactamente una vez ──
  const cercos = CERCOS.map((c) => {
    const hallados = subs.filter((s) => s.descripcion.trim().toLowerCase().startsWith(c.empieza.toLowerCase()));
    if (hallados.length !== 1) {
      throw new Error(`"${c.empieza}…" aparece ${hallados.length} veces en ${CAPITULO} (se esperaba 1) — no se escribe nada`);
    }
    return { ...c, s: hallados[0] };
  });
  const idsCercos = new Set(cercos.map((c) => c.s.id));

  // ── Directos activos que quedan (sin los que van a Cercos), en el orden actual ──
  const directos = subs
    .filter((s) => !s.subcapituloId && s.activo && !idsCercos.has(s.id))
    .sort((a, b) => (a.orden ?? Infinity) - (b.orden ?? Infinity) || numerico(a.codigo, b.codigo));
  const inactivosDirectos = subs.filter((s) => !s.subcapituloId && !s.activo && !idsCercos.has(s.id));

  // ── Seguridad que queda (sin los que van a Cercos): activos en su orden
  // actual y después los inactivos ──
  const porOrden = (a: (typeof subs)[number], b: (typeof subs)[number]) =>
    (a.orden ?? Infinity) - (b.orden ?? Infinity) || numerico(a.codigo, b.codigo);
  const deSeguridad = subs.filter((s) => s.subcapituloCatalogo?.nombre === SUBCAP_SEGURIDAD && !idsCercos.has(s.id));
  if (deSeguridad.length === 0) throw new Error(`No hay subrubros en "${SUBCAP_SEGURIDAD}" — no se escribe nada`);
  const seguridad = [...deSeguridad.filter((s) => s.activo).sort(porOrden), ...deSeguridad.filter((s) => !s.activo).sort(porOrden)];

  // ── Plan ──
  // subcapituloIdFinal: undefined = va a Cercos (se resuelve al aplicar).
  type Cambio = { id: string; antes: string; despues: string; descAntes: string; descDespues: string; subcapAntes: string; subcapDespues: string; orden: number; aSubcapCercos: boolean; subcapituloIdFinal?: string | null; activo: boolean };
  const cambios: Cambio[] = [
    ...directos.map((s, i) => ({
      id: s.id,
      antes: s.codigo,
      despues: `${PREFIJO_DIRECTOS}.${i + 1}`,
      descAntes: s.descripcion,
      descDespues: s.descripcion,
      subcapAntes: nombreSubcap(s),
      subcapDespues: "(directo)",
      orden: i + 1,
      aSubcapCercos: false,
      subcapituloIdFinal: null,
      activo: s.activo,
    })),
    ...seguridad.map((s, i) => ({
      id: s.id,
      antes: s.codigo,
      despues: `${PREFIJO_SEGURIDAD}.${i + 1}`,
      descAntes: s.descripcion,
      descDespues: s.descripcion,
      subcapAntes: SUBCAP_SEGURIDAD,
      subcapDespues: SUBCAP_SEGURIDAD,
      orden: i + 1,
      aSubcapCercos: false,
      subcapituloIdFinal: s.subcapituloId,
      activo: s.activo,
    })),
    ...cercos.map((c, i) => ({
      id: c.s.id,
      antes: c.s.codigo,
      despues: `${PREFIJO_CERCOS}.${i + 1}`,
      descAntes: c.s.descripcion,
      descDespues: c.renombrar ?? c.s.descripcion,
      subcapAntes: nombreSubcap(c.s),
      subcapDespues: SUBCAP_CERCOS,
      orden: i + 1,
      aSubcapCercos: true,
      activo: c.s.activo,
    })),
  ];

  // Ningún código nuevo puede pertenecer a otro subrubro (de cualquier capítulo).
  const idsCambian = new Set(cambios.map((c) => c.id));
  const ocupados = await db.subrubroEstandar.findMany({
    where: { codigo: { in: cambios.map((c) => c.despues) }, id: { notIn: [...idsCambian] } },
    select: { codigo: true, descripcion: true },
  });
  if (ocupados.length > 0) {
    throw new Error(`Códigos nuevos ya usados por otros subrubros: ${ocupados.map((o) => `${o.codigo} (${o.descripcion})`).join(", ")} — no se escribe nada`);
  }

  const subcapExistente = cap.subcapitulos.find((sc) => sc.nombre === SUBCAP_CERCOS);
  const ordenSubcapNuevo = Math.max(0, ...cap.subcapitulos.map((sc) => sc.orden)) + 1;

  console.log(`── Subcapítulos de ${CAPITULO} ──`);
  for (const sc of cap.subcapitulos) console.log(`  orden ${sc.orden} · ${sc.nombre}`);
  console.log(
    subcapExistente
      ? `  = "${SUBCAP_CERCOS}" ya existe (orden ${subcapExistente.orden}).`
      : `  + "${SUBCAP_CERCOS}" se crea con orden ${ordenSubcapNuevo}.`
  );

  const pendientes = cambios.filter((c) => {
    const s = subs.find((x) => x.id === c.id)!;
    const subcapOk = c.aSubcapCercos ? s.subcapituloCatalogo?.nombre === SUBCAP_CERCOS : s.subcapituloId === c.subcapituloIdFinal;
    return s.codigo !== c.despues || s.orden !== c.orden || s.descripcion !== c.descDespues || !subcapOk;
  });

  console.log(`\n── Renumeración de directos (${directos.length}) ──`);
  for (const c of cambios.filter((x) => x.subcapituloIdFinal === null)) {
    console.log(`  ${c.antes.padEnd(6)} → ${c.despues.padEnd(7)} ${c.descAntes}`);
  }
  console.log(`\n── Renumeración de "${SUBCAP_SEGURIDAD}" (${seguridad.length}) ──`);
  for (const c of cambios.filter((x) => x.subcapAntes === SUBCAP_SEGURIDAD && !x.aSubcapCercos)) {
    console.log(`  ${c.antes.padEnd(6)} → ${c.despues.padEnd(7)} ${c.descAntes}${c.activo ? "" : "  [INACTIVO]"}`);
  }
  console.log(`\n── A "${SUBCAP_CERCOS}" (${cercos.length}) ──`);
  for (const c of cambios.filter((x) => x.aSubcapCercos)) {
    const renombre = c.descAntes !== c.descDespues ? `\n         renombre: «${c.descAntes}» → «${c.descDespues}»` : "";
    console.log(`  ${c.antes.padEnd(6)} → ${c.despues.padEnd(7)} ${c.descAntes}  [${c.subcapAntes} → ${c.subcapDespues}]${renombre}`);
  }
  if (inactivosDirectos.length > 0) {
    console.log(`\n  Directos INACTIVOS que no se tocan: ${inactivosDirectos.map((s) => `${s.codigo} ${s.descripcion}`).join(" · ")}`);
  }

  // Informativo: rubros de proyectos con el nombre viejo del cerco de chapa
  // (copias propias del proyecto: no cambian ni se rompen).
  const viejo = cercos.find((c) => c.renombrar)!;
  const copias = await db.rubro.count({ where: { descripcion: viejo.s.descripcion } });
  console.log(`\n  Rubros de proyectos con el nombre «${viejo.s.descripcion}»: ${copias} (no se tocan).`);

  if (pendientes.length === 0 && subcapExistente) {
    console.log("\n= Ya está todo aplicado. Sin cambios.");
    await db.$disconnect();
    return;
  }
  console.log(`\nCambios a escribir: ${pendientes.length} subrubro(s)${subcapExistente ? "" : " + 1 subcapítulo"}.`);

  if (aplicar) {
    await db.$transaction(async (tx) => {
      const subcap =
        subcapExistente ??
        (await tx.subcapituloCatalogo.create({
          data: { capituloCatalogoId: cap.id, nombre: SUBCAP_CERCOS, orden: ordenSubcapNuevo },
        }));
      // Paso 1: código provisorio único (libera los códigos que se reusan).
      for (const c of pendientes) {
        await tx.subrubroEstandar.update({ where: { id: c.id }, data: { codigo: `tmp-reorg-${c.id}` } });
      }
      // Paso 2: estado final.
      for (const c of pendientes) {
        await tx.subrubroEstandar.update({
          where: { id: c.id },
          data: {
            codigo: c.despues,
            orden: c.orden,
            descripcion: c.descDespues,
            subcapituloId: c.aSubcapCercos ? subcap.id : (c.subcapituloIdFinal ?? null),
          },
        });
      }
    }, { timeout: 120000 });
  }

  console.log(aplicar ? "\nAPLICADO." : "\nDRY RUN: no se escribió nada. Para aplicar: --apply (con el OK de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
