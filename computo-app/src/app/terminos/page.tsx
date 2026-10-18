import type { Metadata } from "next";
import { PaginaLegal, META } from "@/components/registro/PaginaLegal";

export const metadata: Metadata = { title: "Términos y Condiciones de Uso — CÓMPUTO+" };

export default function TerminosPage() {
  return (
    <PaginaLegal titulo="CÓMPUTO+ — Términos y Condiciones de Uso">
      <p className={META}>Versión: 1.0</p>
      <p className={META}>Fecha de vigencia: 18 de octubre de 2026</p>
      <p className={META}>Prestador del servicio: Luis Eduardo Rodríguez, servicios personales, Uruguay</p>

      <h2>1. Aceptación de los términos</h2>
      <p>
        Al crear una cuenta en CÓMPUTO+ (disponible en computo.delamatriz.com) y utilizar el servicio, el usuario acepta quedar
        vinculado por los presentes Términos y Condiciones. Si no está de acuerdo con alguna de las condiciones aquí establecidas,
        no debe utilizar el servicio.
      </p>
      <p>
        El uso continuado de CÓMPUTO+ después de la publicación de modificaciones a estos Términos implica la aceptación de dichas
        modificaciones.
      </p>

      <h2>2. Descripción del servicio</h2>
      <p>
        CÓMPUTO+ es una plataforma SaaS (Software como Servicio) de presupuestación y gestión de obras de construcción, orientada
        al mercado uruguayo. El servicio incluye herramientas para cómputo métrico, análisis de precios unitarios, generación de
        presupuestos, gestión de obra y funcionalidades asistidas por inteligencia artificial.
      </p>
    </PaginaLegal>
  );
}
