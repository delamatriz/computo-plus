// Redondea a 2 decimales los precios ya guardados con colas de coma flotante
// (ej. 49097.390451515996) — desde el commit 6ba68e1 todo precio nuevo se
// guarda redondeado (redondearPrecio en lib/apu-calc.ts); esto limpia lo que
// quedó de antes.
//
// Qué toca (solo filas con más de 2 decimales):
//  - Rubro.precioUnit
//  - MaterialAPU.precioUnit, ComponenteAPU.precioUnit, EquipoAPU.costoUnit y
//    EquipoAPU.costoUnitPropio (precios de los APU de proyecto)
//  - SubrubroEstandar.precioUY (biblioteca)
// Qué NO toca:
//  - Proyectos FINALIZADO (ni sus rubros ni sus APU): el presupuesto ya se
//    entregó, se listan aparte.
//  - Rubros con precioCongelado (precio pactado), ni su APU: se listan aparte.
//  - Porcentajes (Aportes Patronales, Utilidad): no son precios.
//
// La diferencia por fila es menor a medio centésimo; el script muestra, por
// proyecto, cuánto cambia el total (cantidad × diferencia).
//
// Idempotente: después de aplicar no queda ninguna fila con más de 2
// decimales en el alcance. Cada UPDATE lleva el valor leído en el where (si
// alguien lo editó entre la lectura y la escritura, esa fila no se pisa).
//
// Ejecutar (dry-run, no escribe nada):  npx tsx scripts/redondear-precios-existentes-2026-10.ts
// Ejecutar (real):                       npx tsx scripts/redondear-precios-existentes-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });
const APLICAR = process.argv.includes("--apply");

const redondear = (v: number) => Math.round(v * 100) / 100;
const sucio = (v: number | null | undefined): v is number => v != null && Math.abs(v * 100 - Math.round(v * 100)) > 1e-6;
const fmt = (v: number) => v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 6 });

async function main() {
  console.log(APLICAR ? "Modo: APPLY (escribe en la base)" : "Modo: DRY-RUN (no escribe nada)");

  const proyectos = await db.proyecto.findMany({
    select: {
      id: true,
      nombre: true,
      estado: true,
      empresa: { select: { nombre: true } },
      capitulos: {
        select: {
          rubros: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
              cantidad: true,
              precioUnit: true,
              precioCongelado: true,
              apu: {
                select: {
                  materiales: { select: { id: true, precioUnit: true, componentes: { select: { id: true, precioUnit: true } } } },
                  equipos: { select: { id: true, costoUnit: true, costoUnitPropio: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { nombre: "asc" },
  });

  type Cambio = { tabla: string; id: string; campo: string; antes: number; despues: number };
  const cambios: Cambio[] = [];
  const excluidosFinalizado: string[] = [];
  const excluidosCongelado: string[] = [];

  console.log("\nProyectos");
  for (const p of proyectos) {
    const rubros = p.capitulos.flatMap((c) => c.rubros);
    const sucios = rubros.filter((r) => sucio(r.precioUnit) || (r.apu && (r.apu.materiales.some((m) => sucio(m.precioUnit) || m.componentes.some((c) => sucio(c.precioUnit))) || r.apu.equipos.some((e) => sucio(e.costoUnit) || sucio(e.costoUnitPropio)))));
    if (sucios.length === 0) continue;
    if (p.estado === "FINALIZADO") {
      excluidosFinalizado.push(`${p.nombre} (${p.empresa?.nombre ?? "sin empresa"}) — ${sucios.length} rubros`);
      continue;
    }
    let rubrosProyecto = 0;
    let deltaTotal = 0;
    let deltaMax = 0;
    let lineasApu = 0;
    for (const r of sucios) {
      if (r.precioCongelado != null) {
        excluidosCongelado.push(`${p.nombre} / ${r.codigo} ${r.descripcion.slice(0, 50)}`);
        continue;
      }
      if (sucio(r.precioUnit)) {
        const despues = redondear(r.precioUnit);
        cambios.push({ tabla: "Rubro", id: r.id, campo: "precioUnit", antes: r.precioUnit, despues });
        rubrosProyecto++;
        deltaTotal += (despues - r.precioUnit) * r.cantidad;
        deltaMax = Math.max(deltaMax, Math.abs(despues - r.precioUnit));
      }
      for (const m of r.apu?.materiales ?? []) {
        if (sucio(m.precioUnit)) { cambios.push({ tabla: "MaterialAPU", id: m.id, campo: "precioUnit", antes: m.precioUnit, despues: redondear(m.precioUnit) }); lineasApu++; }
        for (const c of m.componentes) if (sucio(c.precioUnit)) { cambios.push({ tabla: "ComponenteAPU", id: c.id, campo: "precioUnit", antes: c.precioUnit, despues: redondear(c.precioUnit) }); lineasApu++; }
      }
      for (const e of r.apu?.equipos ?? []) {
        if (sucio(e.costoUnit)) { cambios.push({ tabla: "EquipoAPU", id: e.id, campo: "costoUnit", antes: e.costoUnit, despues: redondear(e.costoUnit) }); lineasApu++; }
        if (sucio(e.costoUnitPropio)) { cambios.push({ tabla: "EquipoAPU", id: e.id, campo: "costoUnitPropio", antes: e.costoUnitPropio, despues: redondear(e.costoUnitPropio) }); lineasApu++; }
      }
    }
    if (rubrosProyecto + lineasApu > 0) {
      console.log(`  · ${p.nombre} (${p.empresa?.nombre ?? "sin empresa"}, ${p.estado}): ${rubrosProyecto} rubros, ${lineasApu} líneas de APU — diferencia máx. por unidad ${fmt(deltaMax)}, cambio del total ${deltaTotal >= 0 ? "+" : ""}${fmt(deltaTotal)}`);
    }
  }

  const subrubros = await db.subrubroEstandar.findMany({ select: { id: true, codigo: true, descripcion: true, precioUY: true } });
  const subSucios = subrubros.filter((s) => sucio(s.precioUY));
  console.log(`\nBiblioteca: ${subSucios.length} subrubros`);
  for (const s of subSucios) {
    const despues = redondear(s.precioUY);
    cambios.push({ tabla: "SubrubroEstandar", id: s.id, campo: "precioUY", antes: s.precioUY, despues });
    console.log(`  · ${s.codigo} ${s.descripcion.slice(0, 55)}: ${s.precioUY} → ${despues}`);
  }

  console.log(`\nExcluidos — proyecto FINALIZADO (${excluidosFinalizado.length}):${excluidosFinalizado.length ? "\n  · " + excluidosFinalizado.join("\n  · ") : " ninguno"}`);
  console.log(`Excluidos — rubro con precio congelado (${excluidosCongelado.length}):${excluidosCongelado.length ? "\n  · " + excluidosCongelado.join("\n  · ") : " ninguno"}`);

  const porTabla = cambios.reduce<Record<string, number>>((acc, c) => ({ ...acc, [`${c.tabla}.${c.campo}`]: (acc[`${c.tabla}.${c.campo}`] ?? 0) + 1 }), {});
  console.log(`\nTotal a redondear: ${cambios.length} — ${JSON.stringify(porTabla)}`);
  for (const c of cambios.filter((c) => c.tabla === "Rubro").slice(0, 5)) console.log(`  ej. Rubro ${c.antes} → ${c.despues}`);

  if (!APLICAR) {
    console.log("\nDry-run: no se escribió nada. Correr con --apply para aplicar.");
    return;
  }

  let escritos = 0;
  for (const c of cambios) {
    const where = { id: c.id, [c.campo]: c.antes };
    const data = { [c.campo]: c.despues };
    const r =
      c.tabla === "Rubro" ? await db.rubro.updateMany({ where, data })
      : c.tabla === "MaterialAPU" ? await db.materialAPU.updateMany({ where, data })
      : c.tabla === "ComponenteAPU" ? await db.componenteAPU.updateMany({ where, data })
      : c.tabla === "EquipoAPU" ? await db.equipoAPU.updateMany({ where, data })
      : await db.subrubroEstandar.updateMany({ where, data });
    escritos += r.count;
  }
  console.log(`\n✓ ${escritos} de ${cambios.length} filas redondeadas${escritos < cambios.length ? " (el resto cambió entre la lectura y la escritura — no se pisó)" : ""}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
