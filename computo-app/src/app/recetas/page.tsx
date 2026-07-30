import { redirect } from "next/navigation";

// "Descompuestos" se fusionó con "Rubros" en la pantalla única de Biblioteca.
export default function RecetasRedirect() {
  redirect("/rubros");
}
