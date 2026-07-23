// Fase 2 del bug "clona a $0" — Instalación Eléctrica, sub-tanda 6d:
// Cámaras IP + DVR/NVR (3 códigos, Cable UTP compartido entre 008/009).
//
// Confirmado (sin material mal asignado) en los 3. Sin equipos en
// ningún APU. Ninguno usado en Rubro real de HOGAR/Matisse Monet.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar, proveedores especializados en seguridad electrónica
// uruguayos (Security Store), no Fivisa/Sodimac (sin línea de
// videovigilancia IP):
//  - Cámara IP exterior: Security Store, IMOU Cruiser SE+ (IPC-
//    S21FEP), WiFi PTZ 2MP, certificación IP66 (resistente a
//    intemperie), USD 71,89 → $2.936,71/u real.
//  - Cámara IP interior: Security Store, IMOU Ranger 2C, WiFi PTZ
//    2MP, USD 49,90 → $2.038,41/u real — misma familia/ecosistema
//    IMOU que la exterior y el NVR, sin certificación de intemperie
//    (uso interior únicamente).
//  - Cable UTP: Security Store, Cable UTP NRG+ Cat5E, 100% cobre, uso
//    interior, rollo 100m, USD 51,90 → $21,20/ml real.
//  - DVR/NVR 4 canales: Security Store, NVR IMOU 4 canales (para
//    cámaras WiFi), USD 103,90 → $4.244,32/u real — misma marca que
//    las cámaras (compatibilidad de ecosistema WiFi), gama de entrada
//    frente al Dahua 4K/IA (USD 187,50, gama superior).
//  - Disco duro para DVR: ⚠️ ESTIMACIÓN GRUESA — Western Digital
//    Purple 1TB (el estándar de la industria para DVR/NVR) está
//    confirmado como producto real en Uruguay (General Security lo
//    tiene en stock, código SAT1T) pero su precio requiere login y
//    "no se vende suelto, solo con la compra de DVR/NVR" — sin precio
//    público verificable. Estimado en USD 45 → $1.838,25/u, en línea
//    con el rango regional típico para este modelo.
//
// Verificación pedida por el usuario — ¿el diferencial exterior/
// interior está justificado?: SÍ. La cámara exterior cuesta 44,1% más
// que la interior (USD 71,89 vs USD 49,90) — la diferencia real es la
// certificación IP66 (resistente a lluvia/intemperie) de la línea
// Cruiser SE+ frente a la Ranger 2C, que es exclusivamente para
// interior. No es una diferencia arbitraria de marca o gama.
//
// Autocuestionamiento pedido por el usuario — ¿el DVR de 4 canales
// está sobredimensionado para un presupuesto con solo 2 cámaras (008 +
// 009)?: NO. Los 3 códigos son ítems independientes de biblioteca —
// el usuario arma la combinación real en cada proyecto (puede ser
// 2, 3 o 4 cámaras con el mismo DVR). 4 canales es el escalón de
// entrada estándar del mercado (2 canales prácticamente no se ofrece
// en las marcas principales en Uruguay) y deja margen de expansión
// razonable sobre una base de 2 cámaras, no es sobredimensionamiento.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-electrica-camaras-dvr.ts
// Ejecutar (real):     npx tsx scripts/fix-electrica-camaras-dvr.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const CAMARA_IP_EXT_U = 71.89 * USD_UYU;
const CAMARA_IP_INT_U = 49.9 * USD_UYU;
const CABLE_UTP_ML = (51.9 / 100) * USD_UYU;
const DVR_NVR_4CH_U = 103.9 * USD_UYU;
// ⚠️ ESTIMACIÓN GRUESA — sin precio público verificado en Uruguay (ver
// header). Revisar si en el futuro un proveedor local publica precio
// suelto del WD Purple 1TB (o equivalente).
const DISCO_DURO_DVR_U = 45 * USD_UYU;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "electrica-008",
    materialesNuevos: [
      { codigoMTOP: "MAT-CAMARA-IP-EXTERIOR", descripcion: "Cámara IP exterior", unidad: "u", precio: CAMARA_IP_EXT_U },
      { codigoMTOP: "MAT-CABLE-UTP", descripcion: "Cable UTP", unidad: "ml", precio: CABLE_UTP_ML },
    ],
  },
  {
    codigo: "electrica-009",
    materialesNuevos: [
      { codigoMTOP: "MAT-CAMARA-IP-INTERIOR", descripcion: "Cámara IP interior", unidad: "u", precio: CAMARA_IP_INT_U },
      { codigoMTOP: "MAT-CABLE-UTP", descripcion: "Cable UTP", unidad: "ml", precio: CABLE_UTP_ML },
    ],
  },
  {
    codigo: "electrica-010",
    materialesNuevos: [
      { codigoMTOP: "MAT-DVR-NVR-4CANALES", descripcion: "DVR/NVR 4 canales", unidad: "u", precio: DVR_NVR_4CH_U },
      { codigoMTOP: "MAT-DISCO-DURO-DVR", descripcion: "Disco duro para DVR", unidad: "u", precio: DISCO_DURO_DVR_U },
    ],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const todosPrecios = await db.precioMTOP.findMany();
  const resolverPrecioExistente = (desc: string) =>
    todosPrecios.find((p) => p.descripcion.toLowerCase().includes(desc.toLowerCase()))?.precioUnitario ?? 0;
  const todosEquipos = await db.precioEquipo.findMany();
  const resolverCostoEquipo = (desc: string) =>
    todosEquipos.find((e) => e.descripcion.toLowerCase().includes(desc.toLowerCase()))?.precioHora ?? 0;

  for (const def of DEFS) {
    const s = await db.subrubroEstandar.findFirst({
      where: { codigo: def.codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
    });
    if (!s || !s.apuEstandar) {
      console.error(`${def.codigo}: no encontrado — abortando.`);
      continue;
    }

    console.log(`\n${def.codigo} — ${s.descripcion}`);
    let sumMat = 0;

    for (const m of s.apuEstandar.materiales) {
      const nuevo = def.materialesNuevos.find((n) => n.descripcion.toLowerCase() === m.descripcion.toLowerCase());
      if (nuevo) {
        const precio = Math.round(nuevo.precio * 100) / 100;
        console.log(`  material: ${nuevo.descripcion} — $${precio}/${nuevo.unidad} (${nuevo.codigoMTOP}) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;

        if (aplicar) {
          await db.precioMTOP.upsert({
            where: { codigo: nuevo.codigoMTOP },
            create: {
              codigo: nuevo.codigoMTOP,
              descripcion: nuevo.descripcion,
              cantidadUnidad: `1 ${nuevo.unidad}`,
              unidad: nuevo.unidad,
              cantidad: 1,
              precioConIva: precio,
              precioUnitario: precio,
              numeroLista: 0,
              fechaLista: FECHA,
            },
            update: { precioUnitario: precio, precioConIva: precio },
          });
        }
      } else {
        const precio = resolverPrecioExistente(m.descripcion);
        console.log(`  material: ${m.descripcion} — $${precio}/${m.unidad} (ya real, sin cambios) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;
      }
    }

    const sumMO = s.apuEstandar.manoObra.reduce((acc, mo) => {
      const jornal = jornalPorNombre(mo.categoria);
      console.log(`  MO: ${mo.categoria} — rendimiento ${mo.rendimiento} U/jornada (sin cambios)`);
      return acc + jornal / mo.rendimiento;
    }, 0);

    const sumEq = s.apuEstandar.equipos.reduce((acc, eq) => {
      const costo = resolverCostoEquipo(eq.descripcion);
      console.log(`  Equipo: ${eq.descripcion} — $${costo}/${eq.unidad} (ya real, sin cambios) × rend ${eq.rendimiento}`);
      return acc + eq.rendimiento * costo;
    }, 0);
    if (s.apuEstandar.equipos.length === 0) {
      console.log(`  (sin equipos)`);
    }

    const costoDirecto = sumMat + sumMO + sumEq;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} sumEq=$${sumEq.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`  precioUY actual: $${s.precioUY} (fechaBase ${s.fechaBase}) → NUEVO: $${precioUY}`);

    if (aplicar) {
      await db.subrubroEstandar.update({ where: { codigo: def.codigo }, data: { precioUY, fechaBase: FECHA } });
    }
  }

  if (!aplicar) {
    console.log("\nDry-run — nada se escribió.");
  } else {
    console.log("\nAplicado.");
  }
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
