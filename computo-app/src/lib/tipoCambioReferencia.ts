// Sin dependencias (lo importan el servidor y el navegador): valor de
// referencia del dólar cuando todavía no hay ninguna cotización del BCU
// guardada en la base (ver lib/tipoCambio.ts).
export const TIPO_CAMBIO_REFERENCIA = 42.5;

export interface TipoCambioVigente {
  /** Pesos por dólar (TCV del BCU, o el de referencia). */
  valor: number;
  /** Fecha del cierre del BCU (aaaa-mm-dd), o null si es el de referencia. */
  fecha: string | null;
  fuente: "BCU" | "referencia";
}
