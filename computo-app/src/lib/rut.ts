// RUT de empresa: la misma regla en la pantalla (/configuracion) y en todos
// los endpoints que lo reciben (perfil de empresa, /bienvenida, alta desde
// /admin). Solo números, de 10 a 12 dígitos; al tipear se aceptan puntos,
// guiones y espacios, que se descartan. No se controla el dígito verificador.

export const MENSAJE_RUT_INVALIDO = "El RUT tiene que tener solo números, entre 10 y 12 dígitos.";

/** Saca puntos, guiones y espacios ("21.234.567-0012" → "212345670012"). */
export function normalizarRut(rut: string): string {
  return rut.replace(/[\s.-]/g, "");
}

/** RUT ya normalizado: solo dígitos, entre 10 y 12. */
export function rutValido(rut: string): boolean {
  return /^\d{10,12}$/.test(rut);
}
