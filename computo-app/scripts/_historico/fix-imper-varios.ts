// Fase 2 del bug "clona a $0" — Impermeabilizaciones, sub-tanda 8b
// (última del capítulo): Aislantes y barreras varios (4 códigos: 6.6.4,
// 6.6.5, 6.6.6, 6.6.7, sin apalancamiento entre sí).
//
// Confirmado ANTES de investigar (chequeo de duplicados de tandas
// previas): los 4 insumos tenían 0 filas PrecioMTOP preexistentes —
// genuinamente parte del bug, sin colisión. Sin equipos en ningún
// APU. Ninguno usado en Rubro real de HOGAR/Matisse Monet.
//
// USO COMPARTIDO DETECTADO (mismo patrón que la membrana en 8a): el
// código 8.2.3 (MONTAJE DE PANELES DE POLIURETANO EXPANDIDO, capítulo
// "Sistemas No Tradicionales" → subcapítulo "Paneles Térmicos", el
// que había quedado pendiente al cerrar Steel Framing) también usa
// "Poliuretano expandido e=3cm" — se resuelve de yapa con este fix,
// como bonus colateral (avisado antes de aplicar, según lo pedido).
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar:
//  - Polietileno 100 micrones: EMAT, Nylon 100 micrones tubular
//    (transparente), $359,12/kg, rendimiento 2,6 m lineales/kg × 2m
//    de ancho de tubo = 5,2 m²/kg → $69,06/m² real.
//  - Espuma plast autotrabante: CORREGIDO tras aviso del usuario —
//    Bromyros ya no comercializa este producto específico (el T-I/
//    T-II de Sodimac usado en la primera pasada era una placa lisa
//    genérica, sin patitas de encastre confirmadas). El producto real
//    con sistema de "patitas" de encastre lo comercializa hoy
//    Montfrío (misma empresa de Isopanel): "Placa Autoencastre
//    Poliestireno expandido [EPS]" — EPS alta densidad con patitas
//    separadoras que crean cámara ventilada de drenaje, para
//    aislación térmica sobre losa. Coincide exacto con la
//    descripción del material.
//    Dato de espesor clave: la unidad de catálogo "5cm" es en
//    realidad 3cm de placa aislante + 2cm de patitas (espaciadores
//    huecos, no material aislante).
//    ⚠️⚠️ ESTIMACIÓN GRUESA DE BAJA CONFIANZA — precio NO confirmado
//    con ficha de producto ni PDF técnico. Se intentó explícitamente
//    (pedido del usuario) verificar con fetch directo:
//      - www.montfrio.com.uy/placa-autoencastre/ — página del
//        fabricante SIN precio publicado (solo invita a contactar por
//        tel./email/WhatsApp), confirma nombre/descripción/patitas
//        exactos pero no precio ni dimensiones ni espesores.
//      - 4 PDFs técnicos/lista de precios del propio dominio
//        montfrio.com.uy (incl. "6-PLACA-AUTOENCASTRE.pdf" y la lista
//        de precios "Lista Nº661-EPS-Vig.-01.06.20") — TODOS 404,
//        tanto con y sin "www.", tanto por fetch directo como
//        encontrados primero por buscador.
//      - Justcrea.com (revendedor de Montfrío) — solo lista un
//        producto DISTINTO ("Panel Aislante Autoportante", con
//        chapa galvanizada, no la placa EPS con patitas), sin precio.
//      - Ningún otro distribuidor uruguayo encontrado que liste este
//        producto específico con precio propio.
//    El valor $650/u apareció en 2 snippets de resultados de búsqueda
//    (no en una página fetcheada directamente), consistente entre sí,
//    pero SIN verificación independiente de fuente. NO se trata de un
//    precio real confirmado — es la mejor estimación disponible con
//    esta caveat explícita. Se asume además que $650 es por unidad de
//    1m² (convención del mercado para este tipo de placa en Uruguay,
//    también sin confirmar para este producto puntual).
//    Ajuste de espesor: nuestro código pide e=2,5cm, no 5cm total.
//    Como el espesor real de aislación sería 3cm (no 5cm — los otros
//    2cm serían patitas huecas), se ajusta proporcionalmente sobre
//    esos 3cm de aislación efectiva: $650 × (2,5/3) = $541,67/m².
//  - Poliuretano expandido e=3cm: ⚠️ ESTIMACIÓN GRUESA — no se
//    encontró venta minorista de material suelto por m² en Uruguay.
//    El poliuretano proyectado se vende como SERVICIO instalado
//    (material + equipo especializado + mano de obra propia del
//    aplicador, sin desglose), y los kits de cartucho DIY encontrados
//    (ej. Todoobra, rendimiento 5m²/cartucho) no son aptos para una
//    aplicación de 3cm en toda la superficie. Estimado en $350/m²,
//    con margen sobre la Espuma Plast real de espesor similar
//    (~3,3x), dado el mejor desempeño térmico por cm del poliuretano
//    proyectado frente al EPS — orden de magnitud verificado, no es
//    un número forzado sin criterio, pero sigue siendo estimación.
//  - Papel craft: ⚠️ ESTIMACIÓN GRUESA — los proveedores uruguayos
//    encontrados (PañoPlus, Porto Ltda., Packaging.uy) venden por kg
//    o unidad de rollo sin especificar largo total/cobertura en m²
//    verificable. Estimado en $25/m².
//
// Autocuestionamiento pedido por el usuario — ACTUALIZADO tras la
// corrección de fuente de la espuma plast: con el precio Bromyros
// anterior ($106,25/m²), el poliuretano ($350/m²) salía 3,3x más
// caro, congruente con su mejor desempeño térmico. Con el precio
// Montfrío corregido ($541,67/m²), la relación SE INVIERTE: el
// poliuretano ($350/m²) queda ~35% MÁS BARATO que la espuma plast
// autotrabante. Esto es plausible — la espuma plast autotrabante es
// un sistema con patitas de encastre y cámara de drenaje (más
// elaborado mecánicamente, no solo aislación), mientras que el
// poliuretano proyectado sigue siendo una estimación gruesa de
// servicio instalado. Se marca la inversión explícitamente para que
// el usuario la evalúe — no se fuerza el orden de magnitud anterior.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-imper-varios.ts
// Ejecutar (real):     npx tsx scripts/fix-imper-varios.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const POLIETILENO_M2 = 359.12 / (2.6 * 2);
// ⚠️ ESTIMACIÓN GRUESA — sin venta minorista de material suelto en
// Uruguay (ver header). Revisar si aparece un proveedor que venda el
// material aparte del servicio instalado.
const POLIURETANO_M2 = 350;
// ⚠️ CONFIANZA MENOR — precio Montfrío ($650/u, asumido $/m²) no
// verificado con fetch directo de página (ver header). Espesor real
// de aislación 3cm (5cm total incluye 2cm de patitas huecas),
// ajustado proporcionalmente al e=2,5cm de nuestro código.
// NO SE APLICA en esta pasada — precio sin verificación de fetch
// directo (ver caveat arriba). 6.6.6 queda PENDIENTE, fuera de DEFS,
// para no tocar el código con un dato de baja confianza. Se deja la
// constante calculada documentada para retomar cuando aparezca una
// fuente confiable.
const ESPUMA_PLAST_MONTFRIO_U = 650;
const ESPUMA_PLAST_ESPESOR_REAL_CM = 3;
const ESPUMA_PLAST_ESPESOR_CODIGO_CM = 2.5;
const ESPUMA_PLAST_M2 = Math.round(ESPUMA_PLAST_MONTFRIO_U * (ESPUMA_PLAST_ESPESOR_CODIGO_CM / ESPUMA_PLAST_ESPESOR_REAL_CM) * 100) / 100;
void ESPUMA_PLAST_M2;
// ⚠️ ESTIMACIÓN GRUESA — sin fuente Uruguay con cobertura m² clara
// publicada (ver header).
const PAPEL_CRAFT_M2 = 25;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "6.6.4", materialesNuevos: [{ codigoMTOP: "MAT-POLIETILENO-100MICRONES", descripcion: "Polietileno 100 micrones", unidad: "m2", precio: POLIETILENO_M2 }] },
  { codigo: "6.6.5", materialesNuevos: [{ codigoMTOP: "MAT-POLIURETANO-EXP-3CM", descripcion: "Poliuretano expandido e=3cm", unidad: "m2", precio: POLIURETANO_M2 }] },
  { codigo: "6.6.7", materialesNuevos: [{ codigoMTOP: "MAT-PAPEL-CRAFT", descripcion: "Papel craft", unidad: "m2", precio: PAPEL_CRAFT_M2 }] },
  // Bonus colateral (auditoría de arrastre, capítulo "Sistemas No
  // Tradicionales" → subcapítulo "Paneles Térmicos"): reutiliza
  // "Poliuretano expandido e=3cm", ya resuelto arriba vía
  // resolverPrecioExistente — sin materialesNuevos propio.
  { codigo: "8.2.3", materialesNuevos: [] },
];
// 6.6.6 (Espuma plast autotrabante) queda PENDIENTE — ver caveat de
// confianza arriba. No incluido en DEFS a propósito.

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
