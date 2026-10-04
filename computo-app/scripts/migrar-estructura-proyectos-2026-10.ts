// Migración ESTRUCTURAL de los proyectos existentes a la nueva organización de
// capítulos (oct-2026). Solo mueve rubros de capítulo y crea/borra capítulos:
// NINGÚN precio, APU, cantidad ni dato de un rubro cambia (solo capituloId, el
// código R### dentro del capítulo nuevo y, para ubicarlos al final, createdAt,
// que es lo que ordena los rubros dentro de un capítulo).
//
// Qué hace, POR TÍTULO (la estructura vive en cada Título):
//  1. "Seguridad y Trabajos en Altura": sus rubros pasan al final de
//     "Implantación y Replanteo" del mismo título y el capítulo, ya vacío, se
//     borra. Un capítulo Seguridad que ya está vacío se borra igual.
//  2. "SANEADO DE REVOQUES Y HORMIGONES EN FACHADA" que esté en Albañilería
//     pasa a "Demoliciones y Picados".
//  3. "Hidrolavado de superficies…" que esté en "Impermeabilizaciones y
//     Aislaciones" pasa a Albañilería (queda el de Albañilería › Patología de
//     Fachada). El de un proyecto que ya está en Albañilería no se toca. No hay
//     rubros duplicados dentro de ningún proyecto: no se borra ninguno.
//  Si el título no tiene el capítulo destino, se CREA (vínculo al catálogo, color
//  de la Lista estándar, en el orden de la Lista estándar, sin tocar el orden de
//  los capítulos existentes). Un capítulo que queda vacío por el movimiento
//  (p. ej. Albañilería) se conserva; solo se borran los Seguridad vacíos.
//  NO se renumeran los códigos ni el orden de los capítulos existentes. Un
//  capítulo duplicado, vacío y con una orden de compra (HOGAR, 2.2) no se toca.
//
// Verificación (por proyecto, también después del --apply, releyendo la base):
//  · Costo Directo, Costo Total y Precio Final idénticos al centavo (mismas
//    funciones puras que la pantalla, el PDF, el contrato y la liquidación;
//    incluye proyectos con contrato/certificaciones, que el script de aportes
//    saltea).
//  · Cada rubro: todas las columnas idénticas salvo capituloId, codigo,
//    createdAt y updatedAt; APU, materiales, mano de obra y equipos idénticos.
//  · TODAS las tablas del proyecto y sus hijas (contrato, certificaciones y sus
//    ítems, órdenes de compra, Control de Costos, liquidación final,
//    mediciones, bitácora, cotizaciones, etc.): mismas filas antes y después.
//  · Un capítulo solo se borra si ninguna otra tabla lo referencia.
//
// Seguridad: dry-run por defecto; --apply exige --respaldo=<archivo.json>, donde
// se guardan los ids y valores originales (rubros movidos, capítulos creados y
// capítulos borrados completos) para poder REVERTIR con --revertir=<archivo>.
// Una transacción por proyecto (timeout 120 s); si algo falla se revierte solo
// ese proyecto. Idempotente: sin nada para mover, 0 cambios.
//
// Ejecutar (dry-run):  npx tsx scripts/migrar-estructura-proyectos-2026-10.ts
// Un solo proyecto:    ... --proyecto=<id>     Excluir por nombre: ... --excluir="HOGAR"
// Ejecutar (real):     ... --apply --respaldo=C:/ruta/respaldo.json   (solo con el OK de Luis)
// Revertir:            ... --revertir=C:/ruta/respaldo.json [--apply]

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import fs from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  calcularCostoDirectoAgregado,
  calcularCostosIndirectosAgregados,
  calcularCostosIndirectosExento,
  calcularUtilidadAgregada,
  type ApuParaCosto,
} from "../src/lib/costoAgregado";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const SEG = "Seguridad y Trabajos en Altura";
const IMPL = "Implantación y Replanteo";
const DEMO = "Demoliciones y Picados";
const ALB = "Albañilería";
const IMPERM = "Impermeabilizaciones y Aislaciones";
// Nombre del capítulo en el catálogo (CapituloCatalogo) cuando difiere del de proyecto.
const CATALOGO_DE: Record<string, string> = { [IMPL]: IMPL, [DEMO]: "Demoliciones", [ALB]: ALB };
const COLOR_DE: Record<string, string> = { [IMPL]: "#94A3B8", [DEMO]: "#DC2626" };
const RE_SANEADO = /^\s*SANEADO DE REVOQUES Y HORMIGONES EN FACHADA/i;
const RE_HIDRO = /^\s*Hidrolavado de superficies/i;

const norm = (s: string) => s.trim().toLowerCase();
const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const argVal = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);

// ── tipos ──
type Cap = {
  id: string; nombre: string; codigo: string; color: string; orden: number; fechaInicio: Date | null; fechaFin: Date | null;
  proyectoId: string; tituloId: string; capituloCatalogoId: string | null; createdAt: Date; updatedAt: Date;
  rubros: { id: string; codigo: string; descripcion: string; cantidad: number; precioUnit: number; createdAt: Date; apu: ApuFila | null }[];
};
type ApuFila = { materiales: { rendimiento: number; precioUnit: number }[]; manoObra: { rendimiento: number; jornalRef: number; equipoRelacionadoId: string | null }[]; equipos: { id: string; rendimiento: number; costoUnit: number; costoUnitPropio: number | null; modoCosteo: string | null }[]; aportesPatronalesPct: number; utilidadPct: number };
type Movimiento = { rubroId: string; descripcion: string; cantidad: number; precioUnit: number; desdeCapId: string; desdeNombre: string; haciaCapId: string; haciaNombre: string; codigoViejo: string; codigoNuevo: string; createdAtViejo: Date; createdAtNuevo: Date; duplicadoEnDestino: boolean };
type CapNuevo = { tmpId: string; nombre: string; catalogoId: string | null; color: string; orden: number; codigo: string; tituloId: string };
type PlanTitulo = { tituloId: string; tituloNombre: string; creados: CapNuevo[]; movimientos: Movimiento[]; borrar: Cap[]; avisos: string[]; vaciosPorMovimiento: string[] };

async function main() {
  const aplicar = process.argv.includes("--apply");
  const revertir = argVal("revertir");
  if (revertir) return revertirDesde(revertir, aplicar);
  const respaldo = argVal("respaldo");
  if (aplicar && !respaldo) throw new Error("--apply exige --respaldo=<archivo.json> (ahí se guardan los ids para revertir)");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const soloProyecto = argVal("proyecto");
  const excluir = (argVal("excluir") ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

  // ── catálogo y Lista estándar ──
  const catalogo = await db.capituloCatalogo.findMany({ select: { id: true, nombre: true } });
  const catId = (nombreProyecto: string) => catalogo.find((c) => c.nombre === (CATALOGO_DE[nombreProyecto] ?? nombreProyecto))?.id ?? null;
  const lista = await db.capituloEstandar.findMany({ where: { origen: "estandar" } });
  const rankLista = (nombre: string) => lista.find((l) => norm(l.nombre) === norm(nombre))?.orden ?? 999;

  // Tablas que referencian Capitulo (para no borrar un capítulo con vínculos) y
  // tablas con proyectoId / que referencian Rubro (para la verificación).
  const fks = (await db.$queryRawUnsafe(
    `select tc.table_name t, kcu.column_name c, ccu.table_name ref from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
     join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema
     where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'`
  )) as { t: string; c: string; ref: string }[];
  const refsACapitulo = fks.filter((f) => f.ref === "Capitulo" && f.t !== "Rubro");
  const tablasProyecto = ((await db.$queryRawUnsafe(`select table_name t from information_schema.columns where column_name='proyectoId' and table_schema='public'`)) as { t: string }[])
    .map((x) => x.t).filter((t) => t !== "Capitulo" && t !== "Titulo" && t !== "Proyecto");
  const tablasRubro = fks.filter((f) => f.ref === "Rubro" && f.t !== "APU");

  const proyectos = await db.proyecto.findMany({
    where: soloProyecto ? { id: soloProyecto } : undefined,
    orderBy: { nombre: "asc" },
    include: {
      titulos: { orderBy: { orden: "asc" } },
      capitulos: {
        orderBy: { orden: "asc" },
        include: { rubros: { orderBy: { createdAt: "asc" }, include: { apu: { include: { materiales: true, manoObra: true, equipos: true } } } } },
      },
    },
  });

  // presupuestado = Σ cantidad × precio de los rubros (lo que muestra Control de Costos como total del proyecto).
  type Totales = { cd: number; costoTotal: number; precioFinal: number; presupuestado: number };
  const totalesDe = (p: (typeof proyectos)[number], caps: Cap[]): Totales => {
    const rubros = caps.flatMap((c) => c.rubros);
    const apuData: Record<string, ApuParaCosto> = {};
    for (const r of rubros) if (r.apu) apuData[r.id] = { materiales: r.apu.materiales, manoObra: r.apu.manoObra, equipos: r.apu.equipos, aportesPatronalesPct: r.apu.aportesPatronalesPct, utilidadPct: r.apu.utilidadPct };
    const cs = [{ rubros: rubros.map((r) => ({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit })) }];
    const cd = calcularCostoDirectoAgregado(cs, apuData).total;
    const ci = calcularCostosIndirectosAgregados(p.modoGastosGenerales, p.gastosGeneralesDetallado, p.gastosGeneralesPctDefault, cd, p.gastosGeneralesItems, p.imprevistosPct);
    const exento = calcularCostosIndirectosExento(p.modoGastosGenerales, p.gastosGeneralesDetallado);
    const util = calcularUtilidadAgregada(cs, apuData);
    const costoTotal = cd + ci + util;
    return { cd, costoTotal, precioFinal: costoTotal + (costoTotal - exento) * 0.22, presupuestado: rubros.reduce((s, r) => s + r.cantidad * r.precioUnit, 0) };
  };

  // Foto de "todo lo demás" del proyecto: tablas con proyectoId + hijas de Rubro + hijas de esas tablas.
  async function fotoOtrasTablasObj(proyectoId: string): Promise<Record<string, unknown[]>> {
    const out: Record<string, unknown[]> = {};
    for (const t of tablasProyecto) out[t] = (await db.$queryRawUnsafe(`select * from "${t}" where "proyectoId"=$1 order by id`, proyectoId)) as unknown[];
    const rubroIds = ((await db.$queryRawUnsafe(`select r.id from "Rubro" r join "Capitulo" c on c.id=r."capituloId" where c."proyectoId"=$1`, proyectoId)) as { id: string }[]).map((x) => x.id);
    for (const f of tablasRubro) out[`${f.t}.${f.c}`] = (await db.$queryRawUnsafe(`select * from "${f.t}" where "${f.c}" = any($1) order by id`, rubroIds)) as unknown[];
    // hijas de las tablas anteriores (ítems de certificación, de orden de compra, etc.)
    for (const t of [...tablasProyecto, ...tablasRubro.map((x) => x.t)]) {
      const ids = ((out[t] ?? Object.entries(out).find(([k]) => k.startsWith(`${t}.`))?.[1] ?? []) as { id: string }[]).map((x) => x.id);
      if (ids.length === 0) continue;
      for (const h of fks.filter((f) => f.ref === t && !out[`${f.t}.${f.c}`] && f.t !== "Rubro" && f.t !== "Capitulo")) {
        out[`${h.t}.${h.c}`] = (await db.$queryRawUnsafe(`select * from "${h.t}" where "${h.c}" = any($1) order by id`, ids)) as unknown[];
      }
    }
    return out;
  }
  const fotoOtrasTablas = async (proyectoId: string) => JSON.stringify(await fotoOtrasTablasObj(proyectoId), (_k, v) => (typeof v === "bigint" ? v.toString() : v));

  const planesProyecto: { p: (typeof proyectos)[number]; nombre: string; titulos: PlanTitulo[]; antes: Totales }[] = [];

  for (const p of proyectos) {
    const nombre = p.nombre.trim();
    console.log("═".repeat(110));
    console.log(`${nombre}   [estado ${p.estado}]`);
    if (excluir.some((x) => nombre.toLowerCase().includes(x))) {
      console.log("  ⛔ EXCLUIDO por --excluir.");
      continue;
    }
    const caps = p.capitulos as unknown as Cap[];
    const antes = totalesDe(p, caps);
    const titulosPlan: PlanTitulo[] = [];

    for (const [tIdx, t] of p.titulos.entries()) {
      const delTitulo = caps.filter((c) => c.tituloId === t.id).sort((a, b) => a.orden - b.orden);
      const plan: PlanTitulo = { tituloId: t.id, tituloNombre: t.nombre, creados: [], movimientos: [], borrar: [], avisos: [], vaciosPorMovimiento: [] };
      const esImpl = (c: Cap) => c.nombre && (norm(c.nombre) === norm(IMPL) || c.capituloCatalogoId === catId(IMPL));
      const esDemo = (c: Cap) => norm(c.nombre) === norm(DEMO) || c.capituloCatalogoId === catId(DEMO);
      const esAlb = (c: Cap) => norm(c.nombre) === norm(ALB) || c.capituloCatalogoId === catId(ALB);
      const esImperm = (c: Cap) => norm(c.nombre) === norm(IMPERM);
      const segs = delTitulo.filter((c) => norm(c.nombre) === norm(SEG));

      const saneados = delTitulo.filter(esAlb).flatMap((c) => c.rubros.filter((r) => RE_SANEADO.test(r.descripcion)).map((r) => ({ r, cap: c })));
      const hidros = delTitulo.filter(esImperm).flatMap((c) => c.rubros.filter((r) => RE_HIDRO.test(r.descripcion)).map((r) => ({ r, cap: c })));
      // Orden de aparición hoy: createdAt y, si empatan (se crearon juntos), el código R###.
      const rubrosSeg = segs.flatMap((c) => [...c.rubros].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.codigo.localeCompare(b.codigo)).map((r) => ({ r, cap: c })));

      if (segs.length === 0 && saneados.length === 0 && hidros.length === 0) {
        titulosPlan.push(plan);
        continue;
      }

      // ── capítulos destino (existentes o a crear) ──
      const destinos = new Map<string, { id: string; nombre: string; esNuevo: boolean }>();
      const necesarios: string[] = [];
      if (rubrosSeg.length > 0) necesarios.push(IMPL);
      if (saneados.length > 0) necesarios.push(DEMO);
      if (hidros.length > 0) necesarios.push(ALB);
      const aCrear: string[] = [];
      for (const nom of necesarios) {
        const ex = delTitulo.find((c) => (nom === IMPL ? esImpl(c) : nom === DEMO ? esDemo(c) : esAlb(c)));
        if (ex) destinos.set(nom, { id: ex.id, nombre: ex.nombre, esNuevo: false });
        else if (nom === ALB) plan.avisos.push(`Falta el capítulo Albañilería para el Hidrolavado: NO se mueve (decidir)`);
        else aCrear.push(nom);
      }

      // ── órdenes y códigos de los capítulos nuevos (sin tocar los existentes) ──
      const borrados = new Set(segs.map((c) => c.id));
      const vivos = delTitulo.filter((c) => !borrados.has(c.id));
      const usadosCodigos = new Set(vivos.map((c) => c.codigo));
      const slots = new Map<string, string[]>();
      for (const nom of aCrear) {
        const r = rankLista(nom);
        const prev = vivos.filter((c) => rankLista(c.nombre) < r).sort((a, b) => b.orden - a.orden)[0];
        const next = vivos.filter((c) => rankLista(c.nombre) > r).sort((a, b) => a.orden - b.orden)[0];
        const k = `${prev?.id ?? "-"}|${next?.id ?? "-"}`;
        slots.set(k, [...(slots.get(k) ?? []), nom]);
      }
      let ordenOk = true;
      for (const [k, noms] of slots) {
        const [pid, nid] = k.split("|");
        const lo = pid === "-" ? -Infinity : vivos.find((c) => c.id === pid)!.orden;
        const hi = nid === "-" ? Infinity : vivos.find((c) => c.id === nid)!.orden;
        noms.sort((a, b) => rankLista(a) - rankLista(b));
        const base = hi !== Infinity ? hi - noms.length : lo === -Infinity ? 1 : lo + 1;
        if (!(base > lo) || !(base + noms.length - 1 < hi)) { ordenOk = false; plan.avisos.push(`Sin hueco de orden para crear ${noms.join(" + ")} sin renumerar los existentes (entre ${lo} y ${hi})`); continue; }
        noms.forEach((nom, i) => {
          let n = 1;
          while (usadosCodigos.has(`${tIdx + 1}.${n}`)) n++;
          const codigo = `${tIdx + 1}.${n}`;
          usadosCodigos.add(codigo);
          const nuevo: CapNuevo = { tmpId: `nuevo:${t.id}:${nom}`, nombre: nom, catalogoId: catId(nom), color: COLOR_DE[nom] ?? "#2563EB", orden: base + i, codigo, tituloId: t.id };
          plan.creados.push(nuevo);
          destinos.set(nom, { id: nuevo.tmpId, nombre: nom, esNuevo: true });
        });
      }
      if (!ordenOk) { titulosPlan.push(plan); continue; }

      // ── movimientos ──
      const proximoCodigo = new Map<string, number>();
      const topeCreatedAt = new Map<string, number>();
      const dest = (nom: string) => destinos.get(nom);
      const registrar = (lista: { r: Cap["rubros"][number]; cap: Cap }[], nom: string) => {
        const d = dest(nom);
        if (!d) return;
        const capDestino = delTitulo.find((c) => c.id === d.id);
        if (!proximoCodigo.has(d.id)) proximoCodigo.set(d.id, (capDestino?.rubros ?? []).reduce((mx, r) => Math.max(mx, parseInt(r.codigo.replace(/\D/g, "") || "0", 10)), 0) + 1);
        if (!topeCreatedAt.has(d.id)) topeCreatedAt.set(d.id, (capDestino?.rubros ?? []).reduce((mx, r) => Math.max(mx, r.createdAt.getTime()), 0));
        for (const { r, cap } of lista) {
          const n = proximoCodigo.get(d.id)!;
          proximoCodigo.set(d.id, n + 1);
          const tope = topeCreatedAt.get(d.id)!;
          const nuevoCreated = r.createdAt.getTime() > tope ? r.createdAt : new Date(tope + 1);
          topeCreatedAt.set(d.id, nuevoCreated.getTime());
          plan.movimientos.push({
            rubroId: r.id, descripcion: r.descripcion, cantidad: r.cantidad, precioUnit: r.precioUnit,
            desdeCapId: cap.id, desdeNombre: cap.nombre, haciaCapId: d.id, haciaNombre: d.nombre,
            codigoViejo: r.codigo, codigoNuevo: `R${String(n).padStart(3, "0")}`, createdAtViejo: r.createdAt, createdAtNuevo: nuevoCreated,
            duplicadoEnDestino: (capDestino?.rubros ?? []).some((x) => norm(x.descripcion) === norm(r.descripcion)),
          });
        }
      };
      registrar(rubrosSeg, IMPL);
      registrar(saneados, DEMO);
      registrar(hidros, ALB);

      // ── Seguridad: se borra si queda vacío y nada más lo referencia ──
      for (const c of segs) {
        const vinculos: string[] = [];
        for (const f of refsACapitulo) {
          const n = ((await db.$queryRawUnsafe(`select count(*)::int n from "${f.t}" where "${f.c}"=$1`, c.id)) as { n: number }[])[0].n;
          if (n > 0) vinculos.push(`${f.t}(${n})`);
        }
        if (vinculos.length > 0) plan.avisos.push(`Capítulo «${c.nombre}» (${c.codigo}) tiene vínculos ${vinculos.join(", ")}: NO se borra`);
        else if (rubrosSeg.some((x) => x.cap.id === c.id) && !dest(IMPL)) plan.avisos.push(`Capítulo «${c.nombre}» (${c.codigo}): sin destino para sus rubros, NO se toca`);
        else plan.borrar.push(c);
      }
      // capítulos que quedan vacíos por el movimiento (se conservan)
      for (const c of delTitulo) {
        if (borrados.has(c.id)) continue;
        const sale = plan.movimientos.filter((m) => m.desdeCapId === c.id).length;
        if (sale > 0 && sale === c.rubros.length) plan.vaciosPorMovimiento.push(`${c.nombre} (${c.codigo})`);
      }
      titulosPlan.push(plan);
    }

    // ── informe por título ──
    const hayAlgo = titulosPlan.some((x) => x.creados.length || x.movimientos.length || x.borrar.length || x.avisos.length);
    if (!hayAlgo) console.log("  Sin cambios: este proyecto ya tiene la estructura nueva (o no tiene nada para mover).");
    for (const tp of titulosPlan) {
      if (!(tp.creados.length || tp.movimientos.length || tp.borrar.length || tp.avisos.length)) continue;
      console.log(`  TÍTULO «${tp.tituloNombre}»`);
      for (const c of tp.creados) console.log(`     + crea capítulo «${c.nombre}»  código ${c.codigo} · orden ${c.orden} · catálogo ${c.catalogoId ? "sí" : "NO"} · color ${c.color}`);
      for (const m of tp.movimientos) {
        console.log(`     → ${m.codigoViejo} «${m.descripcion.slice(0, 54)}» (cant ${m.cantidad}, $${money(m.precioUnit)})  «${m.desdeNombre}» → «${m.haciaNombre}» como ${m.codigoNuevo}${m.createdAtNuevo.getTime() !== m.createdAtViejo.getTime() ? " (al final)" : ""}${m.duplicadoEnDestino ? "  ⚠ ya hay uno igual en el destino" : ""}`);
      }
      for (const c of tp.borrar) console.log(`     − borra capítulo «${c.nombre}» (${c.codigo}, orden ${c.orden}) — vacío y sin vínculos`);
      for (const v of tp.vaciosPorMovimiento) console.log(`     · queda vacío (se conserva): ${v}`);
      for (const a of tp.avisos) console.log(`     ⚠ ${a}`);
    }
    planesProyecto.push({ p, nombre, titulos: titulosPlan, antes });
    {
      const foto = await fotoOtrasTablasObj(p.id);
      const conFilas = Object.entries(foto).filter(([, v]) => v.length > 0).map(([k, v]) => `${k.replace(/\.\w+$/, "")}(${v.length})`);
      console.log(`  Tablas que se verifican idénticas antes/después (con filas): ${conFilas.join(", ") || "ninguna"}`);
    }
    console.log(`  Totales ANTES: Presupuestado (Control de Costos) ${money(antes.presupuestado)} · Costo Directo ${money(antes.cd)} · Costo Total ${money(antes.costoTotal)} · Precio Final ${money(antes.precioFinal)}`);
  }

  // ── aplicar ──
  const hayBloqueo = planesProyecto.some((x) => x.titulos.some((t) => t.avisos.length > 0));
  const conCambios = planesProyecto.filter((x) => x.titulos.some((t) => t.creados.length || t.movimientos.length || t.borrar.length));
  console.log("\n" + "═".repeat(110));
  console.log(`RESUMEN: ${conCambios.length} proyecto(s) con cambios · rubros a mover: ${conCambios.reduce((s, x) => s + x.titulos.reduce((a, t) => a + t.movimientos.length, 0), 0)} · capítulos a crear: ${conCambios.reduce((s, x) => s + x.titulos.reduce((a, t) => a + t.creados.length, 0), 0)} · capítulos a borrar: ${conCambios.reduce((s, x) => s + x.titulos.reduce((a, t) => a + t.borrar.length, 0), 0)}`);
  if (hayBloqueo) console.log("⚠ Hay avisos (ver arriba): lo afectado NO se toca.");

  if (!aplicar) {
    console.log("\nDRY RUN: no se escribió nada. Para aplicar: --apply --respaldo=<archivo> (con el OK de Luis).");
    await db.$disconnect();
    return;
  }

  // Respaldo ANTES de escribir.
  const respaldoJson = {
    generado: new Date().toISOString(),
    proyectos: conCambios.map((x) => ({
      proyectoId: x.p.id, nombre: x.nombre,
      totalesAntes: x.antes,
      titulos: x.titulos.filter((t) => t.creados.length || t.movimientos.length || t.borrar.length).map((t) => ({
        tituloId: t.tituloId,
        creados: t.creados,
        movimientos: t.movimientos,
        borrados: t.borrar.map((c) => ({ ...c, rubros: undefined })),
      })),
    })),
  };
  fs.writeFileSync(respaldo!, JSON.stringify(respaldoJson, null, 1));
  console.log(`\nRespaldo escrito en ${respaldo}`);

  let fallas = 0;
  for (const x of conCambios) {
    const antesOtras = await fotoOtrasTablas(x.p.id);
    const rubrosAntes = new Map(x.p.capitulos.flatMap((c) => c.rubros).map((r) => [r.id, JSON.stringify({ ...r, capituloId: 0, codigo: 0, createdAt: 0, updatedAt: 0 })]));
    try {
      await db.$transaction(
        async (tx) => {
          const idReal = new Map<string, string>();
          for (const t of x.titulos) {
            for (const c of t.creados) {
              const creado = await tx.capitulo.create({
                data: { proyectoId: x.p.id, tituloId: c.tituloId, nombre: c.nombre, codigo: c.codigo, color: c.color, orden: c.orden, capituloCatalogoId: c.catalogoId },
              });
              idReal.set(c.tmpId, creado.id);
            }
          }
          for (const t of x.titulos) {
            for (const m of t.movimientos) {
              const r = await tx.rubro.updateMany({
                where: { id: m.rubroId, capituloId: m.desdeCapId, codigo: m.codigoViejo },
                data: { capituloId: idReal.get(m.haciaCapId) ?? m.haciaCapId, codigo: m.codigoNuevo, createdAt: m.createdAtNuevo },
              });
              if (r.count !== 1) throw new Error(`rubro ${m.rubroId} cambió mientras tanto`);
            }
            for (const c of t.borrar) {
              const restan = await tx.rubro.count({ where: { capituloId: c.id } });
              if (restan > 0) throw new Error(`el capítulo ${c.codigo} todavía tiene ${restan} rubro(s)`);
              await tx.capitulo.delete({ where: { id: c.id } });
            }
          }
        },
        { timeout: 120_000 }
      );

      // Verificación releyendo la base
      const despues = await db.proyecto.findUnique({
        where: { id: x.p.id },
        include: { capitulos: { include: { rubros: { include: { apu: { include: { materiales: true, manoObra: true, equipos: true } } } } } } },
      });
      const p2 = { ...x.p, capitulos: despues!.capitulos } as unknown as (typeof proyectos)[number];
      const t2 = totalesDe(p2, despues!.capitulos as unknown as Cap[]);
      const mismosTotales = Math.abs(t2.presupuestado - x.antes.presupuestado) < 1e-6 && Math.abs(t2.cd - x.antes.cd) < 1e-6 && Math.abs(t2.costoTotal - x.antes.costoTotal) < 1e-6 && Math.abs(t2.precioFinal - x.antes.precioFinal) < 1e-6;
      const rubros2 = new Map(despues!.capitulos.flatMap((c) => c.rubros).map((r) => [r.id, JSON.stringify({ ...r, capituloId: 0, codigo: 0, createdAt: 0, updatedAt: 0 })]));
      const rubrosIguales = rubros2.size === rubrosAntes.size && [...rubrosAntes].every(([id, v]) => rubros2.get(id) === v);
      const otrasIguales = (await fotoOtrasTablas(x.p.id)) === antesOtras;
      const ok = mismosTotales && rubrosIguales && otrasIguales;
      console.log(`  ${ok ? "✔" : "✖"} ${x.nombre}: totales ${mismosTotales ? "idénticos" : "DISTINTOS"} (Costo Total ${money(x.antes.costoTotal)} → ${money(t2.costoTotal)}; Precio Final ${money(x.antes.precioFinal)} → ${money(t2.precioFinal)}) · rubros/APU ${rubrosIguales ? "idénticos" : "DISTINTOS"} · otras tablas ${otrasIguales ? "idénticas" : "DISTINTAS"}`);
      if (!ok) fallas++;
    } catch (err) {
      fallas++;
      console.error(`  ✖ ${x.nombre}: falló y se revirtió SOLO este proyecto:`, err);
    }
  }
  console.log(fallas ? `\nTERMINADO CON ${fallas} FALLA(S).` : "\nAPLICADO.");
  await db.$disconnect();
  if (fallas) process.exit(1);
}

// ── revertir desde el respaldo ──
async function revertirDesde(archivo: string, aplicar: boolean) {
  const r = JSON.parse(fs.readFileSync(archivo, "utf8")) as {
    proyectos: { proyectoId: string; nombre: string; titulos: { tituloId: string; creados: CapNuevo[]; movimientos: (Omit<Movimiento, "createdAtViejo" | "createdAtNuevo"> & { createdAtViejo: string })[]; borrados: Cap[] }[] }[];
  };
  console.log(`Modo: REVERTIR ${aplicar ? "(APLICA)" : "(dry-run)"} desde ${archivo}\n`);
  for (const p of r.proyectos) {
    console.log(`${p.nombre}`);
    for (const t of p.titulos) {
      for (const c of t.borrados) console.log(`  + recrea capítulo «${c.nombre}» (${c.codigo}) con su id`);
      for (const m of t.movimientos) console.log(`  ← rubro ${m.rubroId.slice(-6)} vuelve a «${m.desdeNombre}» como ${m.codigoViejo}`);
      for (const c of t.creados) console.log(`  − borra el capítulo creado «${c.nombre}» (${c.codigo}) si quedó vacío`);
    }
    if (!aplicar) continue;
    await db.$transaction(
      async (tx) => {
        for (const t of p.titulos) {
          for (const c of t.borrados) {
            if (await tx.capitulo.findUnique({ where: { id: c.id } })) continue;
            await tx.capitulo.create({
              data: { id: c.id, nombre: c.nombre, codigo: c.codigo, color: c.color, orden: c.orden, fechaInicio: c.fechaInicio, fechaFin: c.fechaFin, proyectoId: c.proyectoId, tituloId: c.tituloId, capituloCatalogoId: c.capituloCatalogoId, createdAt: c.createdAt },
            });
          }
          for (const m of t.movimientos) {
            await tx.rubro.update({ where: { id: m.rubroId }, data: { capituloId: m.desdeCapId, codigo: m.codigoViejo, createdAt: new Date(m.createdAtViejo) } });
          }
          for (const c of t.creados) {
            const real = await tx.capitulo.findFirst({ where: { proyectoId: p.proyectoId, tituloId: c.tituloId, nombre: c.nombre, codigo: c.codigo } });
            if (real && (await tx.rubro.count({ where: { capituloId: real.id } })) === 0) await tx.capitulo.delete({ where: { id: real.id } });
          }
        }
      },
      { timeout: 120_000 }
    );
  }
  console.log(aplicar ? "\nREVERTIDO." : "\nDRY RUN de la reversión: no se escribió nada. Para revertir: --revertir=<archivo> --apply");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
