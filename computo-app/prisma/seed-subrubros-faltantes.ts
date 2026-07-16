import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { crearSubrubroEstandar } from "@/lib/subrubroEstandar";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

const FECHA_BASE = "2025-06";
const ORIGEN = "manual";

interface NuevoSubrubro {
  codigo: string;
  capitulo: string;
  descripcion: string;
  unidad: string;
}

const SUBRUBROS: NuevoSubrubro[] = [
  // Cubierta / Techos
  { codigo: "cubierta-001", capitulo: "Cubierta / Techos", descripcion: "Cubierta de teja colonial sobre estructura de madera", unidad: "M2" },
  { codigo: "cubierta-002", capitulo: "Cubierta / Techos", descripcion: "Cubierta de teja colonial sobre losa", unidad: "M2" },
  { codigo: "cubierta-003", capitulo: "Cubierta / Techos", descripcion: "Cubierta de teja francesa sobre estructura de madera", unidad: "M2" },
  { codigo: "cubierta-004", capitulo: "Cubierta / Techos", descripcion: "Cubierta de chapa galvanizada acanalada", unidad: "M2" },
  { codigo: "cubierta-005", capitulo: "Cubierta / Techos", descripcion: "Cubierta de chapa galvanizada trapezoidal", unidad: "M2" },
  { codigo: "cubierta-006", capitulo: "Cubierta / Techos", descripcion: "Cubierta de chapa prepintada", unidad: "M2" },
  { codigo: "cubierta-007", capitulo: "Cubierta / Techos", descripcion: "Cubierta de policarbonato alveolar", unidad: "M2" },
  { codigo: "cubierta-008", capitulo: "Cubierta / Techos", descripcion: "Cubierta de isopanel", unidad: "M2" },
  { codigo: "cubierta-009", capitulo: "Cubierta / Techos", descripcion: "Membrana asfáltica sobre losa", unidad: "M2" },
  { codigo: "cubierta-010", capitulo: "Cubierta / Techos", descripcion: "Estructura de madera para techo (pares, cumbreras, correas)", unidad: "M2" },
  { codigo: "cubierta-011", capitulo: "Cubierta / Techos", descripcion: "Canaleta de zinc desarrollado 50cm", unidad: "ML" },
  { codigo: "cubierta-012", capitulo: "Cubierta / Techos", descripcion: "Bajada pluvial de PVC ø110mm", unidad: "ML" },

  // Instalación Sanitaria
  { codigo: "sanitaria-001", capitulo: "Instalación Sanitaria", descripcion: "Cañería de agua fría PVC ø20mm", unidad: "ML" },
  { codigo: "sanitaria-002", capitulo: "Instalación Sanitaria", descripcion: "Cañería de agua fría termofusión PPR ø20mm", unidad: "ML" },
  { codigo: "sanitaria-003", capitulo: "Instalación Sanitaria", descripcion: "Cañería de agua caliente termofusión PPR ø20mm", unidad: "ML" },
  { codigo: "sanitaria-004", capitulo: "Instalación Sanitaria", descripcion: "Cañería de acero galvanizado ø1/2\"", unidad: "ML" },
  { codigo: "sanitaria-005", capitulo: "Instalación Sanitaria", descripcion: "Cañería de acero galvanizado ø3/4\"", unidad: "ML" },
  { codigo: "sanitaria-006", capitulo: "Instalación Sanitaria", descripcion: "Cañería de desagüe PVC ø110mm", unidad: "ML" },
  { codigo: "sanitaria-007", capitulo: "Instalación Sanitaria", descripcion: "Cañería de desagüe PVC ø50mm", unidad: "ML" },
  { codigo: "sanitaria-008", capitulo: "Instalación Sanitaria", descripcion: "Inodoro con mochila instalado", unidad: "U" },
  { codigo: "sanitaria-009", capitulo: "Instalación Sanitaria", descripcion: "Inodoro sin mochila con cisterna embutida", unidad: "U" },
  { codigo: "sanitaria-010", capitulo: "Instalación Sanitaria", descripcion: "Inodoro sin mochila con cisterna de sobreponer", unidad: "U" },
  { codigo: "sanitaria-011", capitulo: "Instalación Sanitaria", descripcion: "Lavatorio instalado con grifería monocomando", unidad: "U" },
  { codigo: "sanitaria-012", capitulo: "Instalación Sanitaria", descripcion: "Ducha con grifería monocomando", unidad: "U" },
  { codigo: "sanitaria-013", capitulo: "Instalación Sanitaria", descripcion: "Bañera instalada con grifería", unidad: "U" },
  { codigo: "sanitaria-014", capitulo: "Instalación Sanitaria", descripcion: "Cámara de inspección 60x60cm con sifón desconector", unidad: "U" },
  { codigo: "sanitaria-015", capitulo: "Instalación Sanitaria", descripcion: "Cámara de inspección 60x60cm sin sifón", unidad: "U" },
  { codigo: "sanitaria-016", capitulo: "Instalación Sanitaria", descripcion: "Bomba eléctrica de agua 1HP", unidad: "U" },
  { codigo: "sanitaria-017", capitulo: "Instalación Sanitaria", descripcion: "Bomba eléctrica de agua 2HP", unidad: "U" },
  { codigo: "sanitaria-018", capitulo: "Instalación Sanitaria", descripcion: "Tanque de agua 500L", unidad: "U" },
  { codigo: "sanitaria-019", capitulo: "Instalación Sanitaria", descripcion: "Calefón a gas 10L", unidad: "U" },
  { codigo: "sanitaria-020", capitulo: "Instalación Sanitaria", descripcion: "Calefón eléctrico 50L", unidad: "U" },

  // Instalación Eléctrica
  { codigo: "electrica-001", capitulo: "Instalación Eléctrica", descripcion: "Puesta eléctrica completa (toma + interruptor)", unidad: "U" },
  { codigo: "electrica-002", capitulo: "Instalación Eléctrica", descripcion: "Tablero eléctrico 12 circuitos", unidad: "U" },
  { codigo: "electrica-003", capitulo: "Instalación Eléctrica", descripcion: "Tablero eléctrico 24 circuitos", unidad: "U" },
  { codigo: "electrica-004", capitulo: "Instalación Eléctrica", descripcion: "Cañería eléctrica embutida ø20mm", unidad: "ML" },
  { codigo: "electrica-005", capitulo: "Instalación Eléctrica", descripcion: "Luminaria embutida LED", unidad: "U" },
  { codigo: "electrica-006", capitulo: "Instalación Eléctrica", descripcion: "Luminaria colgante", unidad: "U" },
  { codigo: "electrica-007", capitulo: "Instalación Eléctrica", descripcion: "Sistema de alarma perimetral", unidad: "GL" },
  { codigo: "electrica-008", capitulo: "Instalación Eléctrica", descripcion: "Cámara de seguridad IP exterior", unidad: "U" },
  { codigo: "electrica-009", capitulo: "Instalación Eléctrica", descripcion: "Cámara de seguridad IP interior", unidad: "U" },
  { codigo: "electrica-010", capitulo: "Instalación Eléctrica", descripcion: "DVR/NVR 4 canales con instalación", unidad: "U" },
  { codigo: "electrica-011", capitulo: "Instalación Eléctrica", descripcion: "Portero eléctrico con videocámara", unidad: "U" },
  { codigo: "electrica-012", capitulo: "Instalación Eléctrica", descripcion: "Portero eléctrico simple", unidad: "U" },

  // Instalación Térmica / Aire Acondicionado
  { codigo: "termica-001", capitulo: "Instalación Térmica / Aire Acondicionado", descripcion: "Equipo split 9000 BTU con instalación", unidad: "U" },
  { codigo: "termica-002", capitulo: "Instalación Térmica / Aire Acondicionado", descripcion: "Equipo split 12000 BTU con instalación", unidad: "U" },
  { codigo: "termica-003", capitulo: "Instalación Térmica / Aire Acondicionado", descripcion: "Equipo split 18000 BTU con instalación", unidad: "U" },
  { codigo: "termica-004", capitulo: "Instalación Térmica / Aire Acondicionado", descripcion: "Equipo split 24000 BTU con instalación", unidad: "U" },
  { codigo: "termica-005", capitulo: "Instalación Térmica / Aire Acondicionado", descripcion: "Radiador de agua caliente", unidad: "U" },
  { codigo: "termica-006", capitulo: "Instalación Térmica / Aire Acondicionado", descripcion: "Caldera a gas para calefacción", unidad: "U" },
  { codigo: "termica-007", capitulo: "Instalación Térmica / Aire Acondicionado", descripcion: "Piso radiante eléctrico", unidad: "M2" },
  { codigo: "termica-008", capitulo: "Instalación Térmica / Aire Acondicionado", descripcion: "Piso radiante hidráulico", unidad: "M2" },
];

async function main() {
  console.log(`Insertando ${SUBRUBROS.length} subrubros...`);
  let creados = 0;
  let omitidos = 0;

  for (const s of SUBRUBROS) {
    const { creado } = await crearSubrubroEstandar(
      prisma,
      {
        codigo: s.codigo,
        capitulo: s.capitulo,
        descripcion: s.descripcion,
        unidad: s.unidad,
        precioUY: 0,
        fechaBase: FECHA_BASE,
        origen: ORIGEN,
        activo: true,
      },
      { skipIfExists: true }
    );
    if (!creado) {
      console.log(`  [omitido] ${s.codigo} ya existe`);
      omitidos++;
      continue;
    }
    console.log(`  [creado] ${s.codigo} — ${s.descripcion}`);
    creados++;
  }

  console.log(`\nListo. Creados: ${creados}, omitidos (ya existían): ${omitidos}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
