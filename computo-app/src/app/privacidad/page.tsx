import type { Metadata } from "next";
import { PaginaLegal } from "@/components/registro/PaginaLegal";

export const metadata: Metadata = { title: "Política de privacidad — CÓMPUTO+" };

// TODO(Luis): reemplazar por el texto definitivo.
export default function PrivacidadPage() {
  return (
    <PaginaLegal titulo="Política de privacidad">
      <p>Texto provisorio: la política de privacidad de CÓMPUTO+ se publica próximamente.</p>
    </PaginaLegal>
  );
}
