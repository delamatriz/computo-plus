// Recalcula Rubro.precioUnit desde su APU actual, con la misma fórmula que
// clonarApuAlRubro (costoDirectoUnitario + calcularPrecioUnitario). Para
// rubros cuyo precio guardado quedó desfasado del APU por un problema de datos
// — no para el día a día: ahí está el botón "APU modificado" del panel.
//
// Origen (oct-2026): "REPLANTEO GRAL DE OBRA" de EDIFICIO TORRE SIGLO XXI
// quedó con el precio calculado sobre materiales duplicados (ver
// borrar-materiales-duplicados-apu.ts).
//
// Uso (dry-run por defecto, --apply para escribir):
//   npx tsx --env-file=.env.local scripts/recalcular-precio-rubro.ts <rubroId>
//   npx tsx --env-file=.env.local scripts/recalcular-precio-rubro.ts <rubroId> --apply
// No toca presupuestos FINALIZADO (precios congelados). Idempotente: si el
// precio ya coincide con el APU, no escribe nada.
import { db } from "@/lib/db";
import { calcularPrecioUnitario, redondearPrecio } from "@/lib/apu-calc";
import { costoDirectoUnitario } from "@/lib/costoAgregado";

async function main() {
  const rubroId = process.argv[2];
  const aplicar = process.argv.includes("--apply");
  if (!rubroId || rubroId.startsWith("--")) throw new Error("Falta el rubroId como primer argumento.");

  const rubro = await db.rubro.findUnique({
    where: { id: rubroId },
    select: {
      descripcion: true,
      cantidad: true,
      unidad: true,
      precioUnit: true,
      capitulo: { select: { proyecto: { select: { nombre: true, estado: true } } } },
      apu: { include: { materiales: true, manoObra: true, equipos: true } },
    },
  });
  if (!rubro) throw new Error(`No existe el rubro ${rubroId}.`);
  if (!rubro.apu) throw new Error("El rubro no tiene APU: no hay de dónde recalcular.");
  const proyecto = rubro.capitulo.proyecto;
  console.log(`Rubro ${rubroId} — ${proyecto.nombre} / ${rubro.descripcion} (${proyecto.estado})`);
  if (proyecto.estado === "FINALIZADO") throw new Error("Presupuesto FINALIZADO: los precios están congelados, no se toca.");

  const costoDirecto = costoDirectoUnitario(rubro.apu);
  const nuevo = redondearPrecio(calcularPrecioUnitario(costoDirecto, rubro.apu.utilidadPct));
  const actual = rubro.precioUnit ?? 0;
  const cantidad = rubro.cantidad ?? 0;
  console.log(`  APU: ${rubro.apu.materiales.length} materiales, ${rubro.apu.manoObra.length} MO, ${rubro.apu.equipos.length} equipos`);
  console.log(`  Costo directo: ${costoDirecto} | Utilidad: ${rubro.apu.utilidadPct}%`);
  console.log(`  precioUnit guardado: ${actual} → recalculado: ${nuevo} (por ${rubro.unidad})`);
  console.log(`  Total del rubro (${cantidad} ${rubro.unidad}): ${redondearPrecio(actual * cantidad)} → ${redondearPrecio(nuevo * cantidad)}`);

  if (nuevo === actual) {
    console.log("Ya coincide con el APU — nada que hacer.");
    return;
  }
  if (!aplicar) {
    console.log("\nDRY-RUN — no se escribió nada. Correr con --apply para guardar el precio recalculado.");
    return;
  }
  await db.rubro.update({ where: { id: rubroId }, data: { precioUnit: nuevo } });
  const verif = await db.rubro.findUnique({ where: { id: rubroId }, select: { precioUnit: true } });
  console.log(`\nAPLICADO — precioUnit ahora: ${verif?.precioUnit}`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
