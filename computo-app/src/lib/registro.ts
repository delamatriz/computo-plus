// Helpers del registro público (oct-2026): códigos y tokens hasheados,
// validaciones, slug de la empresa y rate limit por IP. Flujo y modelo en
// prisma/schema.prisma → VerificacionPendiente.

import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  CODIGO_DIGITOS,
  CODIGO_MAX_INTENTOS,
  PASSWORD_LARGO_MINIMO,
  REENVIO_ESPERA_SEG,
  REENVIO_MAXIMO,
  REGISTROS_POR_HORA_POR_IP,
} from "@/lib/config-prueba";

/** Cookie httpOnly que autoriza completar /bienvenida después de verificar. */
export const COOKIE_BIENVENIDA = "cp_bienvenida";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarEmail(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toLowerCase() : "";
}

export function emailValido(email: string): boolean {
  return email.length <= 254 && EMAIL_VALIDO.test(email);
}

export function passwordValida(password: unknown): password is string {
  // 72: límite de bcrypt (lo que sigue se ignora al hashear).
  return typeof password === "string" && password.length >= PASSWORD_LARGO_MINIMO && password.length <= 72;
}

/** Hay usuario con ese email (sin distinguir mayúsculas). */
export async function existeUsuarioConEmail(email: string): Promise<boolean> {
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  return !!user;
}

// ── Códigos y tokens ───────────────────────────────────────────────────

export function hashear(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

/** true si `valor` corresponde al hash guardado (comparación en tiempo constante). */
export function coincideHash(valor: string, hashGuardado: string): boolean {
  const a = Buffer.from(hashear(valor), "hex");
  const b = Buffer.from(hashGuardado, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function generarCodigo(): string {
  return randomInt(0, 10 ** CODIGO_DIGITOS).toString().padStart(CODIGO_DIGITOS, "0");
}

export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * 60_000);
}

/** Estado de una verificación pendiente, tal como lo ve la pantalla /verificar. */
export function estadoVerificacion(p: { intentos: number; reenvios: number; ultimoEnvio: Date; venceEn: Date }, ahora = new Date()) {
  const esperaMs = p.ultimoEnvio.getTime() + REENVIO_ESPERA_SEG * 1000 - ahora.getTime();
  return {
    intentosRestantes: Math.max(0, CODIGO_MAX_INTENTOS - p.intentos),
    reenviosRestantes: Math.max(0, REENVIO_MAXIMO - p.reenvios),
    segundosParaReenvio: Math.max(0, Math.ceil(esperaMs / 1000)),
    bloqueado: p.intentos >= CODIGO_MAX_INTENTOS,
    vencido: p.venceEn.getTime() <= ahora.getTime(),
  };
}

// ── Datos de /bienvenida ───────────────────────────────────────────────

/** ?o= de la portada: corto, solo minúsculas/números/guiones. null si no sirve. */
export function sanitizarOrigen(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  return limpio || null;
}

/** Slug único a partir del nombre de la empresa (ej. "Estudio Pérez" → "estudio-perez"). */
export async function generarSlugEmpresa(nombre: string): Promise<string> {
  const base =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "empresa";
  for (let i = 0; i < 20; i++) {
    const candidato = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await db.empresa.findUnique({ where: { slug: candidato }, select: { id: true } }))) return candidato;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

// ── Rate limit ─────────────────────────────────────────────────────────

// En memoria: alcanza con una sola instancia (dev, y Render con un único
// proceso). Se pierde al reiniciar y no se comparte entre instancias.
// TODO: pasar a Redis (o una tabla) si la app corre en más de una instancia.
const intentosPorIp = new Map<string, number[]>();
const UNA_HORA_MS = 60 * 60_000;

/** Registra un intento de registro de esa IP; false si ya superó el límite de la última hora. */
export function permitirRegistroDesdeIp(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (intentosPorIp.get(ip) ?? []).filter((t) => ahora - t < UNA_HORA_MS);
  if (recientes.length >= REGISTROS_POR_HORA_POR_IP) {
    intentosPorIp.set(ip, recientes);
    return false;
  }
  recientes.push(ahora);
  intentosPorIp.set(ip, recientes);
  // Limpieza ocasional para que el Map no crezca sin límite.
  if (intentosPorIp.size > 5000) {
    for (const [k, v] of intentosPorIp) if (v.every((t) => ahora - t >= UNA_HORA_MS)) intentosPorIp.delete(k);
  }
  return true;
}

/**
 * IP del cliente. Primero los headers que pone el proxy de borde y el cliente
 * no puede falsear (true-client-ip / cf-connecting-ip); x-forwarded-for queda
 * de respaldo porque su primer valor lo puede mandar el propio cliente.
 * TODO: confirmar en Render qué header llega con la IP real (ver logs de un
 * registro en producción) y quedarse solo con ese.
 */
export function ipDelPedido(req: NextRequest): string {
  const h = req.headers;
  return (
    h.get("true-client-ip")?.trim() ||
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "desconocida"
  );
}
