// Biblioteca global — 12 rubros nuevos de las tablas de rendimientos del
// Instituto de Construcción, Facultad de Arquitectura (FADU/UdelaR).
// Códigos FAC-* (no chocan con la numeración existente), origen
// "farq_instituto_construccion".
//
// Mano de obra: la fuente da horas por unidad; rendimiento (u/jornal) =
// 1 / (horas / 8), redondeado a 4 decimales. El jornal se resuelve en vivo
// contra CategoriaLaboral por nombre al clonar (jornalReferencia null).
//
// Materiales: MaterialAPUEstandar no guarda precio — al clonar se busca en
// PrecioMTOP por "contiene" la descripción (resolverPrecioMaterial). Por eso:
//   - Donde el catálogo tiene el insumo con una unidad compatible se usa su
//     nombre real (y se convierte la cantidad): cemento portland GRIS (con
//     "Cemento portland" a secas resolvía al blanco), "Mezcla gruesa" en m³
//     (litros / 1000), "Ticholo 12x25x25", mármol granulado, cemento blanco
//     para la pastina, chapa fibrocemento perfil 7 en unidades (m² / 1,342,
//     área nominal de la chapa 1,22 × 1,10 m).
//   - Donde no hay insumo en el catálogo, o la conversión necesita una
//     densidad que la fuente no da (mezcla fina en kg, cascote en litros,
//     morteros en litros), queda la descripción de la fuente y el material
//     se clona sin precio hasta que se cargue en el catálogo.
//
// precioUY: misma convención que los seeds anteriores (ver
// seed-limpieza-retiro-obra-2026-10.ts) — costo directo (materiales con el
// precio vigente que resolvería el clonado + MO con el jornal vigente de
// CategoriaLaboral) × (1 + Utilidad 10%), sin Gastos Generales ni aportes
// patronales. Los materiales sin precio en el catálogo suman 0, así que el
// precio de esos rubros queda por debajo del real hasta que se carguen.
//
// Idempotente: un rubro cuyo `codigo` ya existe se saltea (no se actualiza).
// Subcapítulos: findFirst por (capítulo, nombre) y create solo si falta.
// `orden`: siguiente al último del capítulo/subcapítulo destino, para que
// queden al final de la lista en vez de mezclarse con los primeros.
//
// Ejecutar (dry-run): npx tsx scripts/seed-rubros-farq.ts
// Ejecutar (real):     npx tsx scripts/seed-rubros-farq.ts --apply

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const APLICAR = process.argv.includes("--apply");
const ORIGEN = "farq_instituto_construccion";
const FECHA_BASE = "2026-10";

// rendimiento (u/jornal de 8 h) desde horas por unidad
const rend = (horas: number) => Math.round((8 / horas) * 10000) / 10000;

// Nombres reales del catálogo (PrecioMTOP) — ver cabecera.
const CEMENTO_GRIS = "Cemento Portland gris (Montevideo, en bolsa, en obra)";
const MEZCLA_GRUESA = "Mezcla gruesa";
const LADRILLO_CAMPO = "Ladrillo de campo, 1ra. calidad (en obra)";
const AREA_CHAPA_PERFIL_7 = 1.22 * 1.1;
const lts = (l: number) => Math.round((l / 1000) * 10000) / 10000; // litros → m³

type Mat = { descripcion: string; unidad: string; rendimiento: number };
type MO = { categoria: string; horas: number };
type SubcapDestino =
  | "Elevación de Muros — Ladrillo de Campo"
  | "Contrapisos"
  | "Pisos, Zócalos y Otros"
  | "Capas Aisladoras e Hidrófugos";

const RUBROS: {
  codigo: string;
  descripcion: string;
  unidad: string;
  capitulo: "albanileria" | "cubierta";
  subcapitulo: SubcapDestino | null;
  manoObra: MO[];
  materiales: Mat[];
}[] = [
  // ── Muros — Ladrillo de Campo ──
  {
    codigo: "FAC-7.2.A",
    descripcion: "Muro de ladrillo visto e=15cm (interior, ladrillo de campo)",
    unidad: "M2",
    capitulo: "albanileria",
    subcapitulo: "Elevación de Muros — Ladrillo de Campo",
    manoObra: [{ categoria: "Oficial albañil", horas: 2.4 }, { categoria: "Peón", horas: 1.0 }],
    materiales: [
      { descripcion: LADRILLO_CAMPO, unidad: "u", rendimiento: 60 },
      { descripcion: MEZCLA_GRUESA, unidad: "m3", rendimiento: lts(50) },
      { descripcion: CEMENTO_GRIS, unidad: "kg", rendimiento: 8.75 },
    ],
  },
  {
    codigo: "FAC-7.2.B",
    descripcion: "Tabique de ladrillo rejilla e=10cm",
    unidad: "M2",
    capitulo: "albanileria",
    subcapitulo: "Elevación de Muros — Ladrillo de Campo",
    manoObra: [{ categoria: "Oficial albañil", horas: 0.7 }, { categoria: "Peón", horas: 0.45 }],
    materiales: [
      // Medida no indicada en la fuente: resuelve al rejilla 11x17x25 del catálogo.
      { descripcion: "Ladrillo rejilla", unidad: "u", rendimiento: 32 },
      { descripcion: MEZCLA_GRUESA, unidad: "m3", rendimiento: lts(25) },
      { descripcion: CEMENTO_GRIS, unidad: "kg", rendimiento: 4.38 },
    ],
  },
  {
    codigo: "FAC-7.2.C",
    descripcion: "Muro de ladrillo de plano y aplacado e=20cm",
    unidad: "M2",
    capitulo: "albanileria",
    subcapitulo: "Elevación de Muros — Ladrillo de Campo",
    manoObra: [{ categoria: "Oficial albañil", horas: 1.4 }, { categoria: "Peón", horas: 0.7 }],
    materiales: [
      { descripcion: LADRILLO_CAMPO, unidad: "u", rendimiento: 95 },
      { descripcion: MEZCLA_GRUESA, unidad: "m3", rendimiento: lts(60) },
      { descripcion: CEMENTO_GRIS, unidad: "kg", rendimiento: 8.4 },
    ],
  },
  {
    codigo: "FAC-7.2.D",
    descripcion: "Muro doble: ladrillo visto exterior + ticholo interior e=30cm",
    unidad: "M2",
    capitulo: "albanileria",
    subcapitulo: "Elevación de Muros — Ladrillo de Campo",
    manoObra: [{ categoria: "Oficial albañil", horas: 3.4 }, { categoria: "Peón", horas: 1.5 }],
    materiales: [
      { descripcion: LADRILLO_CAMPO, unidad: "u", rendimiento: 60 },
      // Fuente: "Ticholo 25x25x12 (10 agujeros)" — mismo nombre que usan los rubros existentes.
      { descripcion: "Ticholo 12x25x25", unidad: "u", rendimiento: 16 },
      { descripcion: MEZCLA_GRUESA, unidad: "m3", rendimiento: lts(55) },
      { descripcion: CEMENTO_GRIS, unidad: "kg", rendimiento: 9.63 },
    ],
  },
  // ── Capas aisladoras ──
  {
    codigo: "FAC-7.15.A",
    descripcion: "Capa hidrófuga en muro de 15cm (mortero hidrófugo)",
    unidad: "ML",
    capitulo: "albanileria",
    subcapitulo: "Capas Aisladoras e Hidrófugos",
    manoObra: [{ categoria: "Oficial albañil", horas: 0.85 }, { categoria: "Peón", horas: 0.42 }],
    materiales: [{ descripcion: "Mortero hidrófugo (arena + cemento hidrófugo)", unidad: "lts", rendimiento: 9 }],
  },
  {
    codigo: "FAC-7.15.B",
    descripcion: "Capa hidrófuga en muro de 30cm (mortero hidrófugo)",
    unidad: "ML",
    capitulo: "albanileria",
    subcapitulo: "Capas Aisladoras e Hidrófugos",
    manoObra: [{ categoria: "Oficial albañil", horas: 0.8 }, { categoria: "Peón", horas: 0.4 }],
    materiales: [{ descripcion: "Mortero hidrófugo (arena + cemento hidrófugo)", unidad: "lts", rendimiento: 15 }],
  },
  // ── Contrapisos ──
  {
    codigo: "FAC-7.11.A",
    descripcion: "Contrapiso de hormigón de cascote e=10cm",
    unidad: "M2",
    capitulo: "albanileria",
    subcapitulo: "Contrapisos",
    manoObra: [{ categoria: "Oficial albañil", horas: 0.4 }, { categoria: "Peón", horas: 0.2 }],
    materiales: [
      // El catálogo tiene cascote molido en kg; la fuente da litros (sin densidad).
      { descripcion: "Cascote de demolición", unidad: "lts", rendimiento: 100 },
      { descripcion: MEZCLA_GRUESA, unidad: "m3", rendimiento: lts(30) },
      { descripcion: CEMENTO_GRIS, unidad: "kg", rendimiento: 2 },
    ],
  },
  // ── Pisos ──
  {
    codigo: "FAC-7.12.A",
    descripcion: "Piso monolítico en sitio",
    unidad: "M2",
    capitulo: "albanileria",
    subcapitulo: "Pisos, Zócalos y Otros",
    manoObra: [{ categoria: "Oficial especializado", horas: 1.5 }, { categoria: "Peón", horas: 0.75 }],
    materiales: [
      { descripcion: "Marmol granulado blanco Nro. 3 (en bolsa)", unidad: "kg", rendimiento: 12 },
      { descripcion: "Cemento Portland blanco (en bolsa)", unidad: "kg", rendimiento: 12 },
      { descripcion: "Mortero (arena + cemento)", unidad: "lts", rendimiento: 25 },
    ],
  },
  {
    codigo: "FAC-7.12.B",
    descripcion: "Piso monolítico lavado",
    unidad: "M2",
    capitulo: "albanileria",
    subcapitulo: "Pisos, Zócalos y Otros",
    manoObra: [{ categoria: "Oficial especializado", horas: 0.45 }, { categoria: "Peón", horas: 0.45 }],
    materiales: [
      { descripcion: "Marmol granulado blanco Nro. 3 (en bolsa)", unidad: "kg", rendimiento: 12 },
      { descripcion: "Cemento Portland blanco (en bolsa)", unidad: "kg", rendimiento: 12 },
      { descripcion: MEZCLA_GRUESA, unidad: "m3", rendimiento: lts(25) },
    ],
  },
  {
    codigo: "FAC-7.12.C",
    descripcion: "Piso de gres 9.5x9.5cm (pastillas)",
    unidad: "M2",
    capitulo: "albanileria",
    subcapitulo: "Pisos, Zócalos y Otros",
    manoObra: [{ categoria: "Oficial especializado", horas: 2.0 }, { categoria: "Peón", horas: 0.6 }],
    materiales: [
      { descripcion: "Pastilla de gres 9.5x9.5cm", unidad: "u", rendimiento: 110 },
      // El catálogo tiene "Mezcla fina" en m³; la fuente da kg (sin densidad).
      { descripcion: "Mezcla fina (arena fina + cal)", unidad: "kg", rendimiento: 5 },
      { descripcion: CEMENTO_GRIS, unidad: "kg", rendimiento: 0.4 },
    ],
  },
  // ── Cubierta (sin subcapítulo) ──
  {
    codigo: "FAC-8.A",
    descripcion: "Pavimento de tejuelas cerámicas en azotea",
    unidad: "M2",
    capitulo: "cubierta",
    subcapitulo: null,
    manoObra: [{ categoria: "Oficial albañil", horas: 1.0 }, { categoria: "Peón", horas: 0.5 }],
    materiales: [
      { descripcion: "Tejuela cerámica (comun en fabrica)", unidad: "u", rendimiento: 32 },
      { descripcion: MEZCLA_GRUESA, unidad: "m3", rendimiento: lts(30) },
    ],
  },
  {
    codigo: "FAC-8.B",
    descripcion: "Cubierta de fibrocemento (sobretecho) — provisión y colocación",
    unidad: "M2",
    capitulo: "cubierta",
    subcapitulo: null,
    manoObra: [{ categoria: "Oficial especializado", horas: 1.0 }, { categoria: "Peón", horas: 1.5 }],
    materiales: [
      // Fuente: 1,05 m² de chapa perfil 7 por m² → unidades de chapa 1,22 × 1,10 m.
      {
        descripcion: "Chapa fibrocemento perfil 7, espesor: 6 mm, medida: 1.22x1.10 m",
        unidad: "u",
        rendimiento: Math.round((1.05 / AREA_CHAPA_PERFIL_7) * 10000) / 10000,
      },
      { descripcion: "Ganchos para chapa perfil 7", unidad: "u", rendimiento: 3 },
      { descripcion: "Cumbrera de fibrocemento", unidad: "u", rendimiento: 0.25 },
    ],
  },
];

async function capituloPorNombre(contiene: string) {
  const cap = await db.capituloCatalogo.findFirst({ where: { nombre: { contains: contiene, mode: "insensitive" } } });
  if (!cap) throw new Error(`No se encontró el capítulo del catálogo que contenga "${contiene}".`);
  return cap;
}

async function siguienteOrden(capituloId: string, subcapituloId: string | null) {
  const max = await db.subrubroEstandar.aggregate({ where: { capituloId, subcapituloId }, _max: { orden: true } });
  return (max._max.orden ?? -1) + 1;
}

async function main() {
  console.log(APLICAR ? "== APLICANDO ==" : "== DRY-RUN (sin escribir; --apply para aplicar) ==");

  const capAlbanileria = await capituloPorNombre("Albañilería");
  const capCubierta = await capituloPorNombre("Cubierta");
  console.log(`Capítulos: ${capAlbanileria.nombre} · ${capCubierta.nombre}`);

  // Precios vigentes para precioUY — import dinámico: resolverPrecioInsumo
  // abre su propio cliente al cargarse y necesita DATABASE_URL ya cargado.
  const { resolverPreciosMaterialesEnLote } = await import("../src/lib/resolverPrecioInsumo");
  const preciosMat = await resolverPreciosMaterialesEnLote(RUBROS.flatMap((r) => r.materiales.map((m) => m.descripcion)));
  const categorias = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) => {
    const c = categorias.find((x) => x.nombre === nombre);
    if (!c) throw new Error(`No existe la categoría laboral "${nombre}".`);
    return c.jornal;
  };

  // Subcapítulos — findFirst + create condicional.
  const subcapIds = new Map<string, string | null>();
  const nombresSubcap = [...new Set(RUBROS.map((r) => r.subcapitulo).filter((s): s is SubcapDestino => s != null))];
  for (const nombre of nombresSubcap) {
    const existente = await db.subcapituloCatalogo.findFirst({ where: { capituloCatalogoId: capAlbanileria.id, nombre } });
    if (existente) {
      subcapIds.set(nombre, existente.id);
      console.log(`  Subcapítulo existente: ${nombre}`);
      continue;
    }
    const max = await db.subcapituloCatalogo.aggregate({ where: { capituloCatalogoId: capAlbanileria.id }, _max: { orden: true } });
    const orden = (max._max.orden ?? -1) + 1;
    if (APLICAR) {
      const creado = await db.subcapituloCatalogo.create({ data: { capituloCatalogoId: capAlbanileria.id, nombre, orden } });
      subcapIds.set(nombre, creado.id);
    } else {
      subcapIds.set(nombre, null);
    }
    console.log(`  Subcapítulo ${APLICAR ? "CREADO" : "a crear"}: ${nombre} (orden ${orden})`);
  }

  let creados = 0;
  let existian = 0;
  const ordenPorGrupo = new Map<string, number>();

  for (const r of RUBROS) {
    const ya = await db.subrubroEstandar.findUnique({ where: { codigo: r.codigo }, select: { id: true } });
    if (ya) {
      console.log(`SKIP ${r.codigo} — ya existe`);
      existian++;
      continue;
    }

    const capituloId = r.capitulo === "albanileria" ? capAlbanileria.id : capCubierta.id;
    const subcapituloId = r.subcapitulo ? subcapIds.get(r.subcapitulo) ?? null : null;
    const clave = `${capituloId}:${r.subcapitulo ?? ""}`;
    if (!ordenPorGrupo.has(clave)) {
      // Subcapítulo todavía no creado (dry-run): arranca en 0.
      const base = r.subcapitulo && subcapituloId == null ? 0 : await siguienteOrden(capituloId, subcapituloId);
      ordenPorGrupo.set(clave, base);
    }
    const orden = ordenPorGrupo.get(clave)!;
    ordenPorGrupo.set(clave, orden + 1);

    const manoObra = r.manoObra.map((m) => ({
      categoria: m.categoria,
      jornadaHs: 8,
      rendimiento: rend(m.horas),
      jornalReferencia: null,
      equipoRelacionadoId: null,
    }));
    const materiales = r.materiales.map((m) => ({ ...m, precioReferencia: null }));

    const sumMat = materiales.reduce((s, m) => s + m.rendimiento * (preciosMat.get(m.descripcion)?.precioUnitario ?? 0), 0);
    const sumMO = manoObra.reduce((s, m) => s + jornalPorNombre(m.categoria) / m.rendimiento, 0);
    const precioUY = Math.round((sumMat + sumMO) * (1 + 10 / 100) * 100) / 100;

    console.log(
      `${APLICAR ? "CREAR" : "crearía"} ${r.codigo} | ${r.descripcion} | ${r.unidad} | ${r.subcapitulo ?? "(sin subcapítulo)"} | orden ${orden} | $${precioUY} [mat $${sumMat.toFixed(2)} + MO $${sumMO.toFixed(2)}]`
    );
    for (const m of manoObra) console.log(`     MO  ${m.categoria}: ${m.rendimiento} u/jornal — jornal $${jornalPorNombre(m.categoria)}`);
    for (const m of materiales) {
      const p = preciosMat.get(m.descripcion);
      console.log(`     MAT ${m.descripcion}: ${m.rendimiento} ${m.unidad} → ${p ? `${p.descripcion} $${p.precioUnitario}/${p.unidad}` : "SIN PRECIO EN CATÁLOGO"}`);
    }

    if (APLICAR) {
      await db.subrubroEstandar.create({
        data: {
          codigo: r.codigo,
          descripcion: r.descripcion,
          unidad: r.unidad,
          precioUY,
          fechaBase: FECHA_BASE,
          aportesSociales: 0,
          origen: ORIGEN,
          activo: true,
          orden,
          capituloId,
          subcapituloId,
          apuEstandar: {
            create: {
              utilidadPct: 10,
              gastosGeneralesPct: 0,
              porcentajePiedra: 0.3,
              materiales: { create: materiales },
              manoObra: { create: manoObra },
            },
          },
        },
      });
    }
    creados++;
  }

  console.log(`\nResumen: ${creados} ${APLICAR ? "creados" : "a crear"}, ${existian} ya existían.`);
  // Cliente que abrió resolverPrecioInsumo (src/lib/db).
  await (await import("../src/lib/db")).db.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
