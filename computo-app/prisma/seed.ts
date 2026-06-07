import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const db = new PrismaClient({ adapter });

async function main() {
  // Si ya existe el proyecto con id fijo, no hacer nada
  const existe = await db.proyecto.findUnique({ where: { id: "1" } });
  if (existe) {
    console.log("✓ Seed ya aplicado — proyecto demo existe");
    return;
  }

  const proyecto = await db.proyecto.create({
    data: {
      id:        "1",
      nombre:    "Vivienda unifamiliar — Pocitos",
      cliente:   "Familia González",
      tipo:      "VIVIENDA",
      estado:    "EN_CURSO",
      moneda:    "USD",
      area:      120,
      direccion: "Bulevar España 2345, Montevideo",
      capitulos: {
        create: [
          {
            nombre: "Trabajos preliminares",
            codigo: "C01",
            orden:  0,
            rubros: {
              create: [
                { codigo: "R001", descripcion: "Limpieza de terreno", unidad: "m²", cantidad: 120, precioUnit: 8  },
                { codigo: "R002", descripcion: "Replanteo",           unidad: "m²", cantidad: 120, precioUnit: 5  },
                { codigo: "R003", descripcion: "Obrador provisorio",  unidad: "gl", cantidad: 1,   precioUnit: 0  },
              ],
            },
          },
          {
            nombre: "Movimiento de tierra y fundaciones",
            codigo: "C02",
            orden:  1,
            rubros: {
              create: [
                { codigo: "R004", descripcion: "Excavación manual",      unidad: "m³", cantidad: 45, precioUnit: 38  },
                { codigo: "R005", descripcion: "Fundación corrida H°A°", unidad: "m³", cantidad: 12, precioUnit: 420 },
                { codigo: "R006", descripcion: "Relleno y compactación", unidad: "m³", cantidad: 20, precioUnit: 22  },
              ],
            },
          },
          {
            nombre: "Estructura",
            codigo: "C03",
            orden:  2,
            rubros: {
              create: [
                { codigo: "R007", descripcion: "Pilar sección 25×25 cm", unidad: "ml", cantidad: 48, precioUnit: 185 },
                { codigo: "R008", descripcion: "Viga de arriostre",       unidad: "ml", cantidad: 62, precioUnit: 95  },
                { codigo: "R009", descripcion: "Losa maciza e=12 cm",    unidad: "m²", cantidad: 95, precioUnit: 210 },
              ],
            },
          },
          { nombre: "Mampostería y muros",        codigo: "C04", orden: 3  },
          { nombre: "Cubierta",                   codigo: "C05", orden: 4  },
          { nombre: "Revoques y enlucidos",        codigo: "C06", orden: 5  },
          { nombre: "Revestimientos y pisos",      codigo: "C07", orden: 6  },
          { nombre: "Carpintería",                 codigo: "C08", orden: 7  },
          { nombre: "Instalación sanitaria",       codigo: "C09", orden: 8  },
          { nombre: "Instalación eléctrica",       codigo: "C10", orden: 9  },
          { nombre: "Instalación de gas",          codigo: "C11", orden: 10 },
          { nombre: "Instalaciones embutidas",     codigo: "C12", orden: 11 },
          { nombre: "Calefacción",                 codigo: "C13", orden: 12 },
          { nombre: "Pintura",                     codigo: "C14", orden: 13 },
          { nombre: "Vidriería",                   codigo: "C15", orden: 14 },
          { nombre: "Herrería y metálica",         codigo: "C16", orden: 15 },
          { nombre: "Obras exteriores y paisajismo", codigo: "C17", orden: 16 },
          { nombre: "Honorarios profesionales",    codigo: "C18", orden: 17 },
          { nombre: "Imprevistos",                 codigo: "C19", orden: 18 },
        ],
      },
    },
    include: { capitulos: { include: { rubros: true } } },
  });

  console.log(`✓ Proyecto demo creado: ${proyecto.id}`);
  console.log(`  Capítulos: ${proyecto.capitulos.length}`);
  const totalRubros = proyecto.capitulos.reduce((s, c) => s + c.rubros.length, 0);
  console.log(`  Rubros: ${totalRubros}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
