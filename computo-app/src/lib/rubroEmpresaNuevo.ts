// Alta de un rubro desde cero en Mis rubros (SubrubroEmpresa + APUEmpresa),
// sin copiarlo de un proyecto. Tipos compartidos entre el formulario
// (cliente) y POST /api/mi-biblioteca/crear (servidor). Las líneas son las
// mismas que las del alta en el catálogo global (EditorAPU).

import type { EquipoRubroNuevo, ManoObraRubroNuevo, MaterialRubroNuevo } from "@/lib/rubroCatalogoNuevo";

export interface RubroEmpresaNuevo {
  nombre: string;
  unidad: string;
  /** precioReferencia = precio cargado a mano (opcional). */
  materiales: MaterialRubroNuevo[];
  manoObra: ManoObraRubroNuevo[];
  /** costoReferencia = costo cargado a mano (opcional). */
  equipos: EquipoRubroNuevo[];
}

export interface RubroEmpresaCreado<TSubrubro = unknown> {
  /** El rubro creado, con la misma forma que cada elemento de GET /api/mi-biblioteca. */
  subrubro: TSubrubro;
  /** Líneas que quedaron sin precio (no se cargó y no resuelven contra el catálogo). */
  lineasSinPrecio: string[];
}
