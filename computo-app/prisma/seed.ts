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
    },
  });

  const titulo = await db.titulo.create({
    data: { proyectoId: proyecto.id, nombre: proyecto.nombre, orden: 0 },
  });

  await db.capitulo.createMany({
    data: [
      { nombre: "Trabajos preliminares",            codigo: "C01", orden: 0,  proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Movimiento de tierra y fundaciones", codigo: "C02", orden: 1,  proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Estructura",                        codigo: "C03", orden: 2,  proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Mampostería y muros",                codigo: "C04", orden: 3,  proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Cubierta",                           codigo: "C05", orden: 4,  proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Revoques y enlucidos",               codigo: "C06", orden: 5,  proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Revestimientos y pisos",             codigo: "C07", orden: 6,  proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Carpintería",                        codigo: "C08", orden: 7,  proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Instalación sanitaria",              codigo: "C09", orden: 8,  proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Instalación eléctrica",              codigo: "C10", orden: 9,  proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Instalación de gas",                 codigo: "C11", orden: 10, proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Instalaciones embutidas",            codigo: "C12", orden: 11, proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Calefacción",                        codigo: "C13", orden: 12, proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Pintura",                            codigo: "C14", orden: 13, proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Vidriería",                          codigo: "C15", orden: 14, proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Herrería y metálica",                codigo: "C16", orden: 15, proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Obras exteriores y paisajismo",      codigo: "C17", orden: 16, proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Honorarios profesionales",           codigo: "C18", orden: 17, proyectoId: proyecto.id, tituloId: titulo.id },
      { nombre: "Imprevistos",                        codigo: "C19", orden: 18, proyectoId: proyecto.id, tituloId: titulo.id },
    ],
  });

  const cap01 = await db.capitulo.findFirstOrThrow({ where: { proyectoId: proyecto.id, codigo: "C01" } });
  const cap02 = await db.capitulo.findFirstOrThrow({ where: { proyectoId: proyecto.id, codigo: "C02" } });
  const cap03 = await db.capitulo.findFirstOrThrow({ where: { proyectoId: proyecto.id, codigo: "C03" } });

  await db.rubro.createMany({
    data: [
      { capituloId: cap01.id, codigo: "R001", descripcion: "Limpieza de terreno", unidad: "m²", cantidad: 120, precioUnit: 8   },
      { capituloId: cap01.id, codigo: "R002", descripcion: "Replanteo",           unidad: "m²", cantidad: 120, precioUnit: 5   },
      { capituloId: cap01.id, codigo: "R003", descripcion: "Obrador provisorio",  unidad: "gl", cantidad: 1,   precioUnit: 0   },
      { capituloId: cap02.id, codigo: "R004", descripcion: "Excavación manual",      unidad: "m³", cantidad: 45, precioUnit: 38  },
      { capituloId: cap02.id, codigo: "R005", descripcion: "Fundación corrida H°A°", unidad: "m³", cantidad: 12, precioUnit: 420 },
      { capituloId: cap02.id, codigo: "R006", descripcion: "Relleno y compactación", unidad: "m³", cantidad: 20, precioUnit: 22  },
      { capituloId: cap03.id, codigo: "R007", descripcion: "Pilar sección 25×25 cm", unidad: "ml", cantidad: 48, precioUnit: 185 },
      { capituloId: cap03.id, codigo: "R008", descripcion: "Viga de arriostre",       unidad: "ml", cantidad: 62, precioUnit: 95  },
      { capituloId: cap03.id, codigo: "R009", descripcion: "Losa maciza e=12 cm",    unidad: "m²", cantidad: 95, precioUnit: 210 },
    ],
  });

  const totalCapitulos = await db.capitulo.count({ where: { proyectoId: proyecto.id } });
  const totalRubros = await db.rubro.count({ where: { capitulo: { proyectoId: proyecto.id } } });
  console.log(`✓ Proyecto demo creado: ${proyecto.id}`);
  console.log(`  Capítulos: ${totalCapitulos}`);
  console.log(`  Rubros: ${totalRubros}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
