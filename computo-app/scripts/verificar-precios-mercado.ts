// FEAT-AI-006, etapa 3 — job de verificación periódica de precios de
// mercado libre (script manual; también disponible como botón "Buscar
// precios actualizados" en Configuración → Actualización de datos, ver
// SeccionActualizacionDatos.tsx — misma lógica de decisión para los dos,
// vive en src/lib/verificarPrecioMercado.ts).
//
// ALCANCE de esta primera versión: SOLO los registros de "retail
// directo" — proveedor poblado, motivoVerificacion NULL,
// requiereVerificacion=false (~116 códigos). Los marcados como
// "derivado_recalculo_proporcional", "derivado_modelo_regresion" y
// "tarifa_oficial_organismo" quedan fuera a propósito — necesitan
// lógica de re-verificación distinta (recálculo proporcional desde un
// material ancla, o consulta al sitio del organismo en vez de
// búsqueda web genérica), a sumar en una fase 3b futura.
//
// Modo dry-run (default): consulta y muestra qué haría, no escribe nada
// (igual gasta la llamada a la IA — no hay forma más barata de probar el
// resultado sin consultarla). Modo --apply: escribe en base. Flag
// --sample=N: limita a los primeros N registros elegibles (para pruebas
// controladas antes de correr contra todos).
//
// Ejecutar (prueba chica, dry-run):
//   npx tsx scripts/verificar-precios-mercado.ts --sample=8
// Ejecutar (real, contra todos los elegibles):
//   npx tsx scripts/verificar-precios-mercado.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

async function main() {
  // lib/verificarPrecioMercado.ts importa "@/lib/db" (el singleton de la
  // app, pensado para Next) — acá en el script usamos nuestra propia
  // instancia de Prisma para listar los elegibles (mismo patrón que el
  // resto de los scripts de esta carpeta), pero delegamos el verificar +
  // escribir de cada ítem a la función compartida.
  const { verificarPrecioMTOP } = await import("../src/lib/verificarPrecioMercado");

  const aplicar = process.argv.includes("--apply");
  const sampleArg = process.argv.find((a) => a.startsWith("--sample="));
  const sample = sampleArg ? parseInt(sampleArg.split("=")[1], 10) : null;

  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}`);

  const elegibles = await db.precioMTOP.findMany({
    where: { proveedor: { not: null }, motivoVerificacion: null, requiereVerificacion: false },
    orderBy: { codigo: "asc" },
    select: { codigo: true, descripcion: true, proveedor: true, precioUnitario: true, unidad: true },
  });

  console.log(`Total elegibles (retail directo, sin marcador): ${elegibles.length} (esperado ~116)\n`);

  const aProcesar = sample != null ? elegibles.slice(0, sample) : elegibles;
  console.log(`A procesar en esta corrida: ${aProcesar.length}\n`);

  let actualizadosAuto = 0;
  let variacionAlta = 0;
  let noEncontrados = 0;
  let errores = 0;

  for (const item of aProcesar) {
    console.log(`\n── ${item.codigo} — ${item.descripcion} ──`);
    console.log(`   Proveedor: ${item.proveedor}`);
    console.log(`   Precio guardado: $${item.precioUnitario}/${item.unidad}`);

    const resultado = await verificarPrecioMTOP(item.codigo, aplicar);

    switch (resultado.accion) {
      case "error":
        console.log(`   ⚠ ${resultado.detalle}`);
        errores++;
        break;
      case "no_encontrado":
        console.log(`   → NO ENCONTRADO: ${resultado.detalle}`);
        noEncontrados++;
        break;
      case "actualizado":
        console.log(`   ✓ $${resultado.precioAnterior} → $${resultado.precioNuevo} (${resultado.variacionPct?.toFixed(1)}%) — dentro del umbral, actualizado`);
        actualizadosAuto++;
        break;
      case "variacion_alta":
        console.log(`   ⚠ $${resultado.precioAnterior} → $${resultado.precioNuevo} (${resultado.variacionPct?.toFixed(1)}%) — supera el umbral, requiere verificación humana`);
        variacionAlta++;
        break;
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Procesados:                 ${aProcesar.length}`);
  console.log(`Actualizados automático:    ${actualizadosAuto}`);
  console.log(`Variación alta (revisión):  ${variacionAlta}`);
  console.log(`No encontrados (revisión):  ${noEncontrados}`);
  console.log(`Errores de consulta:        ${errores}`);
  console.log(aplicar ? "\nAplicado." : "\nDry-run — nada se escribió.");

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
