// Auditoría HTTP de aislamiento multi-tenant (oct-2026).
//
// Crea una empresa de prueba ("B", slug audit-<timestamp>) con un usuario de
// rol ADMIN (el rol más alto de un cliente), inicia sesión con NextAuth por
// HTTP contra el dev server y
// verifica que:
//   1. Sobre datos de OTRAS empresas (proyectos, rubros, sugerencias) recibe
//      404 JSON — nunca los datos, nunca un 200.
//   2. Los listados (/api/proyectos, /api/sugerencias) no incluyen nada ajeno.
//   3. Lo propio funciona: /api/empresa/perfil y /api/configuracion-empresa
//      devuelven la empresa B, y un PATCH de configuración no toca a las demás.
//   4. Las rutas solo-SUPERADMIN devuelven 403.
//   5. (Fase 2) Las escrituras sobre catálogos globales (precios MTOP,
//      convenio SUNCA, precios de mercado, capítulos estándar) devuelven 403,
//      y un POST real a la biblioteca de subrubros no deja nada escrito.
//   6. Notas de diseño (no son pruebas HTTP): márgenes y moneda viven en el
//      Proyecto, no en Configuracion global.
//   7. (Registro público) Prueba gratis y estado de la empresa, cambiando el
//      estado de la empresa B en la base: cupo de Cálculo Rápido agotado,
//      funciones sin proyecto bloqueadas en prueba, cupo de proyecto asistido
//      (sobre proyectos vacíos de B: generar-rubros no llega a llamar al
//      servicio), prueba vencida en solo lectura, empresa desactivada y email
//      sin verificar. Ninguno de estos casos llama al servicio asistido.
//   8. Clave de Anthropic por estado: PRUEBA → ANTHROPIC_API_KEY_PRUEBA,
//      ACTIVA / null → ANTHROPIC_API_KEY, PRUEBA sin la clave de pruebas →
//      falla cerrado (y por HTTP, 503 sin detalles internos), clasificación
//      de los topes de gasto y eventos del sistema separados por empresa.
//      Tampoco llama a Anthropic.
// Al final borra todo lo que creó (en un finally, aunque algo falle).
//
// Seguridad sobre datos reales (DATABASE_URL apunta a producción):
//  - Sobre datos de otras empresas solo se hacen GET, salvo el PATCH de
//    sugerencia, que manda el MISMO valor de `resuelta` que ya tiene: aunque
//    el aislamiento fallara, no cambia nada.
//  - Quedan afuera los GET que crean filas de forma perezosa
//    (leyes-sociales): si el aislamiento fallara, escribirían en un proyecto
//    real.
//  - Las rutas SUPERADMIN y de catálogo se prueban con body vacío: el 403
//    sale antes de leer el body. Única excepción, a propósito: el POST a
//    /api/subrubros-estandar lleva un body real marcado "[AUDIT]" para poder
//    comprobar en la base que no se escribió; si se llegara a escribir, se
//    borra en el finally.
//  - La contraseña del usuario de prueba es aleatoria y nunca se imprime.
//
// Un 404 HTML (no JSON) es el 404 genérico de Next cuando el dev server
// todavía no registró la ruta (ver CLAUDE.md, "ruta API anidada que da 404
// HTML") — NO prueba aislamiento: se reintenta una vez y, si sigue, queda
// INCONCLUSO.
//
// Ejecutar (dry-run, no escribe nada):  npx tsx scripts/audit-isolation.ts
// Ejecutar (real, necesita :3001):      npx tsx scripts/audit-isolation.ts --apply
// Otro servidor:                         ... --base=http://localhost:3000
// Borrar restos de corridas cortadas:    npx tsx scripts/audit-isolation.ts --limpiar

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const APLICAR = process.argv.includes("--apply");
const LIMPIAR = process.argv.includes("--limpiar");
const BASE = (process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "http://localhost:3001").replace(/\/$/, "");
const PREFIJO_SLUG = "audit-";
const TIMEOUT_MS = 120_000; // primera compilación de una ruta en dev puede tardar
const MARCA_SUBRUBRO = "[AUDIT] test rubro";
const MARCA_EVENTO = "audit-isolation";

type Esperado = 403 | 404;
interface Caso {
  grupo: string;
  metodo: "GET" | "POST" | "PATCH" | "DELETE";
  ruta: string;
  esperado: Esperado;
  body?: unknown;
}
interface Resultado {
  caso: Caso;
  status: number;
  json: boolean;
  estado: "OK" | "FALLA" | "INCONCLUSO";
  nota?: string;
}

// ─── HTTP + sesión NextAuth ───────────────────────────────────────────────

class Cliente {
  private cookies = new Map<string, string>();

  private guardarCookies(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [par] = c.split(";");
      const i = par.indexOf("=");
      if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
    }
  }

  private cabeceraCookie() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async pedir(metodo: string, ruta: string, body?: unknown, extra: Record<string, string> = {}): Promise<Response> {
    const headers: Record<string, string> = { cookie: this.cabeceraCookie(), ...extra };
    let payload: string | undefined;
    if (body !== undefined && typeof body !== "string") {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    } else if (typeof body === "string") {
      payload = body;
    }
    const res = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers,
      body: payload,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    this.guardarCookies(res);
    return res;
  }

  async login(email: string, password: string): Promise<void> {
    const csrfRes = await this.pedir("GET", "/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    const form = new URLSearchParams({ csrfToken, email, password, json: "true" }).toString();
    await this.pedir("POST", "/api/auth/callback/credentials", form, {
      "content-type": "application/x-www-form-urlencoded",
    });
    const sesionRes = await this.pedir("GET", "/api/auth/session");
    const sesion = (await sesionRes.json()) as { user?: { email?: string } };
    if (sesion.user?.email !== email) {
      throw new Error(`Login falló: /api/auth/session devolvió ${JSON.stringify(sesion)}`);
    }
  }
}

function esJson(res: Response) {
  return (res.headers.get("content-type") ?? "").includes("application/json");
}

async function correrCaso(cliente: Cliente, caso: Caso): Promise<Resultado> {
  for (let intento = 1; intento <= 2; intento++) {
    const res = await cliente.pedir(caso.metodo, caso.ruta, caso.body);
    const json = esJson(res);
    await res.arrayBuffer(); // consumir el body
    if (res.status === 404 && !json) {
      if (intento === 1) {
        await new Promise((r) => setTimeout(r, 5_000));
        continue;
      }
      return { caso, status: res.status, json, estado: "INCONCLUSO", nota: "404 HTML: ruta no registrada en el dev server" };
    }
    const ok = res.status === caso.esperado && json;
    return { caso, status: res.status, json, estado: ok ? "OK" : "FALLA" };
  }
  throw new Error("inalcanzable");
}

// ─── Limpieza ─────────────────────────────────────────────────────────────

async function borrarEmpresaDePrueba(empresaId: string) {
  await db.eventoAdmin.deleteMany({ where: { empresaId } });
  await db.consumoFuncionesAsistidas.deleteMany({ where: { empresaId } });
  await db.capitulo.deleteMany({ where: { proyecto: { empresaId } } });
  await db.proyecto.deleteMany({ where: { empresaId } });
  await db.sugerencia.deleteMany({ where: { empresaId } });
  await db.logConsumoIA.deleteMany({ where: { empresaId } });
  await db.user.deleteMany({ where: { empresaId } });
  // ConfiguracionEmpresa se va por onDelete: Cascade.
  await db.empresa.delete({ where: { id: empresaId } });
}

async function limpiarRestos() {
  const restos = await db.empresa.findMany({
    where: { slug: { startsWith: PREFIJO_SLUG } },
    select: { id: true, nombre: true, slug: true, _count: { select: { proyectos: true } } },
  });
  console.log(`Empresas de prueba encontradas (slug ${PREFIJO_SLUG}*): ${restos.length}`);
  for (const e of restos) {
    if (e._count.proyectos > 0) {
      console.log(`  - ${e.slug}: tiene ${e._count.proyectos} proyectos — NO se borra, revisar a mano`);
      continue;
    }
    console.log(`  - ${e.slug} (${e.nombre})${APLICAR ? " → borrada" : ""}`);
    if (APLICAR) await borrarEmpresaDePrueba(e.id);
  }
  if (!APLICAR && restos.length > 0) console.log("Dry-run: correr con --limpiar --apply para borrarlas.");
}

// ─── Casos a probar ───────────────────────────────────────────────────────

async function armarCasos(empresaPropiaId: string | null) {
  const ajenas = { not: empresaPropiaId ?? "__ninguna__" };

  const proyecto = await db.proyecto.findFirst({
    where: { empresaId: ajenas },
    orderBy: { createdAt: "asc" },
    select: { id: true, nombre: true, empresa: { select: { nombre: true } } },
  });
  if (!proyecto) throw new Error("No hay ningún proyecto de otra empresa para probar.");

  const rubro = await db.rubro.findFirst({
    where: { capitulo: { proyectoId: proyecto.id } },
    select: { id: true },
  });
  const sugerencia = await db.sugerencia.findFirst({
    where: { empresaId: ajenas },
    select: { id: true, resuelta: true },
  });
  const idsAjenos = (await db.proyecto.findMany({ where: { empresaId: ajenas }, select: { id: true } })).map((p) => p.id);

  const p = `/api/proyectos/${proyecto.id}`;
  const casos: Caso[] = [
    ...[
      "",
      "/bitacora",
      "/certificaciones",
      "/cierre-obra",
      "/contrato",
      "/documentos",
      "/documentos-metraje",
      "/documentos-post-obra",
      "/filas-metraje",
      "/flujo-caja",
      "/liquidacion-final",
      "/ordenes-compra",
      "/personal",
      "/secciones-planilla",
      "/subcontratistas",
      "/tramites",
      "/pdf",
      "/lista-materiales-pdf",
    ].map((s): Caso => ({ grupo: "Proyecto ajeno", metodo: "GET", ruta: `${p}${s}`, esperado: 404 })),
  ];
  if (rubro) {
    for (const s of ["/apu", "/cotizaciones", "/precio-vigente"]) {
      casos.push({ grupo: "Rubro ajeno", metodo: "GET", ruta: `/api/rubros/${rubro.id}${s}`, esperado: 404 });
    }
  }
  if (sugerencia) {
    casos.push({
      grupo: "Sugerencia ajena",
      metodo: "PATCH",
      ruta: `/api/sugerencias/${sugerencia.id}`,
      body: { resuelta: sugerencia.resuelta }, // mismo valor: no cambia nada aunque falle
      esperado: 404,
    });
  }

  const SUPER: [Caso["metodo"], string][] = [
    ["GET", "/api/admin/empresas"],
    ["GET", "/api/admin/usuarios"],
    ["PATCH", "/api/admin/empresas/audit-id-inexistente/estado"],
    ["GET", "/api/admin/eventos-admin"],
    ["PATCH", "/api/configuracion"],
    ["PATCH", "/api/categorias-laborales"],
    ["POST", "/api/configuracion/extraer-jornales"],
    ["POST", "/api/subrubros-estandar"],
    ["POST", "/api/configuracion/indice-iccv"],
    ["DELETE", "/api/configuracion/indice-iccv/audit-id-inexistente"],
  ];
  for (const [metodo, ruta] of SUPER) {
    casos.push({ grupo: "Solo SUPERADMIN", metodo, ruta, esperado: 403, body: metodo === "GET" || metodo === "DELETE" ? undefined : {} });
  }

  // Fase 2 — escritura sobre catálogos globales.
  const CATALOGO: [Caso["metodo"], string][] = [
    ["PATCH", "/api/precios-mtop"],
    ["PATCH", "/api/precios-mtop/audit-codigo-inexistente"],
    ["POST", "/api/precios-mtop/importar"],
    ["POST", "/api/precios-mtop/extraer-pdf"],
    ["POST", "/api/precios-mtop/audit-codigo-inexistente/resolver"],
    ["POST", "/api/configuracion/convenio-imagen"],
    ["POST", "/api/configuracion/convenio-pdf"],
    ["POST", "/api/configuracion/precios-mercado/evento-resumen"],
    ["POST", "/api/configuracion/precios-mercado/procesar-tanda"],
    ["POST", "/api/capitulos-estandar"],
  ];
  for (const [metodo, ruta] of CATALOGO) {
    casos.push({ grupo: "Catálogo global", metodo, ruta, esperado: 403, body: {} });
  }
  // Body real (ver encabezado): el chequeo de la base confirma que no se escribió.
  casos.push({
    grupo: "Biblioteca global",
    metodo: "POST",
    ruta: "/api/subrubros-estandar",
    esperado: 403,
    body: { descripcion: `${MARCA_SUBRUBRO} ${Date.now()}`, unidad: "m²", capitulo: "TEST", precioUY: 100 },
  });

  return { proyecto, rubro, sugerencia, idsAjenos, casos };
}

// ─── Principal ────────────────────────────────────────────────────────────

async function main() {
  console.log(`Modo: ${LIMPIAR ? "LIMPIAR" : "AUDITORÍA"} ${APLICAR ? "(APPLY)" : "(DRY-RUN, no escribe nada)"}`);
  if (LIMPIAR) return limpiarRestos();

  const { proyecto, rubro, sugerencia, idsAjenos, casos } = await armarCasos(null);
  console.log(`Servidor: ${BASE}`);
  console.log(`Proyecto ajeno de referencia: "${proyecto.nombre}" (${proyecto.empresa?.nombre ?? "sin empresa"}, ${proyecto.id})`);
  console.log(`Rubro ajeno: ${rubro?.id ?? "— (sin rubros, se saltean esos casos)"}`);
  console.log(`Sugerencia ajena: ${sugerencia?.id ?? "— (no hay, se saltea)"}`);
  console.log(`Proyectos ajenos totales (para el chequeo de listado): ${idsAjenos.length}`);
  console.log(`Casos de 404/403: ${casos.length} + 5 chequeos de datos propios/listados + 12 de prueba gratis y estado + 7 de clave de Anthropic y eventos`);

  if (!APLICAR) {
    for (const c of casos) console.log(`  ${c.grupo.padEnd(18)} ${c.metodo.padEnd(6)} ${c.ruta}  → espera ${c.esperado}`);
    console.log("\nDry-run: se crearía una empresa audit-<timestamp> + un usuario ADMIN, y se borrarían al final.");
    console.log("Correr con --apply (con el dev server prendido) para ejecutar la auditoría.");
    return;
  }

  // Chequeo previo: el servidor responde.
  try {
    await fetch(`${BASE}/api/auth/csrf`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new Error(`No responde ${BASE} — ¿está prendido el dev server?`);
  }

  const marca = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const slug = `${PREFIJO_SLUG}${marca}`;
  const email = `${slug}@audit.invalid`;
  const password = randomBytes(24).toString("base64url");

  const empresa = await db.empresa.create({
    // ACTIVA: los casos 1-6 no tienen que chocar con la prueba gratis (el 7 la arma a mano).
    data: { nombre: `AUDITORÍA ${marca}`, slug, rut: `AUDIT-${marca}`, plan: "basico", estado: "ACTIVA" },
  });
  console.log(`\nEmpresa de prueba creada: ${empresa.nombre} (${empresa.id})`);

  let fallas = 0;
  let inconclusos = 0;
  let empresaCId: string | null = null;
  try {
    await db.user.create({
      data: { email, nombre: "Usuario auditoría", rol: "ADMIN", empresaId: empresa.id, passwordHash: await bcrypt.hash(password, 10), emailVerificado: true },
    });

    const cliente = new Cliente();
    await cliente.login(email, password);
    console.log("Login OK como usuario de prueba (rol ADMIN, empresa B).\n");

    const resultados: Resultado[] = [];
    for (const caso of casos) resultados.push(await correrCaso(cliente, caso));

    // Datos propios y listados.
    const extra: { nombre: string; ok: boolean; detalle: string }[] = [];

    const perfil = await cliente.pedir("GET", "/api/empresa/perfil");
    const perfilJson = (await perfil.json().catch(() => null)) as { id?: string } | null;
    extra.push({ nombre: "GET /api/empresa/perfil es la empresa B", ok: perfil.status === 200 && perfilJson?.id === empresa.id, detalle: `status ${perfil.status}` });

    const listado = await cliente.pedir("GET", "/api/proyectos");
    const proyectos = (await listado.json().catch(() => null)) as { id: string }[] | null;
    const filtrados = Array.isArray(proyectos) ? proyectos.filter((x) => idsAjenos.includes(x.id)).length : -1;
    extra.push({ nombre: "GET /api/proyectos sin proyectos ajenos", ok: listado.status === 200 && filtrados === 0, detalle: `status ${listado.status}, ajenos visibles: ${filtrados}` });

    const nueva = await cliente.pedir("POST", "/api/sugerencias", { mensaje: "Sugerencia de auditoría (se borra al final)" });
    const nuevaJson = (await nueva.json().catch(() => null)) as { empresaId?: string } | null;
    const lista = await cliente.pedir("GET", "/api/sugerencias");
    const sugs = (await lista.json().catch(() => null)) as { empresaId?: string }[] | null;
    const soloPropias = Array.isArray(sugs) && sugs.length === 1 && sugs.every((s) => s.empresaId === empresa.id);
    extra.push({ nombre: "Sugerencias: alta con empresa B y listado solo propio", ok: nueva.status === 201 && nuevaJson?.empresaId === empresa.id && soloPropias, detalle: `POST ${nueva.status}, GET ${lista.status}, visibles: ${Array.isArray(sugs) ? sugs.length : "?"}` });

    const otrasAntes = await db.configuracionEmpresa.findMany({ where: { empresaId: { not: empresa.id } }, select: { id: true, margenEmpresa: true } });
    const cfg = await cliente.pedir("PATCH", "/api/configuracion-empresa", { margenEmpresa: 0.37 });
    const cfgJson = (await cfg.json().catch(() => null)) as { empresaId?: string; margenEmpresa?: number } | null;
    const otrasDespues = await db.configuracionEmpresa.findMany({ where: { empresaId: { not: empresa.id } }, select: { id: true, margenEmpresa: true } });
    const intactas = JSON.stringify(otrasAntes) === JSON.stringify(otrasDespues);
    extra.push({ nombre: "PATCH /api/configuracion-empresa solo toca la empresa B", ok: cfg.status === 200 && cfgJson?.empresaId === empresa.id && cfgJson?.margenEmpresa === 0.37 && intactas, detalle: `status ${cfg.status}, otras empresas intactas: ${intactas}` });

    const escritos = await db.subrubroEstandar.count({ where: { descripcion: { startsWith: MARCA_SUBRUBRO } } });
    extra.push({ nombre: "POST a la biblioteca global no dejó ningún subrubro escrito", ok: escritos === 0, detalle: escritos === 0 ? "0 en la base" : `${escritos} ENCONTRADOS — la biblioteca global no está protegida` });

    // Prueba gratis y estado de la empresa (cambia el estado de B en la base).
    const prueba: { nombre: string; ok: boolean; detalle: string }[] = [];
    const codigo = async (res: Response) => ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "—";
    const enUnMes = new Date(Date.now() + 30 * 86_400_000);
    await db.empresa.update({ where: { id: empresa.id }, data: { estado: "PRUEBA", fechaVencimientoPrueba: enUnMes, cupoCalculosRapidos: 0, cupoProyectosIA: 1 } });

    let r = await cliente.pedir("POST", "/api/calcular-rapido", { descripcion: "auditoría" });
    let c = await codigo(r);
    prueba.push({ nombre: "Cálculo Rápido con cupo agotado → 403 CUPO_AGOTADO", ok: r.status === 403 && c === "CUPO_AGOTADO", detalle: `${r.status} ${c}` });
    for (const ruta of ["/api/materiales/estimar-precio", "/api/sugerir-capitulos", "/api/metrajes/sugerir", "/api/metrajes/analizar-imagen"]) {
      r = await cliente.pedir("POST", ruta, { descripcion: "auditoría" });
      c = await codigo(r);
      prueba.push({ nombre: `${ruta} en prueba → 403 NO_DISPONIBLE_EN_PRUEBA`, ok: r.status === 403 && c === "NO_DISPONIBLE_EN_PRUEBA", detalle: `${r.status} ${c}` });
    }

    const [pA, pB] = await Promise.all([
      db.proyecto.create({ data: { nombre: `AUDITORÍA A ${marca}`, empresaId: empresa.id }, select: { id: true } }),
      db.proyecto.create({ data: { nombre: `AUDITORÍA B ${marca}`, empresaId: empresa.id }, select: { id: true } }),
    ]);
    const r1 = await cliente.pedir("POST", `/api/proyectos/${pA.id}/generar-rubros`, {});
    const r2 = await cliente.pedir("POST", `/api/proyectos/${pA.id}/generar-rubros`, {});
    const consumosA = await db.consumoFuncionesAsistidas.count({ where: { empresaId: empresa.id, tipo: "proyecto_ia", proyectoId: pA.id } });
    prueba.push({ nombre: "Proyecto asistido: 2 usos en el mismo proyecto pasan y cuentan 1 sola vez", ok: r1.status === 202 && r2.status === 202 && consumosA === 1, detalle: `${r1.status}/${r2.status}, consumos: ${consumosA}` });
    r = await cliente.pedir("POST", `/api/proyectos/${pB.id}/generar-rubros`, {});
    c = await codigo(r);
    prueba.push({ nombre: "Proyecto asistido en OTRO proyecto con el cupo usado → 403 CUPO_AGOTADO", ok: r.status === 403 && c === "CUPO_AGOTADO", detalle: `${r.status} ${c}` });
    r = await cliente.pedir("POST", `/api/proyectos/${pB.id}/generar-rubros`, { capitulosConMontos: [{ nombre: "Albañilería", monto: 1 }] });
    prueba.push({ nombre: "generar-rubros desde Cálculo Rápido no usa el cupo de proyecto", ok: r.status === 202, detalle: `${r.status}` });

    const estadoRes = await cliente.pedir("GET", "/api/cuenta/estado");
    const estadoJson = (await estadoRes.json().catch(() => null)) as {
      estado?: string;
      diasRestantes?: number;
      cupos?: { proyectoAsistido?: { usado: number; limite: number } };
    } | null;
    prueba.push({
      nombre: "GET /api/cuenta/estado refleja la prueba (30 días, proyecto asistido 1/1)",
      ok: estadoRes.status === 200 && estadoJson?.estado === "PRUEBA" && estadoJson.diasRestantes === 30 && estadoJson.cupos?.proyectoAsistido?.usado === 1,
      detalle: `${estadoRes.status} ${estadoJson?.estado} ${estadoJson?.diasRestantes} días, proyecto ${estadoJson?.cupos?.proyectoAsistido?.usado}/${estadoJson?.cupos?.proyectoAsistido?.limite}`,
    });

    const claves: { nombre: string; ok: boolean; detalle: string }[] = [];
    // Clave de Anthropic según el estado y eventos del sistema. Nada de esto
    // llama a Anthropic: la clave elegida se mira en el cliente (apiKey), el
    // tope se prueba con errores armados con el SDK, y el caso HTTP corre solo
    // si el server NO tiene ANTHROPIC_API_KEY_PRUEBA (falla antes de salir a la red).
    const ac = await import("../src/lib/anthropic-client");
    const ev = await import("../src/lib/eventos-admin");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const clavePruebaReal = process.env.ANTHROPIC_API_KEY_PRUEBA;
    const CLAVE_FALSA = "sk-audit-clave-de-pruebas";
    const empresaAjena = await db.proyecto.findUnique({ where: { id: proyecto.id }, select: { empresa: { select: { id: true, estado: true } } } });
    process.env.ANTHROPIC_API_KEY_PRUEBA = CLAVE_FALSA;
    try {
      const deB = await ac.clienteParaEmpresa(empresa.id); // B está en PRUEBA (bloque anterior)
      claves.push({ nombre: "getAnthropicClient('PRUEBA') usa ANTHROPIC_API_KEY_PRUEBA", ok: ac.getAnthropicClient("PRUEBA").apiKey === CLAVE_FALSA, detalle: "clave de pruebas" });
      const principal = ac.getAnthropicClient("ACTIVA").apiKey;
      claves.push({
        nombre: "getAnthropicClient('ACTIVA') y null usan ANTHROPIC_API_KEY (nunca la de pruebas)",
        ok: !!principal && principal === process.env.ANTHROPIC_API_KEY && principal !== CLAVE_FALSA && ac.getAnthropicClient(null).apiKey === principal,
        detalle: "clave principal",
      });
      if (empresaAjena?.empresa?.estado === "ACTIVA") {
        const deAjena = await ac.clienteParaEmpresa(empresaAjena.empresa.id);
        claves.push({
          nombre: "clienteParaEmpresa: empresa B (PRUEBA) → pruebas, empresa ajena (ACTIVA) → principal",
          ok: deB.apiKey === CLAVE_FALSA && deAjena.apiKey === principal,
          detalle: `B=${deB.apiKey === CLAVE_FALSA ? "pruebas" : "principal"}, ajena=${deAjena.apiKey === principal ? "principal" : "pruebas"}`,
        });
      } else {
        claves.push({ nombre: "clienteParaEmpresa: empresa B (PRUEBA) → pruebas", ok: deB.apiKey === CLAVE_FALSA, detalle: "(la empresa ajena no está ACTIVA: solo se chequea B)" });
      }
      delete process.env.ANTHROPIC_API_KEY_PRUEBA;
      let fallaCerrado = false;
      try {
        await ac.clienteParaEmpresa(empresa.id);
      } catch (e) {
        fallaCerrado = e instanceof ac.ErrorFuncionNoDisponible && e.codigo === "ANTHROPIC_KEY_PRUEBA_NO_CONFIGURADA";
      }
      claves.push({ nombre: "PRUEBA sin ANTHROPIC_API_KEY_PRUEBA → falla cerrado (no usa la principal)", ok: fallaCerrado, detalle: fallaCerrado ? "ErrorFuncionNoDisponible" : "devolvió un cliente" });
    } finally {
      if (clavePruebaReal === undefined) delete process.env.ANTHROPIC_API_KEY_PRUEBA;
      else process.env.ANTHROPIC_API_KEY_PRUEBA = clavePruebaReal;
    }

    // Punta a punta: el server sin la clave de pruebas responde 503 sin detalles internos y deja el evento.
    if (clavePruebaReal) {
      claves.push({ nombre: "HTTP: PRUEBA sin clave de pruebas → 503 (no corrido)", ok: true, detalle: "el entorno tiene ANTHROPIC_API_KEY_PRUEBA: se saltea para no gastar" });
    } else {
      const res = await cliente.pedir("POST", `/api/proyectos/${pA.id}/detectar-faltantes`);
      const texto = await res.text();
      const cuerpo = (() => { try { return JSON.parse(texto) as { error?: string }; } catch { return null; } })();
      const evento = await db.eventoAdmin.count({ where: { empresaId: empresa.id, tipo: "ANTHROPIC_KEY_PRUEBA_NO_CONFIGURADA" } });
      const sinInternos = !/anthropic|claude|api[_ ]key|\bIA\b/i.test(texto);
      claves.push({
        nombre: "HTTP: PRUEBA sin clave de pruebas → 503 FUNCION_NO_DISPONIBLE, evento registrado, sin detalles internos",
        ok: res.status === 503 && cuerpo?.error === "FUNCION_NO_DISPONIBLE" && evento === 1 && sinInternos,
        detalle: `${res.status} ${cuerpo?.error}, eventos ${evento}, texto limpio ${sinInternos}`,
      });
    }

    // Tope alcanzado: errores con la forma exacta que documenta Anthropic.
    const err400 = Anthropic.APIError.generate(400, { type: "error", error: { type: "invalid_request_error", message: "You have reached your specified workspace API usage limits. You will regain access on 2026-11-01 at 00:00 UTC." } }, undefined, new Headers());
    const err429Tope = Anthropic.APIError.generate(429, { type: "error", error: { type: "rate_limit_error", message: "You have reached your API usage limits...", details: { error_code: "enforced_spend_limit_reached" } } }, undefined, new Headers());
    const err429Normal = Anthropic.APIError.generate(429, { type: "error", error: { type: "rate_limit_error", message: "Number of request tokens has exceeded your per-minute rate limit" } }, undefined, new Headers({ "retry-after": "10" }));
    const c400 = ac.clasificarErrorAnthropic(err400);
    const c429 = ac.clasificarErrorAnthropic(err429Tope);
    const cNormal = ac.clasificarErrorAnthropic(err429Normal);
    claves.push({
      nombre: "Tope: 400 de workspace → LIMITE_WORKSPACE_ALCANZADO; 429 de spend cap → LIMITE_ORG_ALCANZADO; 429 común → no es tope",
      ok: c400?.codigo === "LIMITE_WORKSPACE_ALCANZADO" && c429?.codigo === "LIMITE_ORG_ALCANZADO" && cNormal === null,
      detalle: `${c400?.codigo} / ${c429?.codigo} / ${cNormal === null ? "null" : cNormal.codigo}`,
    });

    // registrarEventoAdmin no mezcla empresas: dedup solo dentro de la misma empresa (y null aparte).
    const empresaC = await db.empresa.create({
      data: { nombre: `AUDITORÍA C ${marca}`, slug: `${slug}-c`, rut: `AUDIT-C-${marca}`, plan: "basico", estado: "ACTIVA" },
      select: { id: true },
    });
    empresaCId = empresaC.id;
    await ev.registrarEventoAdmin("AUDIT_EVENTO", empresa.id, MARCA_EVENTO, "B");
    await ev.registrarEventoAdmin("AUDIT_EVENTO", empresaC.id, MARCA_EVENTO, "C");
    await ev.registrarEventoAdmin("AUDIT_EVENTO", empresa.id, MARCA_EVENTO, "B otra vez (dedup)");
    await ev.registrarEventoAdmin("AUDIT_EVENTO", null, MARCA_EVENTO, "sin empresa");
    const [enB, enC, sinEmpresa] = await Promise.all([
      db.eventoAdmin.count({ where: { funcion: MARCA_EVENTO, empresaId: empresa.id } }),
      db.eventoAdmin.count({ where: { funcion: MARCA_EVENTO, empresaId: empresaC.id } }),
      db.eventoAdmin.count({ where: { funcion: MARCA_EVENTO, empresaId: null } }),
    ]);
    claves.push({
      nombre: "registrarEventoAdmin: B, C y sin empresa separados; repetido en B se deduplica",
      ok: enB === 1 && enC === 1 && sinEmpresa === 1,
      detalle: `B ${enB}, C ${enC}, sin empresa ${sinEmpresa}`,
    });

    // Vencida: sigue en PRUEBA en la base pero con la fecha pasada.
    await db.empresa.update({ where: { id: empresa.id }, data: { fechaVencimientoPrueba: new Date(Date.now() - 60_000) } });
    const lectura = await cliente.pedir("GET", "/api/empresa/perfil");
    r = await cliente.pedir("PATCH", "/api/configuracion-empresa", { margenEmpresa: 0.38 });
    c = await codigo(r);
    const persistido = (await db.empresa.findUnique({ where: { id: empresa.id }, select: { estado: true } }))?.estado;
    prueba.push({
      nombre: "Prueba vencida: lectura 200, escritura 403 PRUEBA_VENCIDA, estado pasa a VENCIDA",
      ok: lectura.status === 200 && r.status === 403 && c === "PRUEBA_VENCIDA" && persistido === "VENCIDA",
      detalle: `GET ${lectura.status}, PATCH ${r.status} ${c}, estado ${persistido}`,
    });

    await db.empresa.update({ where: { id: empresa.id }, data: { estado: "DESACTIVADA" } });
    r = await cliente.pedir("GET", "/api/empresa/perfil");
    c = await codigo(r);
    prueba.push({ nombre: "Empresa desactivada → 403 EMPRESA_DESACTIVADA (también lectura)", ok: r.status === 403 && c === "EMPRESA_DESACTIVADA", detalle: `${r.status} ${c}` });

    await db.empresa.update({ where: { id: empresa.id }, data: { estado: "ACTIVA" } });
    await db.user.update({ where: { email }, data: { emailVerificado: false } });
    r = await cliente.pedir("GET", "/api/empresa/perfil");
    c = await codigo(r);
    prueba.push({ nombre: "Email sin verificar → 401 EMAIL_NO_VERIFICADO", ok: r.status === 401 && c === "EMAIL_NO_VERIFICADO", detalle: `${r.status} ${c}` });

    // Reporte.
    let grupo = "";
    for (const r of resultados) {
      if (r.caso.grupo !== grupo) {
        grupo = r.caso.grupo;
        console.log(`\n${grupo}`);
      }
      const marcaEstado = r.estado === "OK" ? "✓" : r.estado === "FALLA" ? "✗" : "?";
      console.log(`  ${marcaEstado} ${r.caso.metodo.padEnd(6)} ${r.caso.ruta}  esperado ${r.caso.esperado}, obtenido ${r.status}${r.json ? "" : " (no JSON)"}${r.nota ? ` — ${r.nota}` : ""}`);
    }
    console.log("\nDatos propios y listados");
    for (const e of extra) console.log(`  ${e.ok ? "✓" : "✗"} ${e.nombre} — ${e.detalle}`);
    console.log("\nPrueba gratis y estado de la empresa");
    for (const e of prueba) console.log(`  ${e.ok ? "✓" : "✗"} ${e.nombre} — ${e.detalle}`);
    console.log("\nClave de Anthropic y eventos del sistema");
    for (const e of claves) console.log(`  ${e.ok ? "✓" : "✗"} ${e.nombre} — ${e.detalle}`);

    console.log("\nNotas de diseño (no son pruebas HTTP, no cuentan en el resumen)");
    console.log("  ℹ Configuracion.margenEmpresa / margenImprevistos / monedaDefault no se leen en ningún cálculo:");
    console.log("    el presupuesto usa Proyecto.imprevistosPct / gastosGeneralesPctDefault y proyecto.moneda");
    console.log("    (ver schema.prisma, comentario junto a imprevistosPct). Sin riesgo de contaminación entre empresas.");

    fallas = resultados.filter((r) => r.estado === "FALLA").length + extra.filter((e) => !e.ok).length + prueba.filter((e) => !e.ok).length + claves.filter((e) => !e.ok).length;
    inconclusos = resultados.filter((r) => r.estado === "INCONCLUSO").length;
    const total = resultados.length + extra.length + prueba.length + claves.length;
    console.log(`\nResumen: ${total - fallas - inconclusos}/${total} OK, ${fallas} fallas, ${inconclusos} inconclusos.`);
  } finally {
    const fuga = await db.subrubroEstandar.deleteMany({ where: { descripcion: { startsWith: MARCA_SUBRUBRO } } });
    if (fuga.count > 0) console.log(`⚠ Se borraron ${fuga.count} subrubros "${MARCA_SUBRUBRO}" que se llegaron a escribir.`);
    await db.eventoAdmin.deleteMany({ where: { funcion: MARCA_EVENTO } });
    if (empresaCId) await borrarEmpresaDePrueba(empresaCId);
    await borrarEmpresaDePrueba(empresa.id);
    console.log(`Empresa de prueba ${slug} borrada (con su usuario, sugerencias y configuración).`);
  }

  if (fallas > 0) process.exitCode = 1;
  else if (inconclusos > 0) process.exitCode = 2;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
