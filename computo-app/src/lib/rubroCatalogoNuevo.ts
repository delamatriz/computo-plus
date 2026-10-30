// Alta de un rubro en el catálogo global (SubrubroEstandar + APUEstandar)
// desde /rubros — solo SUPERADMIN. Tipos compartidos entre el formulario
// (cliente) y POST /api/subrubros-estandar/crear (servidor).

export interface MaterialRubroNuevo {
  descripcion: string;
  unidad: string;
  /** Cantidad de material por unidad de rubro. */
  rendimiento: number;
  /** Precio de respaldo: se usa solo si la descripción no resuelve contra el catálogo de materiales. */
  precioReferencia: number | null;
}

export interface ManoObraRubroNuevo {
  /** Nombre exacto de una CategoriaLaboral (el jornal se resuelve en vivo por nombre). */
  categoria: string;
  /** Unidades de rubro producidas por jornada. */
  rendimiento: number;
}

export interface EquipoRubroNuevo {
  descripcion: string;
  unidad: string;
  /** Cantidad de equipo (horas, días…) por unidad de rubro. */
  rendimiento: number;
  /** Costo de respaldo: se usa solo si la descripción no resuelve contra el catálogo de equipos. */
  costoReferencia: number | null;
}

export interface RubroCatalogoNuevo {
  /** CapituloCatalogo existente; o null con `capituloNuevo` para crear uno. */
  capituloId: string | null;
  capituloNuevo: string | null;
  descripcion: string;
  unidad: string;
  activo: boolean;
  materiales: MaterialRubroNuevo[];
  manoObra: ManoObraRubroNuevo[];
  equipos: EquipoRubroNuevo[];
}

export interface RubroCatalogoCreado {
  id: string;
  codigo: string;
  capituloId: string;
  precioUY: number;
  activo: boolean;
  /** Líneas que quedaron sin precio (no resuelven contra el catálogo y no tienen respaldo). */
  lineasSinPrecio: string[];
}
