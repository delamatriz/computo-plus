// OBSOLETO — NO EJECUTAR.
//
// Este script cargó en su momento los capítulos estándar 21-30 de la Lista
// estándar del wizard (CapituloEstandar). Quedó reemplazado por
// scripts/seed-capitulos-estandar-orden-2026-10.ts, que define el orden
// completo y vigente (31 capítulos, sin huecos) y ELIMINA 4 capítulos que
// este script creaba: Honorarios Profesionales, Derechos de Construcción y
// Permisos, Conexiones de Servicios y Gastos Generales de Obra (cáscaras
// sin Biblioteca; esos conceptos viven en Gastos Generales Detallado).
//
// Correrlo de nuevo los resucitaría y pisaría las posiciones 21-30 del
// orden nuevo, por eso el cuerpo se reemplazó por un corte explícito en vez
// de dejar la lista vieja ejecutable. Historia completa en git
// (antes de este cambio el script hacía upsert de los 10 capítulos).

console.error(
  "seed-capitulos-nuevos.ts está obsoleto y no hace nada.\n" +
    "Usar scripts/seed-capitulos-estandar-orden-2026-10.ts (dry-run por defecto, --apply para escribir)."
);
process.exit(1);
