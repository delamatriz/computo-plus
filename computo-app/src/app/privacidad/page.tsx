import type { Metadata } from "next";
import { PaginaLegal, META } from "@/components/registro/PaginaLegal";

export const metadata: Metadata = { title: "Política de Privacidad — CÓMPUTO+" };

export default function PrivacidadPage() {
  return (
    <PaginaLegal titulo="CÓMPUTO+ — Política de Privacidad">
      <p className={META}>Versión: 1.0</p>
      <p className={META}>Fecha de vigencia: 18 de octubre de 2026</p>
      <p className={META}>Responsable del tratamiento: Luis Eduardo Rodríguez, servicios personales, Uruguay</p>
      <p className={META}>Contacto: computo@delamatriz.com</p>

      <h2>1. Introducción</h2>
      <p>
        CÓMPUTO+ (computo.delamatriz.com) respeta la privacidad de sus usuarios y se compromete a proteger sus datos personales
        conforme a la Ley N° 18.331 de Protección de Datos Personales y Acción de Habeas Data de la República Oriental del Uruguay
        y su Decreto Reglamentario N° 414/009.
      </p>
      <p>
        Esta Política describe qué datos se recopilan, cómo se utilizan, con quién se comparten y qué derechos tiene el usuario
        sobre ellos.
      </p>
    </PaginaLegal>
  );
}
