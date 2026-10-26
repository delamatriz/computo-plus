import { redirect } from "next/navigation";

// La guía "Cómo metrar un proyecto" vive en /metrajes (es la misma para
// cualquier proyecto). Esta ruta queda solo para que un enlace viejo no
// dé 404: redirige ahí, con ?from= para que "Volver al proyecto" lleve
// de vuelta a este proyecto.
export default async function MetrajesDeProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/metrajes?from=${encodeURIComponent(id)}`);
}
