// Proyecto en el que está trabajando el usuario, según la URL: /proyectos/<id>
// y cualquier subruta (/visor, /metrajes…). /proyectos/nuevo no es un id real:
// sin esa exclusión "Volver al proyecto" apuntaría a una pantalla sin nada a
// donde volver. Lo usan el Sidebar y la campanita del Header para armar los
// links que conservan el proyecto de origen (ver BotonVolverAlProyecto).
export function proyectoIdDesdePath(pathname: string | null): string | null {
  const m = pathname?.match(/^\/proyectos\/([^/]+)/);
  return m && m[1] !== "nuevo" ? m[1] : null;
}

/** Agrega al link el proyecto de origen, con el formato ?from=proyecto&proyectoId=<id>. */
export function conProyectoDeOrigen(href: string, proyectoId: string | null): string {
  if (!proyectoId) return href;
  const [sinHash, hash] = href.split("#");
  const sep = sinHash.includes("?") ? "&" : "?";
  return `${sinHash}${sep}from=proyecto&proyectoId=${encodeURIComponent(proyectoId)}${hash ? `#${hash}` : ""}`;
}
