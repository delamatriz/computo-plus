// Fase 2 del bug "clona a $0" — Hierro suelto (Subcontratos -
// Carpinterías), 3 códigos que NO forman parte de los pares carpmet-
// ya resueltos: 7.3.12, 7.3.13, 7.3.16.
//
// Hallazgo (mismo cuidado que 7.3.14/15/18): el material "Accesorios
// instalación motor portón" de 7.3.16 (motor BATIENTE) coincidía por
// error de `contains` con el PrecioMTOP "Accesorios instalación motor
// portón CORREDIZO" ($1.200, creado para carpmet-008 "Motor para
// portón corredizo"). Son kits de accesorios distintos (brazo
// articulado/bisagras vs. cremallera/riel) — se separa en un
// PrecioMTOP propio para batiente, mismo valor de referencia ($1.200,
// mismo orden de magnitud, sin fuente puntual mejor).
//
// Ninguno de los 3 usado en Rubro real de HOGAR/Matisse Monet.
//
// Fuentes de precio:
//  - 7.3.12 (Ventana en perfil de hierro 1.40x1.10m): sin cotización
//    directa de "ventana en marco de hierro" como producto terminado
//    en plaza uruguaya — ⚠️⚠️ estimación gruesa con doble advertencia,
//    metraje de perfil estimado (marco perimetral 5,0m + hoja móvil
//    interior 3,6m = 8,6m de tubo 25x25x2mm, ~1,44kg/m según densidad
//    del acero) × precio real Lista MTOP código 203 "Perfil de hierro,
//    ángulo 25x25x3mm" $171,92/kg (perfil más cercano en tamaño
//    nominal disponible en la Lista, no es exactamente el tubo hueco
//    25x25x2mm). Cruzado contra CYPE Uruguay "Carpintería de acero
//    S235JR, ventana practicable 120x120cm" ($17.190,50, incluye
//    herrajes de colgar que nuestra categoría excluye) como referencia
//    de gama alta — el número usado acá es sustancialmente menor por
//    tratarse de un producto más básico sin ese nivel de terminación.
//  - 7.3.13 (Reja 1.40x1.10m): mismo perfil "Tubo cuadrado acero
//    25x25x2mm" que ya trae el APU (rendimiento 12kg) — Lista MTOP
//    código 203 $171,92/kg (fuente real). Cruzado contra CYPE Uruguay
//    "Reja de acero, perfil macizo 12x12mm" ($3.935,42/m², implica
//    ~$166/kg de acero) — consistente, confirma el orden de magnitud.
//    Pintura anticorrosiva y electrodos de soldadura ya reales, sin
//    cambios.
//  - 7.3.16 (Motor para portón batiente): reemplaza la primera
//    estimación (cadena BFT España + margen de importación, $56.047,51
//    — descartada por dar un número muy por encima de plaza real).
//    Fuente real encontrada tras agotar comercios uruguayos: Carrasco
//    Import (Montevideo, carrascoimport.com), línea MOTORTEK — motor
//    batiente 300kg WiFi USD 235 / 400kg WiFi-Bluetooth USD 269 /
//    700kg (industrial) USD 359, TODOS motor solo (centralita y
//    receptor se venden aparte, igual que en nuestro APU). Se usó el
//    modelo de 400kg (gama residencial media) → USD 269 × $40,85/USD
//    = $10.988,65. Cruzado contra MercadoLibre Uruguay: cae dentro del
//    rango "$10.000-$20.000" reportado como el más poblado para esta
//    categoría — consistente. "Accesorios instalación motor portón
//    batiente" se mantiene en $1.200 (mismo valor de referencia ya
//    usado, sin fuente puntual mejor encontrada para ese ítem
//    específico).
//
// Sin cambios de mano de obra en los 3. GG 15% / Utilidad 10%, sin
// leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-hierro-suelto-carpinterias.ts
// Ejecutar (real):     npx tsx scripts/fix-hierro-suelto-carpinterias.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const PRECIO_KG_MTOP = 171.92; // Lista MTOP código 203, perfil ángulo 25x25x3mm

type Def = {
  codigo: string;
  materialCodigoMTOP: string;
  materialDescripcion: string;
  materialUnidad: string;
  materialPrecio: number;
};

const DEFS: Def[] = [
  {
    codigo: "7.3.12",
    materialCodigoMTOP: "MAT-VENTANA-HIERRO-140110",
    materialDescripcion: "Ventana en perfil de hierro 1.40x1.10m",
    materialUnidad: "u",
    materialPrecio: 8.6 * 1.4444 * PRECIO_KG_MTOP, // 8.6m de tubo 25x25x2mm estimado
  },
  {
    codigo: "7.3.13",
    materialCodigoMTOP: "MAT-TUBO-CUADRADO-25X25X2",
    materialDescripcion: "Tubo cuadrado acero 25x25x2mm",
    materialUnidad: "kg",
    materialPrecio: PRECIO_KG_MTOP, // precio por kg — el APU ya trae rendimiento 12kg
  },
  {
    codigo: "7.3.16",
    materialCodigoMTOP: "MAT-MOTOR-PORTON-BATIENTE",
    materialDescripcion: "Motor para portón batiente",
    materialUnidad: "u",
    materialPrecio: 269 * 40.85, // Carrasco Import (Montevideo), MOTORTEK 400kg WiFi/Bluetooth, real
  },
];

const ACCESORIOS_MOTOR_BATIENTE_PRECIO = 1200;

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const todosPrecios = await db.precioMTOP.findMany();
  const resolverPrecioExistente = (desc: string) =>
    todosPrecios.find((p) => p.descripcion.toLowerCase().includes(desc.toLowerCase()) && p.codigo !== "MAT-CARPMET-ACCESORIOS-MOTOR")?.precioUnitario ?? 0;

  for (const def of DEFS) {
    const s = await db.subrubroEstandar.findFirst({
      where: { codigo: def.codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true } } },
    });
    if (!s || !s.apuEstandar) {
      console.error(`${def.codigo}: no encontrado — abortando.`);
      continue;
    }

    const materialPrecio = Math.round(def.materialPrecio * 100) / 100;
    let sumMat = 0;
    console.log(`\n${def.codigo} — ${s.descripcion}`);

    for (const m of s.apuEstandar.materiales) {
      if (m.descripcion.toLowerCase() === def.materialDescripcion.toLowerCase()) {
        sumMat += m.rendimiento * materialPrecio;
        console.log(`  material: ${def.materialDescripcion} — $${materialPrecio}/${def.materialUnidad} (${def.materialCodigoMTOP}) × rend ${m.rendimiento}`);
        continue;
      }
      let precio = resolverPrecioExistente(m.descripcion);
      if (precio === 0 && m.descripcion.toLowerCase().includes("accesorios instalación motor portón")) {
        precio = ACCESORIOS_MOTOR_BATIENTE_PRECIO;
        console.log(`  material: ${m.descripcion} (batiente) — $${precio}/${m.unidad} (⚠️ separado del PrecioMTOP de corredizo, mismo valor de referencia)`);
      } else {
        console.log(`  material: ${m.descripcion} — $${precio}/${m.unidad} (ya real, sin cambios)`);
      }
      sumMat += m.rendimiento * precio;
    }

    const sumMO = s.apuEstandar.manoObra.reduce((acc, mo) => {
      const jornal = jornalPorNombre(mo.categoria);
      console.log(`  MO: ${mo.categoria} — rendimiento ${mo.rendimiento} U/jornada (sin cambios)`);
      return acc + jornal / mo.rendimiento;
    }, 0);

    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`  precioUY actual: $${s.precioUY} (fechaBase ${s.fechaBase}) → NUEVO: $${precioUY}`);

    if (!aplicar) continue;

    await db.precioMTOP.upsert({
      where: { codigo: def.materialCodigoMTOP },
      create: {
        codigo: def.materialCodigoMTOP,
        descripcion: def.materialDescripcion,
        cantidadUnidad: `1 ${def.materialUnidad}`,
        unidad: def.materialUnidad,
        cantidad: 1,
        precioConIva: materialPrecio,
        precioUnitario: materialPrecio,
        numeroLista: 0,
        fechaLista: FECHA,
      },
      update: { precioUnitario: materialPrecio, precioConIva: materialPrecio },
    });

    const tieneAccesoriosMotor = s.apuEstandar.materiales.some((m) => m.descripcion.toLowerCase().includes("accesorios instalación motor portón"));
    if (tieneAccesoriosMotor) {
      await db.precioMTOP.upsert({
        where: { codigo: "MAT-CARPMET-ACCESORIOS-MOTOR-BATIENTE" },
        create: {
          codigo: "MAT-CARPMET-ACCESORIOS-MOTOR-BATIENTE",
          descripcion: "Accesorios instalación motor portón batiente",
          cantidadUnidad: "1 gl",
          unidad: "gl",
          cantidad: 1,
          precioConIva: ACCESORIOS_MOTOR_BATIENTE_PRECIO,
          precioUnitario: ACCESORIOS_MOTOR_BATIENTE_PRECIO,
          numeroLista: 0,
          fechaLista: FECHA,
        },
        update: { precioUnitario: ACCESORIOS_MOTOR_BATIENTE_PRECIO, precioConIva: ACCESORIOS_MOTOR_BATIENTE_PRECIO },
      });
      // Renombrar el material del APU para que matchee su propio PrecioMTOP y no el de corredizo
      const accesorioMaterial = s.apuEstandar.materiales.find((m) => m.descripcion.toLowerCase().includes("accesorios instalación motor portón"));
      if (accesorioMaterial) {
        await db.materialAPUEstandar.update({
          where: { id: accesorioMaterial.id },
          data: { descripcion: "Accesorios instalación motor portón batiente" },
        });
      }
    }

    await db.subrubroEstandar.update({ where: { codigo: def.codigo }, data: { precioUY, fechaBase: FECHA } });
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
