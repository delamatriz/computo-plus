// Borra materiales duplicados de UN APU puntual: filas de MaterialAPU con el
// mismo orden, descripción, unidad, rendimiento y precio que otra del mismo
// APU. Se queda la de id más chico; las demás se borran (con sus componentes).
//
// Origen (oct-2026): "REPLANTEO GRAL DE OBRA" de EDIFICIO TORRE SIGLO XXI
// quedó con "Estacas de madera" e "Hilo de nylon" repetidos por dos clonados
// simultáneos desde la biblioteca (clonarApuAlRubro sin transacción, ya
// corregido). Era el único APU de la base con filas repetidas.
//
// Uso (dry-run por defecto, --apply para escribir):
//   npx tsx --env-file=.env.local scripts/borrar-materiales-duplicados-apu.ts <apuId>
//   npx tsx --env-file=.env.local scripts/borrar-materiales-duplicados-apu.ts <apuId> --apply
// Idempotente: una segunda corrida ya no encuentra duplicados y no hace nada.
import { db } from "@/lib/db";

async function main() {
  const apuId = process.argv[2];
  const aplicar = process.argv.includes("--apply");
  if (!apuId || apuId.startsWith("--")) throw new Error("Falta el apuId como primer argumento.");

  const apu = await db.aPU.findUnique({
    where: { id: apuId },
    select: {
      id: true,
      rubro: { select: { descripcion: true, capitulo: { select: { proyecto: { select: { nombre: true } } } } } },
      materiales: { orderBy: { id: "asc" }, include: { componentes: true } },
    },
  });
  if (!apu) throw new Error(`No existe el APU ${apuId}.`);
  console.log(`APU ${apu.id} — ${apu.rubro.capitulo.proyecto.nombre} / ${apu.rubro.descripcion}`);
  console.log(`Materiales hoy: ${apu.materiales.length}`);

  const vistos = new Map<string, string>();
  const aBorrar: typeof apu.materiales = [];
  for (const m of apu.materiales) {
    const clave = JSON.stringify([m.orden, m.descripcion, m.unidad, m.rendimiento, m.precioUnit]);
    if (vistos.has(clave)) aBorrar.push(m);
    else vistos.set(clave, m.id);
  }

  if (aBorrar.length === 0) {
    console.log("Sin duplicados — nada que hacer.");
    return;
  }
  for (const m of aBorrar) {
    const clave = JSON.stringify([m.orden, m.descripcion, m.unidad, m.rendimiento, m.precioUnit]);
    console.log(`  borrar ${m.id} "${m.descripcion}" (duplicado de ${vistos.get(clave)}), componentes: ${m.componentes.length}`);
  }
  // Respaldo de lo que se borra, por si hay que restaurarlo a mano.
  console.log("Respaldo JSON:", JSON.stringify(aBorrar));

  if (!aplicar) {
    console.log(`\nDRY-RUN — quedarían ${apu.materiales.length - aBorrar.length} materiales. Correr con --apply para borrar.`);
    return;
  }
  // Un solo deleteMany (atómico de por sí): los componentes se borran en
  // cascada (ComponenteAPU.material onDelete: Cascade). Con $transaction de
  // dos pasos, contra la base remota pasaba el timeout de 5 s y se revertía.
  const ids = aBorrar.map((m) => m.id);
  const { count } = await db.materialAPU.deleteMany({ where: { id: { in: ids }, apuId } });
  console.log(`Borradas: ${count}`);
  const quedan = await db.materialAPU.findMany({ where: { apuId }, orderBy: { orden: "asc" }, select: { descripcion: true } });
  console.log(`\nAPLICADO — quedan ${quedan.length}: ${quedan.map((q) => q.descripcion).join(", ")}`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
