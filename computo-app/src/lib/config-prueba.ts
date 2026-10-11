// Configuración central del registro público y la prueba gratis (oct-2026).
// Todo lo que Luis puede querer cambiar vive acá: número de WhatsApp, días de
// prueba, cupos de funciones asistidas y tiempos de la verificación por mail.
// Ningún otro archivo hardcodea estos valores.

/** WhatsApp de contacto, con código de país y sin "+" (formato wa.me). */
export const WHATSAPP_NUMERO = "59899372600";

/** Días de prueba gratis desde que se completa el alta en /bienvenida. */
export const DIAS_PRUEBA = 30;

/** Cupos de funciones asistidas de una empresa en PRUEBA. */
export const CUPO_CALCULOS_RAPIDOS = 3;
export const CUPO_PROYECTOS_ASISTIDOS = 1;

/** Remitente de los mails transaccionales (dominio a verificar en Resend). */
export const MAIL_REMITENTE = "CÓMPUTO+ <no-responder@delamatriz.com>";

// ── Verificación por mail ──────────────────────────────────────────────
export const CODIGO_DIGITOS = 6;
export const CODIGO_VIGENCIA_MIN = 15;
export const CODIGO_MAX_INTENTOS = 5;
export const REENVIO_ESPERA_SEG = 120;
export const REENVIO_MAXIMO = 3;
/** Ventana para completar /bienvenida después de verificar el mail. */
export const BIENVENIDA_VIGENCIA_MIN = 30;
/** Ventana del token de ingreso automático tras completar /bienvenida. */
export const INGRESO_VIGENCIA_MIN = 5;

// ── Registro ───────────────────────────────────────────────────────────
export const PASSWORD_LARGO_MINIMO = 8;
/** Rate limit de POST /api/registro por IP. */
export const REGISTROS_POR_HORA_POR_IP = 5;
/** Clave de sessionStorage donde la portada guarda el ?o= (origen del registro). */
export const CLAVE_ORIGEN = "cp_origen";

// ── Mensajes de cupo agotado (servidor y pantallas usan los mismos) ───
export function mensajeCupoCalculoRapido(limite: number): string {
  if (limite <= 0) return "El Cálculo Rápido no está incluido en tu prueba gratis. Escribinos para activarlo.";
  return `Usaste ${limite === 1 ? "el Cálculo Rápido" : `los ${limite} Cálculos Rápidos`} de la prueba gratis. Escribinos para seguir usándolo.`;
}

/** proyectos: nombres de los proyectos que ya usan el cupo (pueden faltar). */
export function mensajeCupoProyectoAsistido(limite: number, proyectos: string[] = []): string {
  if (limite <= 0) {
    return "Las sugerencias automáticas no están incluidas en tu prueba gratis. Podés cargar todo a mano, o escribinos para activarlas.";
  }
  const cuantos = limite === 1 ? "un proyecto" : `${limite} proyectos`;
  const donde = proyectos.length > 0 ? ` y ya las usaste en ${proyectos.map((p) => `«${p}»`).join(", ")}` : " y ya las usaste";
  return `Las sugerencias automáticas de la prueba gratis son para ${cuantos}${donde}. En este proyecto podés seguir cargando todo a mano, o escribinos para activarlas.`;
}

// ── Links de WhatsApp ──────────────────────────────────────────────────
function linkWhatsApp(texto: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
}

/** "¿No te llegó el código?" en /verificar. */
export function whatsappCodigoNoLlego(email: string): string {
  return linkWhatsApp(`Hola, no me llegó el código de verificación. Mi email es ${email}`);
}

/** "Contactanos" desde la app (aviso de prueba, funciones no disponibles). */
export function whatsappContacto(email: string): string {
  return linkWhatsApp(`Hola, quiero consultar por mi cuenta de CÓMPUTO+. Mi email es ${email}`);
}
