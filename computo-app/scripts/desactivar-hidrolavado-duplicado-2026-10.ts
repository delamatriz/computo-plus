// Biblioteca — "Hidrolavado de superficies" estaba duplicado: 7.14.1
// (Albañilería › Patología de Fachada) y 9.2.8 (Impermeabilizaciones y
// Aislaciones › Preparación y Aislación Complementaria), con la misma
// descripción, unidad, precio y APU. Luis decidió que queda el de Albañilería
// (7.14.1): se DESACTIVA 9.2.8 (activo=false). No se borra: es reversible, y
// los paneles "Ver subrubros típicos" y Cálculo Rápido solo leen subrubros
// activos (mismo criterio que con Cepol, 9.2.2).
//
// Seguridad: antes de escribir verifica que 7.14.1 y 9.2.8 sean IDÉNTICAS
// (descripción, unidad, precioUY, GG, utilidad, % de piedra y todos los
// insumos: materiales, mano de obra con rendimiento y jornada, equipos). Si
// algo difiere, aborta sin escribir. Nada en el código, los seeds ni los
// proyectos referencia 9.2.8 por código (un rubro de proyecto no guarda el
// código de Biblioteca): los rubros de proyectos que ya la usaron no se tocan.
//
// Idempotente: si 9.2.8 ya está inactiva con la nota, no hace nada.
//
// Ejecutar (dry-run): npx tsx scripts/desactivar-hidrolavado-duplicado-2026-10.ts
// Ejecutar (real):     npx tsx scripts/desactivar-hidrolavado-duplicado-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const QUEDA = "7.14.1";
const SE_SACA = "9.2.8";
const NOTA = "duplicado de 7.14.1, desactivado oct-2026";
const TOL = 1e-9;

async function cargar(codigo: string) {
  const s = await db.subrubroEstandar.findUnique({
    where: { codigo },
    include: {
      capituloCatalogo: true,
      subcapituloCatalogo: true,
      apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } },
    },
  });
  if (!s?.apuEstandar) throw new Error(`No se encontró ${codigo} con APU`);
  return s;
}

type Sub = Awaited<ReturnType<typeof cargar>>;

// Firma comparable del contenido (sin ids ni orden de las filas).
function firma(s: Sub) {
  const a = s.apuEstandar!;
  const f = (xs: (string | number)[][]) => xs.map((x) => x.join("|")).sort();
  return {
    descripcion: s.descripcion.trim(),
    unidad: s.unidad,
    precioUY: s.precioUY,
    apu: [a.gastosGeneralesPct, a.utilidadPct, a.porcentajePiedra].join("|"),
    materiales: f(a.materiales.map((m) => [m.descripcion, m.unidad, m.rendimiento])),
    manoObra: f(a.manoObra.map((m) => [m.categoria, m.jornadaHs, m.rendimiento])),
    equipos: f(a.equipos.map((m) => [m.descripcion, m.unidad, m.rendimiento])),
  };
}

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const queda = await cargar(QUEDA);
  const saca = await cargar(SE_SACA);
  const fq = firma(queda), fs = firma(saca);

  const dif: string[] = [];
  if (fq.descripcion !== fs.descripcion) dif.push("descripción");
  if (fq.unidad !== fs.unidad) dif.push("unidad");
  if (Math.abs(fq.precioUY - fs.precioUY) > TOL) dif.push(`precioUY (${fq.precioUY} vs ${fs.precioUY})`);
  if (fq.apu !== fs.apu) dif.push("GG/utilidad/% piedra");
  for (const k of ["materiales", "manoObra", "equipos"] as const) if (JSON.stringify(fq[k]) !== JSON.stringify(fs[k])) dif.push(k);

  const fila = (s: Sub) =>
    `${s.codigo} · ${s.capituloCatalogo?.nombre ?? "—"} › ${s.subcapituloCatalogo?.nombre ?? "—"} · ${s.unidad} · $${s.precioUY} · activo=${s.activo} · origen=${s.origen}`;
  console.log("── Las dos filas ──");
  console.log(`  QUEDA     ${fila(queda)}`);
  console.log(`  SE SACA   ${fila(saca)}`);
  console.log(`  APU (mismo en ambas): GG/utilidad/piedra ${fq.apu} · MO ${fq.manoObra.join(" ; ")} · equipos ${fq.equipos.join(" ; ") || "—"} · materiales ${fq.materiales.join(" ; ") || "—"}`);

  if (!queda.activo) throw new Error(`${QUEDA} está inactiva: no se desactiva el duplicado si la que queda no está activa`);
  if (dif.length > 0) throw new Error(`${QUEDA} y ${SE_SACA} NO son idénticas (${dif.join(", ")}) — no se escribe nada`);
  console.log("  ✔ Idénticas en descripción, unidad, precio y todo el APU.\n");

  const yaListo = !saca.activo && (saca.notasInternas ?? "").includes(NOTA);
  if (yaListo) {
    console.log(`  = ${SE_SACA} ya está desactivada con la nota. Sin cambios.`);
  } else {
    const nota = saca.notasInternas && saca.notasInternas.trim() ? (saca.notasInternas.includes(NOTA) ? saca.notasInternas : `${saca.notasInternas} ${NOTA}`) : NOTA;
    console.log(`  → ${SE_SACA}: activo ${saca.activo} → false · notasInternas: ${saca.notasInternas ? `«${saca.notasInternas}» → ` : "(vacío) → "}«${nota}»`);
    if (aplicar) {
      const r = await db.subrubroEstandar.updateMany({
        where: { id: saca.id, activo: saca.activo, notasInternas: saca.notasInternas },
        data: { activo: false, notasInternas: nota },
      });
      if (r.count !== 1) throw new Error(`${SE_SACA} cambió mientras tanto — se aborta`);
    }
  }

  console.log("\n── No se toca ──");
  console.log("  Ningún proyecto (los rubros ya clonados no tienen vínculo con la Biblioteca), ni 7.14.1, ni precios ni APU.");
  console.log(aplicar ? "\nAPLICADO." : "\nDRY RUN: no se escribió nada. Para aplicar: --apply (con el OK de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
