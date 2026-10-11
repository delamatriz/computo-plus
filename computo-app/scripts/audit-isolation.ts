// Auditoría HTTP de aislamiento multi-tenant (oct-2026).
//
// Crea una empresa de prueba ("B", slug audit-<timestamp>) con un usuario de
// rol USUARIO, inicia sesión con NextAuth por HTTP contra el dev server y
// verifica que:
//   1. Sobre datos de OTRAS empresas (proyectos, rubros, sugerencias) recibe
//      404 JSON — nunca los datos, nunca un 200.
//   2. Los listados (/api/proyectos, /api/sugerencias) no incluyen nada ajeno.
//   3. Lo propio funciona: /api/empresa/perfil y /api/configuracion-empresa
//      devuelven la empresa B, y un PATCH de configuración no toca a las demás.
//   4. Las rutas solo-SUPERADMIN devuelven 403.
// Al final borra todo lo que creó (en un finally, aunque algo falle).
//
// Seguridad sobre datos reales (DATABASE_URL apunta a producción):
//  - Sobre datos de otras empresas solo se hacen GET, salvo el PATCH de
//    sugerencia, que manda el MISMO valor de `resuelta` que ya tiene: aunque
//    el aislamiento fallara, no cambia nada.
//  - Quedan afuera los GET que crean filas de forma perezosa
//    (leyes-sociales): si el aislamiento fallara, escribirían en un proyecto
//    real.
//  - Las rutas SUPERADMIN se prueban con body vacío: el 403 sale antes de
//    leer el body.
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
  console.log(`Casos de 404/403: ${casos.length} + 4 chequeos de datos propios/listados`);

  if (!APLICAR) {
    for (const c of casos) console.log(`  ${c.grupo.padEnd(18)} ${c.metodo.padEnd(6)} ${c.ruta}  → espera ${c.esperado}`);
    console.log("\nDry-run: se crearía una empresa audit-<timestamp> + un usuario USUARIO, y se borrarían al final.");
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
    data: { nombre: `AUDITORÍA ${marca}`, slug, rut: `AUDIT-${marca}`, plan: "basico" },
  });
  console.log(`\nEmpresa de prueba creada: ${empresa.nombre} (${empresa.id})`);

  let fallas = 0;
  let inconclusos = 0;
  try {
    await db.user.create({
      data: { email, nombre: "Usuario auditoría", rol: "USUARIO", empresaId: empresa.id, passwordHash: await bcrypt.hash(password, 10) },
    });

    const cliente = new Cliente();
    await cliente.login(email, password);
    console.log("Login OK como usuario de prueba (rol USUARIO).\n");

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

    fallas = resultados.filter((r) => r.estado === "FALLA").length + extra.filter((e) => !e.ok).length;
    inconclusos = resultados.filter((r) => r.estado === "INCONCLUSO").length;
    const total = resultados.length + extra.length;
    console.log(`\nResumen: ${total - fallas - inconclusos}/${total} OK, ${fallas} fallas, ${inconclusos} inconclusos.`);
  } finally {
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
