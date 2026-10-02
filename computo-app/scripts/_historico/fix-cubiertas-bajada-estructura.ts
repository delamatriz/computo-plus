// Fase 2 del bug "clona a $0" — Cubiertas, sub-tanda 10c (ÚLTIMA del
// capítulo): Bajada pluvial + Estructura metálica (2 códigos:
// cubierta-012, cubierta-013, sin apalancamiento entre sí).
//
// Confirmado ANTES de investigar (chequeo de duplicados): "Caño PVC
// bajada pluvial 110mm", "Abrazadera para bajada PVC", "Accesorios
// PVC pluvial" y "Perfil metálico para estructura" tenían 0 filas
// PrecioMTOP preexistentes con ESE texto exacto — sin colisión. Pero
// se encontraron 3 candidatos de REUTILIZACIÓN (mismo producto físico
// con nombre distinto, no colisión):
//  - "Caño PVC desagüe 110mm" ($350/ml, ya resuelto en Instalación
//    Sanitaria) — es el MISMO caño PVC de 110mm físicamente, solo
//    cambia el uso (desagüe interior vs. bajada pluvial exterior). Se
//    reutiliza el precio real en vez de investigar de cero.
//  - "Accesorios PVC sanitario" ($850/gl, ya resuelto en Sanitaria) —
//    categoría análoga (paquete de accesorios/conexiones PVC menores),
//    aunque para un sistema distinto (sanitario vs pluvial). Se
//    reutiliza como referencia de orden de magnitud, no como el mismo
//    producto exacto.
//  - "Perfil metálico para cielorraso/tabique" (Yeso, ya resueltos) —
//    PRODUCTO DISTINTO (perfil liviano de yeso, no estructural), sin
//    riesgo de colisión de texto y sin reutilizar — cubierta-013
//    necesita perfil estructural de verdad, investigado aparte.
//
// cubierta-013 se mide en KG (acero por peso) — distinto al resto del
// capítulo. "Pintura anticorrosiva" ($285/l) y "Electrodos de
// soldadura" ($25/u) YA RESUELTOS de tandas previas, sin tocar.
//
// Fuentes de precio:
//  - Caño PVC bajada pluvial 110mm: REUTILIZADO — $350/ml (mismo caño
//    de 110mm ya resuelto en Sanitaria, ver arriba).
//  - Abrazadera para bajada PVC: ⚠️ ESTIMACIÓN GRUESA — Sodimac
//    Uruguay tiene abrazaderas para caños menores (9mm=$75, 14mm=$69,
//    25mm=$129, 38mm=$109, 57/76mm=$139) pero NINGUNA de 110mm
//    específica. Barraca Carmela y MercadoLibre Uruguay no dieron
//    precio accesible por fetch para el tamaño exacto. Estimado en
//    $200/u, extrapolando la escalera de precios Sodimac (crece con
//    el diámetro, aunque no perfectamente lineal) hacia un diámetro
//    mayor.
//  - Accesorios PVC pluvial: REUTILIZADO por analogía — $850/gl,
//    mismo orden de magnitud que "Accesorios PVC sanitario" (ver
//    arriba). No es el mismo producto exacto, así que se marca como
//    estimación basada en categoría análoga, no confirmación directa.
//  - Perfil metálico para estructura: REAL, Lista Oficial MTOP N°599
//    (nov-2025), código 189, "Perfil de hierro normal (IPN 120mm)" =
//    $140,42/kg — perfil estructural doble Te normal, estándar para
//    estructuras de techo, coincide en unidad (kg) exacta con el
//    código. Se descartaron las variantes ángulo/T (159,66-201,79/kg,
//    perfiles más livianos para bracing secundario, no la estructura
//    principal) por no ser la especificación genérica que pide el
//    código.
//
// Verificación de coherencia (pedida por el usuario, comparando con
// Steel Framing): el perfil crudo ($140,42/kg) más mano de obra
// (corte, soldadura) + pintura anticorrosiva + electrodos + GG/Util
// da un precioUY final de ~2,8x el costo del material crudo — rango
// razonable para una estructura metálica totalmente fabricada e
// instalada (no hay otro elemento ya resuelto en esta base cotizado
// por KG para comparar 1:1; Steel Framing usa ML en perfil liviano de
// otro calibre, no es comparable directamente).
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-cubiertas-bajada-estructura.ts
// Ejecutar (real):     npx tsx scripts/fix-cubiertas-bajada-estructura.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const CANO_PVC_BAJADA_110_ML = 350;
// ⚠️ ESTIMACIÓN GRUESA — extrapolado de la escalera de precios
// Sodimac Uruguay (9mm-76mm), sin producto de 110mm específico.
const ABRAZADERA_BAJADA_PVC_U = 200;
// Reutilizado por analogía de "Accesorios PVC sanitario" — no el
// mismo producto exacto.
const ACCESORIOS_PVC_PLUVIAL_GL = 850;
const PERFIL_HIERRO_IPN120_KG = 140.42;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "cubierta-012",
    materialesNuevos: [
      { codigoMTOP: "MAT-CANO-PVC-BAJADA-110", descripcion: "Caño PVC bajada pluvial 110mm", unidad: "ml", precio: CANO_PVC_BAJADA_110_ML },
      { codigoMTOP: "MAT-ABRAZADERA-BAJADA-PVC", descripcion: "Abrazadera para bajada PVC", unidad: "u", precio: ABRAZADERA_BAJADA_PVC_U },
      { codigoMTOP: "MAT-ACCESORIOS-PVC-PLUVIAL", descripcion: "Accesorios PVC pluvial", unidad: "gl", precio: ACCESORIOS_PVC_PLUVIAL_GL },
    ],
  },
  {
    codigo: "cubierta-013",
    materialesNuevos: [{ codigoMTOP: "MAT-PERFIL-HIERRO-ESTRUCTURA", descripcion: "Perfil metálico para estructura", unidad: "kg", precio: PERFIL_HIERRO_IPN120_KG }],
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
