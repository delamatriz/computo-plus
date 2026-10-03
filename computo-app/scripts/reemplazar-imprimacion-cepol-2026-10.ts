// Biblioteca — "Imprimación con Cepol" (9.2.2) → dos rubros nuevos:
// "Imprimación asfáltica al agua" (9.2.9) e "Imprimación asfáltica solvente"
// (9.2.10), con precios de mercado.
//
// Por qué: Luis (arquitecto) indica que el producto Cepol ya no existe en
// plaza. El rubro viene del rubrado SAU (ago-2022, código original 6.6.10 en
// seed-subrubros-sau-data.ts), no de una estimación de IA; su APU (material
// genérico "Imprimación asfáltica" 0,4 l/m² + 1/40 de jornal de Oficial
// albañil) se completó después con seed-apus-albanileria-completo.ts.
//
// Qué hace:
//  1. PrecioMTOP: crea (si no existen) dos materiales con precio de mercado,
//     "pendiente de verificar" (notaProcedencia con la fuente y sin
//     fechaUltimaVerificacion; proveedor = null a propósito: con proveedor
//     poblado el job verificar-precios-mercado los re-verificaría solo y se
//     perdería el "pendiente" de rendimiento). Nunca pisa un precio existente.
//       · MAT-IMP-ASFALTICA-AGUA (kg): Asfalkote emulsión asfáltica estable
//         de 18 kg, Sodimac Uruguay (cód. 2160498), $1.399 → /18 por kg.
//       · MAT-IMP-ASFALTICA-SOLVENTE (l): Asfalkote RC 2, lata de 20 l,
//         Mercadolibre Uruguay, $4.947 → /20 por litro.
//     IVA: la Biblioteca guarda los precios TAL COMO LOS PUBLICA la tienda
//     (con IVA, sin dividir por 1,22; precioConIva == precioUnitario en todo
//     el catálogo). Ver DIVIDIR_IVA_POR más abajo.
//  2. SubrubroEstandar + APUEstandar: dos rubros nuevos en el mismo
//     subcapítulo que Cepol (Preparación y Aislación Complementaria), con el
//     código siguiente libre del patrón (9.2.N), unidad M2, GG y utilidad
//     leídos del APU de Cepol (0 y 10, criterio del capítulo) y la mano de
//     obra de Cepol. Sin marcas en la descripción del rubro (se imprime al
//     cliente).
//  3. Cepol (9.2.2): SOLO con --retirar-cepol se desactiva (activo=false, no se
//     borra: el rubro ya no aparece en la Biblioteca pero nada se rompe). Sin
//     el flag, solo se informa. El material genérico "Imprimación asfáltica"
//     NUNCA se toca: lo usan otros APU de la Biblioteca.
//  4. Proyectos: no se modifica ninguno. Solo se listan los rubros que
//     coinciden (un rubro clonado no tiene vínculo con el subrubro, así que
//     los clones existentes quedan como están).
//
// Idempotente: PrecioMTOP por findFirst {codigo, proveedor: null}; rubro por
// findFirst {capituloId, descripcion}; el APU no se reescribe si ya tiene
// exactamente estos insumos. Una segunda corrida da 0 cambios.
//
// Nota sobre el matching de precios: al clonar un APU, el precio de cada
// material se busca con descripcion CONTAINS (insensible a mayúsculas) y
// orderBy id asc (ver clonarApuAlRubro). "Imprimación asfáltica" ahora está
// contenida también en las dos descripciones nuevas; como el id del material
// existente es anterior (cuid ordenado por tiempo), sigue ganando el existente
// — el script lo verifica y avisa si no fuera así.
//
// Ejecutar (dry-run):        npx tsx scripts/reemplazar-imprimacion-cepol-2026-10.ts
// Ejecutar (real):           npx tsx scripts/reemplazar-imprimacion-cepol-2026-10.ts --apply
// Además retirar Cepol:      ... --apply --retirar-cepol

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-10";
const CAPITULO = "Impermeabilizaciones y Aislaciones";
const SUBCAPITULO = "Preparación y Aislación Complementaria";
const CODIGO_CEPOL = "9.2.2";
const CODIGO_MATERIAL_GENERICO = "MAT-IMP-ASFALTICA";
const DESCRIPCION_MATERIAL_GENERICO = "Imprimación asfáltica";

// Criterio de IVA de la Biblioteca (verificado en la base y en el código):
// los precios de PrecioMTOP se guardan como los publica la tienda, CON IVA,
// sin ningún ajuste (precioConIva == precioUnitario; p. ej. "Spartan Pro Shine
// 5L, $1.509,54 c/IVA → $301,91/L" se guardó como 301,91, y "Tersuave Barniz
// 4L, $2.590" como 647,5/l). La app suma el 22% al final de la cascada, sobre
// el Costo Total. Por eso acá NO se divide por 1,22: se aplica el mismo
// criterio que el resto del catálogo. Si algún día la Biblioteca pasa a
// precios sin IVA, cambiar este factor a 1.22 (y migrar todo el catálogo).
const DIVIDIR_IVA_POR = 1;

// Marca identificable del criterio de IVA: permite encontrar estos materiales si
// después se corrige el criterio de IVA de toda la Biblioteca.
const NOTA_IVA = "Precio de tienda publicado, IVA incluido (mismo criterio que el resto del catálogo).";

const FUENTE_AGUA =
  "Referencia: Asfalkote (Pennsylvania), emulsión asfáltica estable de 18 kg, Sodimac Uruguay, oct-2026. " +
  "Rendimiento del fabricante para membranas: 0,5 kg/m2; confirmar con el fabricante que corresponde al uso como imprimación. " +
  "Un vendedor de Mercadolibre ofrece un 'Imprimador Membrana Asfáltica Asfalkote' a $1.569, con capacidad sin confirmar. " +
  "Otras marcas de referencia: Macape (Emapi).";

const FUENTE_SOLVENTE =
  "Referencia: Asfalkote RC 2 (Pennsylvania), lata de 20 litros, Mercadolibre Uruguay (captura de Google Shopping), oct-2026; " +
  "en plaza se conoce como RC2 y se usa como imprimación solvente. " +
  "Rendimiento de 0,4 l/m2 provisorio, sin dato del fabricante: confirmar con la ficha técnica. " +
  "Otras marcas de referencia: Imprimación Asfáltica Sika, Macape (Emapi).";

type NuevoDef = {
  descripcion: string; // del rubro (se imprime al cliente: sin marcas)
  material: {
    codigo: string;
    descripcion: string;
    unidad: string;
    precioPublicado: number;
    envase: number; // unidades de `unidad` por envase publicado
    rendimiento: number; // por m2
    nombreProducto: string;
    notaProcedencia: string;
  };
};

const NUEVOS: NuevoDef[] = [
  {
    descripcion: "Imprimación asfáltica al agua",
    material: {
      codigo: "MAT-IMP-ASFALTICA-AGUA",
      descripcion: "Imprimación asfáltica base agua",
      unidad: "kg",
      precioPublicado: 1399,
      envase: 18,
      rendimiento: 0.5,
      nombreProducto: "Asfalkote, emulsión asfáltica estable, 18 kg, $1.399 (Sodimac Uruguay, cód. 2160498)",
      notaProcedencia: `Pendiente de verificar. ${NOTA_IVA} ${FUENTE_AGUA}`,
    },
  },
  {
    descripcion: "Imprimación asfáltica solvente",
    material: {
      codigo: "MAT-IMP-ASFALTICA-SOLVENTE",
      descripcion: "Imprimación asfáltica base solvente",
      unidad: "l",
      precioPublicado: 4947,
      envase: 20,
      rendimiento: 0.4,
      nombreProducto: "Asfalkote RC 2, lata de 20 l, $4.947 (Mercadolibre Uruguay)",
      notaProcedencia: `Pendiente de verificar. ${NOTA_IVA} ${FUENTE_SOLVENTE}`,
    },
  },
];

const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const redondear2 = (n: number) => Math.round(n * 100) / 100;
const precioUnitarioDe = (m: NuevoDef["material"]) => redondear2(m.precioPublicado / m.envase / DIVIDIR_IVA_POR);

async function main() {
  const aplicar = process.argv.includes("--apply");
  const retirarCepol = process.argv.includes("--retirar-cepol");
  if (retirarCepol && !aplicar) console.log("(--retirar-cepol solo tiene efecto con --apply)\n");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}${retirarCepol ? " + retirar Cepol" : ""}\n`);

  // ── Capítulo / subcapítulo / Cepol ──
  const capitulo = await db.capituloCatalogo.findUnique({ where: { nombre: CAPITULO } });
  if (!capitulo) throw new Error(`Capítulo "${CAPITULO}" no existe`);
  const subcapitulo = await db.subcapituloCatalogo.findFirst({ where: { nombre: SUBCAPITULO, capituloCatalogoId: capitulo.id } });
  if (!subcapitulo) throw new Error(`Subcapítulo "${SUBCAPITULO}" no existe`);
  const cepol = await db.subrubroEstandar.findUnique({
    where: { codigo: CODIGO_CEPOL },
    include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
  });
  if (!cepol?.apuEstandar) throw new Error(`No se encontró ${CODIGO_CEPOL} con APU`);
  if (!/cepol/i.test(cepol.descripcion)) throw new Error(`${CODIGO_CEPOL} ya no es Cepol ("${cepol.descripcion}") — abortando`);
  const apuCepol = cepol.apuEstandar;
  if (apuCepol.materiales.length !== 1 || apuCepol.equipos.length !== 0) {
    throw new Error("El APU de Cepol ya no tiene la forma esperada (1 material, sin equipos) — revisar a mano");
  }
  const matCepol = apuCepol.materiales[0];
  const generico = await db.precioMTOP.findFirst({ where: { codigo: CODIGO_MATERIAL_GENERICO, proveedor: null } });
  if (!generico) throw new Error(`${CODIGO_MATERIAL_GENERICO} no existe en PrecioMTOP`);

  const categorias = await db.categoriaLaboral.findMany();
  const jornalDe = (nombre: string) => {
    const c = categorias.find((x) => x.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    if (!c) throw new Error(`Categoría laboral "${nombre}" no existe`);
    return c.jornal;
  };
  const sumMO = apuCepol.manoObra.reduce((s, mo) => s + jornalDe(mo.categoria) / mo.rendimiento, 0);
  const factor = (1 + apuCepol.gastosGeneralesPct / 100) * (1 + apuCepol.utilidadPct / 100);

  console.log("── Punto de partida: Cepol ──");
  console.log(`  ${cepol.codigo} — ${cepol.descripcion} (${cepol.unidad}) — precioUY $${money(cepol.precioUY)} — activo: ${cepol.activo}`);
  console.log(`  Capítulo: ${CAPITULO} › ${SUBCAPITULO}`);
  console.log(`  APU: GG ${apuCepol.gastosGeneralesPct}% · Utilidad ${apuCepol.utilidadPct}%`);
  console.log(`  Material: ${matCepol.descripcion} — ${matCepol.rendimiento} ${matCepol.unidad}/${cepol.unidad}  (precio vigente ${generico.codigo}: $${money(generico.precioUnitario)}/${generico.unidad}, lista ${generico.fechaLista}, sin procedencia)`);
  for (const mo of apuCepol.manoObra) console.log(`  Mano de obra: ${mo.categoria} — ${mo.rendimiento} ${cepol.unidad}/jornada (${mo.jornadaHs} hs) — jornal $${money(jornalDe(mo.categoria))}`);

  console.log("\n── Criterio de IVA ──");
  console.log("  La Biblioteca guarda los precios de tienda CON IVA, tal como se publican (precioConIva == precioUnitario, sin dividir por 1,22);");
  console.log("  la app suma el 22% al final de la cascada. Se aplica el mismo criterio: factor de división = " + DIVIDIR_IVA_POR + ".");

  // ── 1. PrecioMTOP nuevos ──
  console.log("\n── 1. PrecioMTOP (materiales nuevos, pendientes de verificar) ──");
  for (const n of NUEVOS) {
    const m = n.material;
    const pu = precioUnitarioDe(m);
    const ex = await db.precioMTOP.findFirst({ where: { codigo: m.codigo, proveedor: null } });
    console.log(`  ${ex ? "= ya existe (no se toca)" : "+ crea"} ${m.codigo} — «${m.descripcion}» — $${money(m.precioPublicado)} / ${m.envase} ${m.unidad} = $${money(pu)}/${m.unidad} — fechaLista ${FECHA}`);
    console.log(`      nombreProducto: ${m.nombreProducto}`);
    console.log(`      notaProcedencia: ${m.notaProcedencia}`);
    if (aplicar && !ex) {
      await db.precioMTOP.create({
        data: {
          codigo: m.codigo,
          descripcion: m.descripcion,
          cantidadUnidad: `1 ${m.unidad}`,
          unidad: m.unidad,
          cantidad: 1,
          precioConIva: pu,
          precioUnitario: pu,
          numeroLista: 0,
          fechaLista: FECHA,
          nombreProducto: m.nombreProducto,
          notaProcedencia: m.notaProcedencia,
        },
      });
    }
  }

  // ── 2. Rubros nuevos ──
  console.log("\n── 2. SubrubroEstandar + APUEstandar (rubros nuevos) ──");
  const hermanos = await db.subrubroEstandar.findMany({ where: { subcapituloId: subcapitulo.id } });
  const prefijo = CODIGO_CEPOL.split(".").slice(0, 2).join("."); // "9.2"
  const sufijos = hermanos.map((h) => (h.codigo.startsWith(prefijo + ".") ? Number(h.codigo.slice(prefijo.length + 1)) : NaN)).filter(Number.isFinite);
  let proximoSufijo = (sufijos.length ? Math.max(...sufijos) : 0) + 1;
  let proximoOrden = hermanos.reduce((mx, h) => Math.max(mx, h.orden ?? -1), -1) + 1;

  const filas: { codigo: string; descripcion: string; precio: number }[] = [];
  for (const n of NUEVOS) {
    const m = n.material;
    const pu = precioUnitarioDe(m);
    const sumMat = m.rendimiento * pu;
    const precioUY = redondear2((sumMat + sumMO) * factor);
    const yaExiste = await db.subrubroEstandar.findFirst({ where: { capituloId: capitulo.id, descripcion: n.descripcion } });
    const codigo = yaExiste?.codigo ?? `${prefijo}.${proximoSufijo++}`;
    const orden = yaExiste?.orden ?? proximoOrden++;
    filas.push({ codigo, descripcion: n.descripcion, precio: precioUY });
    console.log(`  ${yaExiste ? "= ya existe" : "+ crea"} ${codigo} — ${n.descripcion} (M2) — orden ${orden} — $${money(precioUY)}/M2  [material $${money(sumMat)} + MO $${money(sumMO)}, × ${factor.toFixed(2)}]`);
    console.log(`      material: ${m.descripcion} — ${m.rendimiento} ${m.unidad}/M2 — $${money(pu)}/${m.unidad}  [pendiente de verificar]`);
    for (const mo of apuCepol.manoObra) console.log(`      MO: ${mo.categoria} — ${mo.rendimiento} M2/jornada — jornal $${money(jornalDe(mo.categoria))}`);
    console.log(`      GG ${apuCepol.gastosGeneralesPct}% · Utilidad ${apuCepol.utilidadPct}%`);

    if (!aplicar) continue;
    const sub = await db.subrubroEstandar.upsert({
      where: { codigo },
      create: {
        codigo,
        descripcion: n.descripcion,
        unidad: "M2",
        precioUY,
        fechaBase: FECHA,
        origen: "manual",
        orden,
        capituloId: capitulo.id,
        subcapituloId: subcapitulo.id,
      },
      // Si ya existe no se pisa el precio ni el orden (puede estar corregido a mano).
      update: {},
    });
    const apuEx = await db.aPUEstandar.findUnique({ where: { subrubroId: sub.id }, include: { materiales: true, manoObra: true } });
    const clave = (xs: (string | number)[][]) => JSON.stringify(xs.map((x) => x.join("|")).sort());
    if (
      apuEx &&
      clave(apuEx.materiales.map((x) => [x.descripcion, x.unidad, x.rendimiento])) === clave([[m.descripcion, m.unidad, m.rendimiento]]) &&
      clave(apuEx.manoObra.map((x) => [x.categoria, x.jornadaHs, x.rendimiento])) === clave(apuCepol.manoObra.map((x) => [x.categoria, x.jornadaHs, x.rendimiento]))
    ) {
      continue;
    }
    const apu =
      apuEx ??
      (await db.aPUEstandar.create({
        data: { subrubroId: sub.id, gastosGeneralesPct: apuCepol.gastosGeneralesPct, utilidadPct: apuCepol.utilidadPct, porcentajePiedra: apuCepol.porcentajePiedra },
      }));
    await db.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento } });
    for (const mo of apuCepol.manoObra) {
      await db.manoObraAPUEstandar.create({ data: { apuId: apu.id, categoria: mo.categoria, jornadaHs: mo.jornadaHs, rendimiento: mo.rendimiento } });
    }
  }

  // ── 3. Cepol ──
  console.log("\n── 3. Cepol (9.2.2) y su material ──");
  const otrosApuConGenerico = await db.materialAPUEstandar.findMany({
    where: { descripcion: { equals: DESCRIPCION_MATERIAL_GENERICO, mode: "insensitive" }, apu: { subrubroId: { not: cepol.id } } },
    select: { apu: { select: { subrubro: { select: { codigo: true } } } } },
  });
  const codigosOtros = [...new Set(otrosApuConGenerico.map((x) => x.apu.subrubro.codigo))].sort();
  console.log(`  Material «${DESCRIPCION_MATERIAL_GENERICO}»: lo usan ${codigosOtros.length} APU más de la Biblioteca (${codigosOtros.join(", ")}) → NO se toca.`);
  const rubrosCepolProyectos = await db.rubro.findMany({
    where: { descripcion: { contains: "cepol", mode: "insensitive" } },
    select: { codigo: true, descripcion: true, precioUnit: true, precioCongelado: true, capitulo: { select: { proyecto: { select: { nombre: true } } } } },
  });
  if (rubrosCepolProyectos.length === 0) {
    console.log("  Ningún proyecto tiene un rubro «Cepol».");
  } else {
    for (const r of rubrosCepolProyectos) {
      console.log(`  ⚠ Proyecto «${r.capitulo.proyecto.nombre.trim()}» tiene el rubro ${r.codigo} «${r.descripcion}» ($${money(r.precioUnit)}${r.precioCongelado != null ? ", precio congelado" : ""}) — NO se modifica (el clon no está vinculado al subrubro).`);
    }
  }
  if (retirarCepol) {
    console.log(`  ${cepol.activo ? "→ se DESACTIVA" : "= ya desactivado"} ${cepol.codigo} — ${cepol.descripcion} (activo=false; no se borra).`);
    if (aplicar && cepol.activo) await db.subrubroEstandar.update({ where: { id: cepol.id }, data: { activo: false } });
  } else {
    console.log("  Cepol queda ACTIVO: para desactivarlo (activo=false, no se borra) correr con --apply --retirar-cepol.");
  }

  // ── Verificación del matching ──
  console.log("\n── Verificación del matching de precios al clonar ──");
  const candidatos = await db.precioMTOP.findMany({ where: { descripcion: { contains: DESCRIPCION_MATERIAL_GENERICO, mode: "insensitive" } }, orderBy: { id: "asc" }, select: { id: true, codigo: true } });
  console.log(`  «${DESCRIPCION_MATERIAL_GENERICO}» (contains, id asc) matchea: ${candidatos.map((c) => c.codigo).join(" > ")}`);
  console.log(`  → gana: ${candidatos[0]?.codigo}${candidatos[0]?.codigo === CODIGO_MATERIAL_GENERICO ? ` (el genérico existente: sin cambios para los ${codigosOtros.length + 1} APU que lo usan, Cepol incluido)` : "  ⚠ DISTINTO DEL GENÉRICO — REVISAR"}`);
  if (candidatos[0]?.codigo !== CODIGO_MATERIAL_GENERICO) throw new Error("El matching del material genérico cambió — revisar antes de seguir");
  for (const n of NUEVOS) {
    const c = await db.precioMTOP.findFirst({ where: { descripcion: { contains: n.material.descripcion, mode: "insensitive" } }, orderBy: { id: "asc" } });
    console.log(`  «${n.material.descripcion}» → ${c ? `${c.codigo} ($${money(c.precioUnitario)}/${c.unidad})` : "(sin match todavía: se crea con --apply)"}`);
  }

  console.log("\n── Resumen ──");
  console.log(`  Precio de Cepol hoy: $${money(cepol.precioUY)}/M2`);
  for (const f of filas) {
    const d = f.precio - cepol.precioUY;
    console.log(`  ${f.codigo} «${f.descripcion}»: $${money(f.precio)}/M2  (${d >= 0 ? "+" : "−"}$${money(Math.abs(d))} vs Cepol, ${((d / cepol.precioUY) * 100).toFixed(1)}%)`);
  }
  console.log(aplicar ? "\nAPLICADO." : "\nDRY RUN: no se escribió nada. Para aplicar: --apply --retirar-cepol (con la aprobación de Luis).");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
