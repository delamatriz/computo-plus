import type { Metadata } from "next";
import { PaginaLegal } from "@/components/registro/PaginaLegal";

export const metadata: Metadata = { title: "Términos y condiciones — CÓMPUTO+" };

// TODO(Luis): reemplazar por el texto definitivo.
export default function TerminosPage() {
  return (
    <PaginaLegal titulo="Términos y condiciones">
      <p>Texto provisorio: los términos y condiciones de uso de CÓMPUTO+ se publican próximamente.</p>
    </PaginaLegal>
  );
}
