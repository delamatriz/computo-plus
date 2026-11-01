// Avisos de Gestión de Obra que muestra el Resumen de la obra — los arma
// GET /api/proyectos/[id]/alertas-obra.
export interface AlertaObra {
  nivel: "grave" | "aviso" | "info";
  seccion: string;
  texto: string;
}
