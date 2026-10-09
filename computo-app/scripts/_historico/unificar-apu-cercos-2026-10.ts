// Biblioteca — unifica los APU de los tres cercos de obra (Implantación y
// Replanteo › Cercos y Vallados de Obra), según lo decidido por Luis:
//
//   1.3.1 Cerco tejido galvanizado: MO "Oficial especializado" + "Peón" →
//         "Oficial albañil" + "Ayudante", rendimiento 8 ml/jornal sin cambio;
//         se saca el equipo "Andamio tubular" (no tiene sentido en un cerco a
//         nivel de piso). El hormigón ya es "Hormigón pobre para bases".
//   1.3.2 Barrera con tablas de encofrado: "Peón" → "Ayudante"; rendimiento
//         de "Oficial albañil" y "Ayudante" de 8 a 15 ml/jornal.
//   1.3.3 Cerco de obra perimetral de chapa: el hormigón pasa de "Hormigón de
//         fundación postes (H-15 elaborado en obra)" (SEG-ALT-008, $4.800,
//         estimado por IA) a "Hormigón pobre para bases"
//         (MAT-HORMIGON-POBRE-BASES, CYPE); rendimiento 0,03 m³/ml sin cambio.
//
// El APU estándar no guarda precios de materiales: se resuelven contra
// PrecioMTOP por "descripción contiene" (ver GET
// /api/subrubros-estandar/[id]/descompuesto). Por eso cambiar el hormigón es
// cambiar la descripción del material. Después de cada cambio se recalcula
// SubrubroEstandar.precioUY con la misma fórmula que esa ruta (apu-calc.ts),
// redondeado a 2 decimales como el resto de la Biblioteca.
//
// Idempotente: cada cambio se aplica solo si no está hecho. Aborta sin
// escribir si un subrubro no es el esperado (por descripción) o si una fila
// de origen no aparece. Ningún proyecto se toca (sus rubros son copias).
//
// Ejecutar (dry-run): npx tsx scripts/unificar-apu-cercos-2026-10.ts
// Ejecutar (real):     npx tsx scripts/unificar-apu-cercos-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { calcularPrecioUnitario, sumEquipos, sumManoObra } from "../src/lib/apu-calc";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const HORMIGON_VIEJO = "Hormigón de fundación postes (H-15 elaborado en obra)";
const HORMIGON_NUEVO = "Hormigón pobre para bases";
const CODIGO_PRECIO_HORMIGON_NUEVO = "MAT-HORMIGON-POBRE-BASES";

type Mat = { descripcion: string; unidad: string; rendimiento: number };
type MO = { categoria: string; rendimiento: number; equipoRelacionadoId: string | null };
type Eq = { id: string; descripcion: string; unidad: string; rendimiento: number };

const redondear2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Precio unitario de referencia, igual que la ruta descompuesto.
async function precioDe(materiales: Mat[], manoObra: MO[], equipos: Eq[], utilidadPct: number) {
  const categorias = await db.categoriaLaboral.findMany();
  const jornal = (nombre: string) =>
    categorias.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  // Coincidencia EXACTA primero y "contiene" solo si no hay exacta. La ruta
  // descompuesto usa solo "contiene" con findFirst sin orden, y con
  // descripciones genéricas ("Madera para encofrado", "Poste de madera")
  // eso puede devolver otra fila (ej. madera a $32.000/m³ en vez de
  // $450/m²) según el orden en que la base devuelva las filas.
  let sumMat = 0;
  for (const m of materiales) {
    const p =
      (await db.precioMTOP.findFirst({ where: { descripcion: { equals: m.descripcion, mode: "insensitive" } } })) ??
      (await db.precioMTOP.findFirst({ where: { descripcion: { contains: m.descripcion, mode: "insensitive" } } }));
    sumMat += m.rendimiento * (p?.precioUnitario ?? 0);
  }
  const eqs = [];
  for (const e of equipos) {
    const p = await db.precioEquipo.findFirst({ where: { descripcion: { contains: e.descripcion, mode: "insensitive" } } });
    eqs.push({ id: e.id, rendimiento: e.rendimiento, costoUnit: p?.precioHora ?? 0 });
  }
  const mos = manoObra.map((m) => ({ rendimiento: m.rendimiento, jornalRef: jornal(m.categoria), equipoRelacionadoId: m.equipoRelacionadoId }));
  const costoDirecto = sumMat + sumManoObra(mos, eqs) + sumEquipos(eqs);
  return redondear2(calcularPrecioUnitario(costoDirecto, utilidadPct));
}

async function cargar(codigo: string, empieza: string) {
  const s = await db.subrubroEstandar.findUnique({
    where: { codigo },
    include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
  });
  if (!s?.apuEstandar) throw new Error(`No existe ${codigo} con APU — no se escribe nada`);
  if (!s.descripcion.toLowerCase().startsWith(empieza.toLowerCase())) {
    throw new Error(`${codigo} no es «${empieza}…» sino «${s.descripcion}» — no se escribe nada`);
  }
  return s;
}

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  // El hormigón nuevo tiene que resolver a la fila esperada de PrecioMTOP.
  const filasHormigon = await db.precioMTOP.findMany({
    where: { descripcion: { contains: HORMIGON_NUEVO, mode: "insensitive" } },
    select: { codigo: true, precioUnitario: true },
  });
  if (filasHormigon.length !== 1 || filasHormigon[0].codigo !== CODIGO_PRECIO_HORMIGON_NUEVO) {
    throw new Error(`«${HORMIGON_NUEVO}» resuelve a ${filasHormigon.map((f) => f.codigo).join(", ") || "nada"} (se esperaba solo ${CODIGO_PRECIO_HORMIGON_NUEVO}) — no se escribe nada`);
  }
  console.log(`Hormigón nuevo: «${HORMIGON_NUEVO}» → ${CODIGO_PRECIO_HORMIGON_NUEVO} $${money(filasHormigon[0].precioUnitario)}/m³\n`);

  const s131 = await cargar("1.3.1", "CERCO TEJIDO GALVANIZADO");
  const s132 = await cargar("1.3.2", "BARRERA H=2.20 CON TABLAS ENCOFRADO");
  const s133 = await cargar("1.3.3", "Cerco de obra perimetral de chapa");

  type OpMO = { id: string; desde: string; hasta: string; rendDesde: number; rendHasta: number };
  type OpMat = { id: string; desde: string; hasta: string };
  type Plan = {
    s: typeof s131;
    mo: OpMO[];
    mat: OpMat[];
    eqBorrar: Eq[];
    antes: number;
    despues: number;
  };
  const planes: Plan[] = [];

  // Arma el plan de un subrubro a partir del estado actual.
  async function planificar(
    s: typeof s131,
    cambiosMO: Record<string, { a: string; rend?: number }>,
    cambiosMat: Record<string, string>,
    borrarEquipos: string[]
  ) {
    const apu = s.apuEstandar!;
    const mo: OpMO[] = [];
    for (const m of apu.manoObra) {
      const regla = cambiosMO[m.categoria] ?? Object.values(cambiosMO).find((r) => r.a === m.categoria);
      if (!regla) continue;
      const rendHasta = regla.rend ?? m.rendimiento;
      if (m.categoria !== regla.a || m.rendimiento !== rendHasta) {
        mo.push({ id: m.id, desde: m.categoria, hasta: regla.a, rendDesde: m.rendimiento, rendHasta });
      }
    }
    // Cada categoría destino tiene que existir al final (si no, faltaba una fila de origen).
    for (const regla of Object.values(cambiosMO)) {
      const presente = apu.manoObra.some((m) => m.categoria === regla.a || cambiosMO[m.categoria]?.a === regla.a);
      if (!presente) throw new Error(`${s.codigo}: no hay fila de mano de obra para «${regla.a}» — no se escribe nada`);
    }
    const mat: OpMat[] = [];
    for (const [desde, hasta] of Object.entries(cambiosMat)) {
      const filaDesde = apu.materiales.find((m) => m.descripcion === desde);
      const filaHasta = apu.materiales.find((m) => m.descripcion === hasta);
      if (filaDesde) mat.push({ id: filaDesde.id, desde, hasta });
      else if (!filaHasta) throw new Error(`${s.codigo}: no está el material «${desde}» ni «${hasta}» — no se escribe nada`);
    }
    const eqBorrar = apu.equipos.filter((e) => borrarEquipos.includes(e.descripcion));
    for (const e of eqBorrar) {
      if (apu.manoObra.some((m) => m.equipoRelacionadoId === e.id)) {
        throw new Error(`${s.codigo}: «${e.descripcion}» tiene mano de obra vinculada — no se escribe nada`);
      }
    }

    const antes = await precioDe(apu.materiales, apu.manoObra, apu.equipos, apu.utilidadPct);
    const matNuevos = apu.materiales.map((m) => ({ ...m, descripcion: mat.find((x) => x.id === m.id)?.hasta ?? m.descripcion }));
    const moNuevos = apu.manoObra.map((m) => {
      const op = mo.find((x) => x.id === m.id);
      return op ? { ...m, categoria: op.hasta, rendimiento: op.rendHasta } : m;
    });
    const eqNuevos = apu.equipos.filter((e) => !eqBorrar.some((b) => b.id === e.id));
    const despues = await precioDe(matNuevos, moNuevos, eqNuevos, apu.utilidadPct);
    planes.push({ s, mo, mat, eqBorrar, antes, despues });
  }

  await planificar(s131, { "Oficial especializado": { a: "Oficial albañil" }, "Peón": { a: "Ayudante" } }, {}, ["Andamio tubular"]);
  await planificar(s132, { "Oficial albañil": { a: "Oficial albañil", rend: 15 }, "Peón": { a: "Ayudante", rend: 15 } }, {}, []);
  await planificar(s133, {}, { [HORMIGON_VIEJO]: HORMIGON_NUEVO }, []);

  let hayCambios = false;
  for (const p of planes) {
    const precioGuardadoCambia = Math.abs(p.s.precioUY - p.despues) > 0.004;
    const algo = p.mo.length + p.mat.length + p.eqBorrar.length > 0 || precioGuardadoCambia;
    hayCambios ||= algo;
    console.log(`── ${p.s.codigo} ${p.s.descripcion} ──`);
    for (const o of p.mo) {
      const rend = o.rendDesde !== o.rendHasta ? ` · rendimiento ${o.rendDesde} → ${o.rendHasta} ml/jornal` : ` · rendimiento ${o.rendDesde} ml/jornal (sin cambio)`;
      console.log(`  MO   ${o.desde === o.hasta ? o.desde : `${o.desde} → ${o.hasta}`}${rend}`);
    }
    for (const o of p.mat) console.log(`  MAT  «${o.desde}» → «${o.hasta}»`);
    for (const e of p.eqBorrar) console.log(`  EQ   se saca «${e.descripcion}» (${e.rendimiento} ${e.unidad})`);
    if (!algo) console.log("  = Sin cambios.");
    console.log(`  Precio unitario: guardado $${money(p.s.precioUY)} · calculado hoy $${money(p.antes)} → nuevo $${money(p.despues)}\n`);
  }

  if (!hayCambios) {
    console.log("= Ya está todo aplicado. Sin cambios.");
    await db.$disconnect();
    return;
  }

  if (aplicar) {
    await db.$transaction(async (tx) => {
      for (const p of planes) {
        for (const o of p.mo) {
          await tx.manoObraAPUEstandar.update({ where: { id: o.id }, data: { categoria: o.hasta, rendimiento: o.rendHasta } });
        }
        for (const o of p.mat) {
          await tx.materialAPUEstandar.update({ where: { id: o.id }, data: { descripcion: o.hasta } });
        }
        for (const e of p.eqBorrar) {
          await tx.equipoAPUEstandar.delete({ where: { id: e.id } });
        }
        await tx.subrubroEstandar.update({ where: { id: p.s.id }, data: { precioUY: p.despues } });
      }
    }, { timeout: 60000 });
  }

  console.log(aplicar ? "APLICADO." : "DRY RUN: no se escribió nada. Para aplicar: --apply (con el OK de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
