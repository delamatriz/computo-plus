// Expansión de biblioteca — Instalación de Gas y Contra Incendio.
//
// Agrega 2 CapituloCatalogo nuevos (orden 19 y 20), 28 PrecioMTOP nuevos
// (materiales sin cobertura en la Lista MTOP N°599 — gas/incendio no están
// contemplados ahí), 1 CategoriaLaboral nueva ("Oficial Gasista", mismo
// jornal que el resto de los oficiales especializados — Electricista
// oficial/Plomero oficial/Pintor oficial ya comparten esa misma tarifa),
// y 17 SubrubroEstandar + su APUEstandar (materiales + mano de obra).
//
// precioUY se calcula acá mismo con la MISMA fórmula que usa
// /api/subrubros-estandar/[id]/clonar-apu (costoDirecto × (1+GG%) ×
// (1+Util%), GG=15%/Util=10% son los defaults de APUEstandar) — el script
// histórico que hacía este recálculo por separado (recalcular-precios-
// subrubros-estandar.ts) se borró en la Etapa 6b, así que se resuelve acá
// para no dejar el precio en 0 sin una forma de recalcularlo después.
//
// aportesSociales se deja en su default (0) — es un campo heredado de la
// importación original del rubrado SAU 2022 (llega ya calculado en esos
// datos), no se usa en ningún cálculo de precio del sistema
// (clonar-apu no lo lee) y ningún alta manual de esta sesión lo completa
// tampoco (Sika, URUMIX, Aberturas, Patología de Fachada — mismo criterio).
//
// Precios de materiales: valores de referencia de mercado uruguayo
// (2026-07) — no hay Lista MTOP que cubra gas/incendio. Igual que el resto
// de la biblioteca, quedan marcados por `fechaBase`/`fechaLista` para que
// la UI ("precio base 2026-07 — actualizar con ICCV") recuerde que hay que
// verificarlos — no se inventó ningún mecanismo nuevo de advertencia.
//
// Idempotente (upsert por código/nombre en todas las tablas).
//
// Ejecutar (dry-run): npx tsx scripts/seed-gas-incendio.ts
// Ejecutar (real):     npx tsx scripts/seed-gas-incendio.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

// ── CapituloCatalogo nuevos ─────────────────────────────────────────────
const CAPITULOS_NUEVOS = [
  { nombre: "Instalación de Gas", orden: 19 },
  { nombre: "Contra Incendio", orden: 20 },
];

// ── CategoriaLaboral nueva ──────────────────────────────────────────────
// Mismo jornal que Electricista oficial/Plomero oficial/Oficial
// especializado (todos comparten la tarifa de oficial especializado del
// convenio SUNCA) — no se inventa un número nuevo, se reusa esa tarifa.
const OFICIAL_GASISTA_JORNAL = 2767.81;

// ── PrecioMTOP nuevos (materiales sin cobertura en Lista MTOP N°599) ────
const PRECIOS_MTOP_NUEVOS = [
  { codigo: "MAT-GAS-CANO-12", descripcion: "Caño cobre 1/2\" para gas", unidad: "m", precioUnitario: 450 },
  { codigo: "MAT-GAS-CODO-12", descripcion: "Codo cobre 1/2\" para gas", unidad: "u", precioUnitario: 180 },
  { codigo: "MAT-GAS-LLAVE-ESFERA-12", descripcion: "Llave de esfera 1/2\" para gas", unidad: "u", precioUnitario: 650 },
  { codigo: "MAT-GAS-SOLDADURA", descripcion: "Soldadura/fundente para cañería de cobre de gas", unidad: "kg", precioUnitario: 950 },
  { codigo: "MAT-GAS-GRAMPAS", descripcion: "Grampas de fijación para cañería de gas", unidad: "u", precioUnitario: 45 },
  { codigo: "MAT-GAS-CANO-34", descripcion: "Caño cobre 3/4\" para gas", unidad: "m", precioUnitario: 680 },
  { codigo: "MAT-GAS-LLAVE-PASO", descripcion: "Llave de paso de gas homologada", unidad: "u", precioUnitario: 1450 },
  { codigo: "MAT-GAS-ACCESORIOS-LLAVE", descripcion: "Accesorios de conexión para llave de paso de gas", unidad: "u", precioUnitario: 320 },
  { codigo: "MAT-GAS-CAJA-MEDIDOR", descripcion: "Caja para medidor de gas normalizada", unidad: "u", precioUnitario: 3800 },
  { codigo: "MAT-GAS-REGULADOR", descripcion: "Regulador de presión de gas", unidad: "u", precioUnitario: 2200 },
  { codigo: "MAT-GAS-ACCESORIOS-CAJA", descripcion: "Accesorios de fijación para caja de medidor de gas", unidad: "u", precioUnitario: 450 },
  { codigo: "MAT-GAS-BASE-TANQUE", descripcion: "Base de hormigón o soporte metálico para tanque de supergás", unidad: "u", precioUnitario: 2800 },
  { codigo: "MAT-GAS-CADENA-TANQUE", descripcion: "Cadena/traba de seguridad para tanque de supergás", unidad: "u", precioUnitario: 650 },
  { codigo: "MAT-GAS-REJILLA-ALTA", descripcion: "Rejilla de ventilación alta para local de medidores/caldera", unidad: "u", precioUnitario: 980 },
  { codigo: "MAT-GAS-REJILLA-BAJA", descripcion: "Rejilla de ventilación baja para local de medidores/caldera", unidad: "u", precioUnitario: 980 },

  { codigo: "MAT-INC-EXTINTOR-PQS", descripcion: "Extintor PQS 5kg homologado", unidad: "u", precioUnitario: 3200 },
  { codigo: "MAT-INC-EXTINTOR-CO2", descripcion: "Extintor CO2 5kg homologado", unidad: "u", precioUnitario: 5500 },
  { codigo: "MAT-INC-SOPORTE-EXTINTOR", descripcion: "Soporte de pared para extintor", unidad: "u", precioUnitario: 450 },
  { codigo: "MAT-INC-GABINETE-BIE", descripcion: "Gabinete BIE completo (manguera 20-25m, lanza y válvula)", unidad: "u", precioUnitario: 28000 },
  { codigo: "MAT-INC-DETECTOR-HUMO", descripcion: "Detector de humo fotoeléctrico homologado", unidad: "u", precioUnitario: 1850 },
  { codigo: "MAT-INC-CABLEADO", descripcion: "Cableado y accesorios para detección de incendio (GL por punto)", unidad: "gl", precioUnitario: 850 },
  { codigo: "MAT-INC-CENTRAL", descripcion: "Panel central de detección de incendio", unidad: "u", precioUnitario: 65000 },
  { codigo: "MAT-INC-SIRENA", descripcion: "Sirena de incendio homologada", unidad: "u", precioUnitario: 2400 },
  { codigo: "MAT-INC-CARTEL", descripcion: "Cartel fotoluminiscente normalizado (señalética de evacuación)", unidad: "u", precioUnitario: 580 },
  { codigo: "MAT-INC-FIJACIONES-CARTEL", descripcion: "Fijaciones para señalética de evacuación", unidad: "gl", precioUnitario: 85 },
  { codigo: "MAT-INC-PUERTA-CORTAFUEGO", descripcion: "Puerta cortafuego homologada RF-60/90 (marco y herrajes)", unidad: "u", precioUnitario: 48000 },
  { codigo: "MAT-INC-ROCIADOR", descripcion: "Cabezal rociador automático (sprinkler)", unidad: "u", precioUnitario: 1650 },
  { codigo: "MAT-INC-CANO-ROCIADOR", descripcion: "Cañería de alimentación para rociador automático", unidad: "ml", precioUnitario: 890 },
] as const;

const precioPorCodigo = new Map<string, (typeof PRECIOS_MTOP_NUEVOS)[number]>(
  PRECIOS_MTOP_NUEVOS.map((p) => [p.codigo, p])
);

type MaterialDef = { precioCodigo: string; rendimiento: number };
type ManoObraDef = { categoria: string; rendimiento: number };

const CODIGOS: {
  codigo: string;
  capitulo: "Instalación de Gas" | "Contra Incendio";
  descripcion: string;
  unidad: string;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
}[] = [
  {
    codigo: "gas-001",
    capitulo: "Instalación de Gas",
    descripcion: "Punto de gas para artefacto",
    unidad: "U",
    materiales: [
      { precioCodigo: "MAT-GAS-CANO-12", rendimiento: 2 },
      { precioCodigo: "MAT-GAS-CODO-12", rendimiento: 2 },
      { precioCodigo: "MAT-GAS-LLAVE-ESFERA-12", rendimiento: 1 },
      { precioCodigo: "MAT-GAS-SOLDADURA", rendimiento: 0.1 },
    ],
    manoObra: [
      { categoria: "Oficial Gasista", rendimiento: 3 },
      { categoria: "Ayudante", rendimiento: 3 },
    ],
  },
  {
    codigo: "gas-002",
    capitulo: "Instalación de Gas",
    descripcion: "Cañería de cobre para gas 1/2\"",
    unidad: "ML",
    materiales: [
      { precioCodigo: "MAT-GAS-CANO-12", rendimiento: 1.05 },
      { precioCodigo: "MAT-GAS-GRAMPAS", rendimiento: 0.5 },
      { precioCodigo: "MAT-GAS-SOLDADURA", rendimiento: 0.02 },
    ],
    manoObra: [{ categoria: "Oficial Gasista", rendimiento: 15 }],
  },
  {
    codigo: "gas-003",
    capitulo: "Instalación de Gas",
    descripcion: "Cañería de cobre para gas 3/4\"",
    unidad: "ML",
    materiales: [
      { precioCodigo: "MAT-GAS-CANO-34", rendimiento: 1.05 },
      { precioCodigo: "MAT-GAS-GRAMPAS", rendimiento: 0.5 },
      { precioCodigo: "MAT-GAS-SOLDADURA", rendimiento: 0.025 },
    ],
    manoObra: [{ categoria: "Oficial Gasista", rendimiento: 12 }],
  },
  {
    codigo: "gas-004",
    capitulo: "Instalación de Gas",
    descripcion: "Llave de paso de gas",
    unidad: "U",
    materiales: [
      { precioCodigo: "MAT-GAS-LLAVE-PASO", rendimiento: 1 },
      { precioCodigo: "MAT-GAS-ACCESORIOS-LLAVE", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Oficial Gasista", rendimiento: 6 }],
  },
  {
    codigo: "gas-005",
    capitulo: "Instalación de Gas",
    descripcion: "Medidor de gas — caja y regulador (no incluye el medidor provisto por la compañía de gas)",
    unidad: "U",
    materiales: [
      { precioCodigo: "MAT-GAS-CAJA-MEDIDOR", rendimiento: 1 },
      { precioCodigo: "MAT-GAS-REGULADOR", rendimiento: 1 },
      { precioCodigo: "MAT-GAS-ACCESORIOS-CAJA", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Oficial Gasista", rendimiento: 2 }],
  },
  {
    codigo: "gas-006",
    capitulo: "Instalación de Gas",
    descripcion: "Soporte y anclaje para tanque de supergás",
    unidad: "U",
    materiales: [
      { precioCodigo: "MAT-GAS-BASE-TANQUE", rendimiento: 1 },
      { precioCodigo: "MAT-GAS-CADENA-TANQUE", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 2 },
      { categoria: "Ayudante", rendimiento: 2 },
    ],
  },
  {
    codigo: "gas-007",
    capitulo: "Instalación de Gas",
    descripcion: "Ventilación reglamentaria de local de medidores/caldera",
    unidad: "GL",
    materiales: [
      { precioCodigo: "MAT-GAS-REJILLA-ALTA", rendimiento: 1 },
      { precioCodigo: "MAT-GAS-REJILLA-BAJA", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Oficial albañil", rendimiento: 1 }],
  },
  {
    codigo: "gas-008",
    capitulo: "Instalación de Gas",
    descripcion: "Prueba de hermeticidad y habilitación de instalación de gas (requiere habilitación por técnico matriculado según normativa vigente en Uruguay)",
    unidad: "GL",
    materiales: [],
    manoObra: [{ categoria: "Oficial Gasista", rendimiento: 0.5 }],
  },

  {
    codigo: "incendio-001",
    capitulo: "Contra Incendio",
    descripcion: "Extintor PQS 5kg con soporte",
    unidad: "U",
    materiales: [
      { precioCodigo: "MAT-INC-EXTINTOR-PQS", rendimiento: 1 },
      { precioCodigo: "MAT-INC-SOPORTE-EXTINTOR", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Ayudante", rendimiento: 8 }],
  },
  {
    codigo: "incendio-002",
    capitulo: "Contra Incendio",
    descripcion: "Extintor CO2 5kg con soporte",
    unidad: "U",
    materiales: [
      { precioCodigo: "MAT-INC-EXTINTOR-CO2", rendimiento: 1 },
      { precioCodigo: "MAT-INC-SOPORTE-EXTINTOR", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Ayudante", rendimiento: 8 }],
  },
  {
    codigo: "incendio-003",
    capitulo: "Contra Incendio",
    descripcion: "Boca de incendio equipada (BIE) completa",
    unidad: "U",
    materiales: [{ precioCodigo: "MAT-INC-GABINETE-BIE", rendimiento: 1 }],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 1 },
      { categoria: "Ayudante", rendimiento: 1 },
    ],
  },
  {
    codigo: "incendio-004",
    capitulo: "Contra Incendio",
    descripcion: "Detector de humo",
    unidad: "U",
    materiales: [
      { precioCodigo: "MAT-INC-DETECTOR-HUMO", rendimiento: 1 },
      { precioCodigo: "MAT-INC-CABLEADO", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Electricista oficial", rendimiento: 6 }],
  },
  {
    codigo: "incendio-005",
    capitulo: "Contra Incendio",
    descripcion: "Central de detección de incendio",
    unidad: "U",
    materiales: [{ precioCodigo: "MAT-INC-CENTRAL", rendimiento: 1 }],
    manoObra: [{ categoria: "Electricista oficial", rendimiento: 0.5 }],
  },
  {
    codigo: "incendio-006",
    capitulo: "Contra Incendio",
    descripcion: "Sirena/alarma de incendio",
    unidad: "U",
    materiales: [
      { precioCodigo: "MAT-INC-SIRENA", rendimiento: 1 },
      { precioCodigo: "MAT-INC-CABLEADO", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Electricista oficial", rendimiento: 5 }],
  },
  {
    codigo: "incendio-007",
    capitulo: "Contra Incendio",
    descripcion: "Señalética de evacuación y extinción",
    unidad: "U",
    materiales: [
      { precioCodigo: "MAT-INC-CARTEL", rendimiento: 1 },
      { precioCodigo: "MAT-INC-FIJACIONES-CARTEL", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Ayudante", rendimiento: 15 }],
  },
  {
    codigo: "incendio-008",
    capitulo: "Contra Incendio",
    descripcion: "Puerta cortafuego",
    unidad: "U",
    materiales: [{ precioCodigo: "MAT-INC-PUERTA-CORTAFUEGO", rendimiento: 1 }],
    manoObra: [{ categoria: "Oficial albañil", rendimiento: 0.5 }],
  },
  {
    codigo: "incendio-009",
    capitulo: "Contra Incendio",
    descripcion: "Rociador automático (sprinkler)",
    unidad: "U",
    materiales: [
      { precioCodigo: "MAT-INC-ROCIADOR", rendimiento: 1 },
      { precioCodigo: "MAT-INC-CANO-ROCIADOR", rendimiento: 2 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 4 },
      { categoria: "Ayudante", rendimiento: 4 },
    ],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  // ── 1. CapituloCatalogo ────────────────────────────────────────────
  console.log("── CapituloCatalogo ──");
  const capituloIdPorNombre = new Map<string, string>();
  for (const cap of CAPITULOS_NUEVOS) {
    const existente = await db.capituloCatalogo.findUnique({ where: { nombre: cap.nombre } });
    console.log(
      `  ${existente ? "= ya existe" : "+ nuevo"} — "${cap.nombre}" (orden ${cap.orden})${existente ? ` [id=${existente.id}]` : ""}`
    );
    if (aplicar) {
      const resultado = await db.capituloCatalogo.upsert({
        where: { nombre: cap.nombre },
        create: { nombre: cap.nombre, orden: cap.orden, activo: true },
        update: {},
      });
      capituloIdPorNombre.set(cap.nombre, resultado.id);
    } else if (existente) {
      capituloIdPorNombre.set(cap.nombre, existente.id);
    }
  }

  // ── 2. CategoriaLaboral — Oficial Gasista ─────────────────────────
  console.log("\n── CategoriaLaboral ──");
  const existenteGasista = await db.categoriaLaboral.findFirst({ where: { nombre: "Oficial Gasista" } });
  console.log(
    existenteGasista
      ? `  = ya existe — "Oficial Gasista" (jornal ${existenteGasista.jornal})`
      : `  + nuevo — "Oficial Gasista" (jornal ${OFICIAL_GASISTA_JORNAL}, misma tarifa que Electricista oficial/Plomero oficial)`
  );
  if (aplicar && !existenteGasista) {
    await db.categoriaLaboral.create({
      data: { nombre: "Oficial Gasista", categoria: "oficial_gasista", jornal: OFICIAL_GASISTA_JORNAL },
    });
  }

  // ── 3. PrecioMTOP nuevos ───────────────────────────────────────────
  console.log("\n── PrecioMTOP (materiales nuevos) ──");
  for (const precio of PRECIOS_MTOP_NUEVOS) {
    const existente = await db.precioMTOP.findUnique({ where: { codigo: precio.codigo } });
    console.log(
      `  ${existente ? "= ya existe" : "+ nuevo"} — ${precio.codigo} — ${precio.descripcion} ($${precio.precioUnitario}/${precio.unidad})`
    );
    if (aplicar) {
      await db.precioMTOP.upsert({
        where: { codigo: precio.codigo },
        create: {
          codigo: precio.codigo,
          descripcion: precio.descripcion,
          cantidadUnidad: `1 ${precio.unidad}`,
          unidad: precio.unidad,
          cantidad: 1,
          precioConIva: precio.precioUnitario,
          precioUnitario: precio.precioUnitario,
          numeroLista: 0,
          fechaLista: FECHA,
        },
        update: {
          precioUnitario: precio.precioUnitario,
          precioConIva: precio.precioUnitario,
        },
      });
    }
  }

  // ── 4. Jornales para cálculo de precioUY (dry-run usa los mismos) ──
  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) => {
    if (nombre === "Oficial Gasista" && !categoriasLaborales.some((c) => c.nombre === "Oficial Gasista")) {
      return OFICIAL_GASISTA_JORNAL;
    }
    return categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  };

  // ── 5. SubrubroEstandar + APUEstandar ──────────────────────────────
  console.log("\n── SubrubroEstandar + APUEstandar ──");
  let creados = 0;
  let actualizados = 0;
  for (const def of CODIGOS) {
    const capituloId = capituloIdPorNombre.get(def.capitulo);

    const sumMat = def.materiales.reduce((s, m) => {
      const precio = precioPorCodigo.get(m.precioCodigo);
      return s + m.rendimiento * (precio?.precioUnitario ?? 0);
    }, 0);
    const sumMO = def.manoObra.reduce((s, mo) => s + jornalPorNombre(mo.categoria) / mo.rendimiento, 0);
    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    const yaExiste = await db.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });
    console.log(
      `  ${yaExiste ? "= actualiza" : "+ crea"} ${def.codigo} — ${def.descripcion} (${def.unidad}) — capituloId=${capituloId ?? "SIN RESOLVER"} — $${precioUY}/${def.unidad} (${def.materiales.length} material(es), ${def.manoObra.length} línea(s) MO)`
    );
    def.materiales.forEach((m) => {
      const p = precioPorCodigo.get(m.precioCodigo);
      console.log(`      material: ${p?.descripcion} — rendimiento ${m.rendimiento} ${p?.unidad} — $${p?.precioUnitario}/${p?.unidad}`);
    });
    def.manoObra.forEach((mo) => {
      console.log(`      MO: ${mo.categoria} — rendimiento ${mo.rendimiento} ${def.unidad}/jornada — jornal $${jornalPorNombre(mo.categoria)}`);
    });

    if (!aplicar) continue;
    if (!capituloId) {
      console.warn(`      ⚠ SIN capituloId resuelto para "${def.capitulo}" — no se puede crear ${def.codigo}, se salta`);
      continue;
    }

    const subrubro = await db.subrubroEstandar.upsert({
      where: { codigo: def.codigo },
      create: {
        codigo: def.codigo,
        descripcion: def.descripcion,
        unidad: def.unidad,
        precioUY,
        fechaBase: FECHA,
        origen: "manual",
        capituloId,
      },
      update: {
        descripcion: def.descripcion,
        unidad: def.unidad,
        precioUY,
        fechaBase: FECHA,
        capituloId,
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
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);
  if (aplicar) {
    console.log(`SubrubroEstandar creados: ${creados}, actualizados: ${actualizados}`);
    const totalCatalogo = await db.capituloCatalogo.count();
    console.log(`Total CapituloCatalogo: ${totalCatalogo}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
