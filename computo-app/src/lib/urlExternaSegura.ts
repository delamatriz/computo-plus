// Descarga de imágenes por URL desde el servidor sin abrir la puerta a SSRF
// (auditoría de seguridad nov-2026, hallazgo #3): que alguien use nuestro
// servidor para pedir direcciones internas (red privada de Render, metadata
// de la nube, localhost) y ver la respuesta.
//
// No alcanza con mirar el texto del hostname: "127.0.0.1.nip.io" parece
// externo y apunta a la propia máquina. Por eso se resuelve el DNS y se
// valida cada IP, y no se siguen redirecciones (una URL externa podría
// redirigir a una interna). Queda una ventana chica entre la resolución y la
// descarga (DNS rebinding); para cerrarla del todo habría que fijar la IP en
// la conexión.

import { lookup } from "dns/promises";
import { isIP } from "net";

const MB = 1024 * 1024;
export const MAX_BYTES_IMAGEN_EXTERNA = 5 * MB;
const TIMEOUT_MS = 10_000;

const HOSTS_INTERNOS = ["localhost", "0.0.0.0"];
const SUFIJOS_INTERNOS = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

/** IPv4 o IPv6 privada, de loopback, link-local, reservada o de metadata. */
export function esIpInterna(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || // 0.0.0.0/8
      a === 10 || // 10.0.0.0/8
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT)
      (a === 169 && b === 254) || // link-local y metadata de la nube
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 192 && b === 0) || // 192.0.0.0/24, 192.0.2.0/24
      (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15
      a >= 224 // multicast y reservadas
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    // IPv4 embebida (::ffff:10.0.0.1, o en hexa ::ffff:a00:1 como la deja
    // new URL()): se valida la parte IPv4.
    const v4 = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4) return esIpInterna(v4[1]);
    const v4hex = s.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (v4hex) {
      const alto = parseInt(v4hex[1], 16);
      const bajo = parseInt(v4hex[2], 16);
      return esIpInterna(`${alto >> 8}.${alto & 255}.${bajo >> 8}.${bajo & 255}`);
    }
    // Otras formas que pueden apuntar a IPv4 (NAT64, 6to4, IPv4-compatible): no se confía.
    if (/^(64:ff9b:|2002:|::\d)/.test(s) || /^::[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(s)) return true;
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s); // únicas locales, link-local, multicast
  }
  return true; // si no es una IP válida, no se confía
}

/**
 * Valida una URL para descargarla desde el servidor. Devuelve la URL ya
 * parseada si es https a un host público; null si no.
 */
export async function urlExternaSegura(texto: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (HOSTS_INTERNOS.includes(host) || SUFIJOS_INTERNOS.some((s) => host.endsWith(s))) return null;
  if (isIP(host)) return esIpInterna(host) ? null : url;
  try {
    const direcciones = await lookup(host, { all: true });
    if (direcciones.length === 0 || direcciones.some((d) => esIpInterna(d.address))) return null;
  } catch {
    return null;
  }
  return url;
}

/**
 * Descarga una imagen de una URL externa segura: sin seguir redirecciones,
 * con timeout, solo si el servidor dice que es una imagen y hasta
 * MAX_BYTES_IMAGEN_EXTERNA. null si algo no cierra.
 */
export async function descargarImagenExterna(texto: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const url = await urlExternaSegura(texto);
  if (!url) return null;
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status !== 200) return null;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) return null;
    const largo = Number(res.headers.get("content-length") ?? 0);
    if (largo > MAX_BYTES_IMAGEN_EXTERNA || !res.body) return null;
    // Se lee de a pedazos y se corta apenas pasa el tope, aunque el servidor
    // no haya mandado content-length (o haya mentido).
    const partes: Uint8Array[] = [];
    let total = 0;
    const lector = res.body.getReader();
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES_IMAGEN_EXTERNA) {
        await lector.cancel();
        return null;
      }
      partes.push(value);
    }
    return { buffer: Buffer.concat(partes), contentType };
  } catch {
    return null;
  }
}
