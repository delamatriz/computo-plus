import { AlertTriangle, BadgeCheck, Clock, HelpCircle } from "lucide-react";

// Badge de gobernanza FEAT-AI-006 — compartido entre la biblioteca de
// solo lectura (/rubros) y el editor real de proyecto (DrawerAPU en
// proyectos/[id]/page.tsx). Antes vivía solo en /rubros; el dato nunca
// llegaba al editor real porque MaterialAPU/EquipoAPU (los modelos del
// proyecto, distintos de MaterialAPUEstandar/EquipoAPUEstandar de la
// biblioteca) no tenían motivoVerificacion — ver el campo agregado en
// esos dos modelos y su propagación en /clonar-apu.
export interface FuenteMaterial {
  proveedor: string | null;
  // Nota de procedencia/metodología cuando el precio no viene de un
  // proveedor comercial real (ver investigación proveedor/notaProcedencia)
  // — cuenta como "fuente resuelta" para el badge, igual que proveedor.
  notaProcedencia?: string | null;
  nombreProducto: string | null;
  urlReferencia: string | null;
  fechaUltimaVerificacion: string | null;
  requiereVerificacion: boolean;
  motivoVerificacion: string | null;
}

// Motivos específicos que ya puede setear el job de verificación
// periódica de precios (FEAT-AI-006, scripts/verificar-precios-mercado.ts
// / src/lib/verificarPrecioMercado.ts) cuando algo necesita revisión
// humana — cada uno con su propio texto, en vez de caer todos en el
// genérico "Requiere verificación". "sin_precio_referencia" se maneja
// aparte (ver abajo) porque es un caso conocido/aceptado, no un problema.
//
// Cualquier OTRO valor de motivoVerificacion (derivado_recalculo_
// proporcional, derivado_modelo_regresion, tarifa_oficial_organismo,
// fuente_debil_cruzada, sin_cotizacion_fresca, etc.) es una
// clasificación de fuente legítima, no una alerta — no entra acá a
// propósito, para no marcar como "problema" un material que en
// realidad tiene precio real, solo de otro origen.
const ETIQUETAS_MOTIVO_ESPECIFICO: Record<string, string> = {
  variacion_alta: "Variación alta",
  producto_no_encontrado: "No encontrado",
  fuente_no_disponible: "Fuente no disponible",
  sin_costo_referencia: "Sin costo de referencia", // equipos, ver EquipoAPU.motivoVerificacion
};

interface BadgeVerificacionProps {
  fuente: FuenteMaterial;
  // Solo lo pasa el drawer del APU (proyectos/[id]/page.tsx) para el caso
  // "Pendiente de verificar" de un material — deep-link a la ficha en
  // /materiales (ver irAMaterialPendiente). El resto de los usos
  // (biblioteca /rubros, equipos, otros estados del badge) no lo pasan,
  // así que siguen siendo un <span> no interactivo, sin cambios.
  onClickPendiente?: () => void;
}

export function BadgeVerificacion({ fuente, onClickPendiente }: BadgeVerificacionProps) {
  // Marca puntual — caso conocido y aceptado (honorarios profesionales,
  // materiales sin fuente de mercado confiable), no un problema a
  // resolver. Estilo neutro (slate), no ámbar, a propósito.
  if (fuente.motivoVerificacion === "sin_precio_referencia") {
    return (
      <span
        title="Sin precio de referencia — a cotizar directamente"
        className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide whitespace-nowrap"
      >
        <HelpCircle className="w-2.5 h-2.5" />
        A cotizar
      </span>
    );
  }

  const etiquetaEspecifica = fuente.motivoVerificacion
    ? ETIQUETAS_MOTIVO_ESPECIFICO[fuente.motivoVerificacion]
    : undefined;

  if (etiquetaEspecifica || fuente.requiereVerificacion) {
    return (
      <span
        title={fuente.motivoVerificacion ?? "Requiere verificación"}
        className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-wide whitespace-nowrap"
      >
        <AlertTriangle className="w-2.5 h-2.5" />
        {etiquetaEspecifica ?? "Requiere verificación"}
      </span>
    );
  }

  if (fuente.proveedor || fuente.notaProcedencia) {
    // Elegible para el job de verificación de precios (FEAT-AI-006) pero
    // todavía sin ninguna corrida real encima — fechaUltimaVerificacion
    // null es la señal (limpiada de backfills falsos, ver
    // scripts/limpiar-fecha-verificacion-falsa.ts). Estilo neutro
    // (slate/azul), a propósito distinto del ámbar de alerta y del verde
    // de confirmado — "todavía no lo chequeamos" no es un problema.
    if (!fuente.fechaUltimaVerificacion) {
      if (onClickPendiente) {
        return (
          <button
            type="button"
            onClick={onClickPendiente}
            title="Todavía no pasó por el job de verificación de precios de mercado — click para revisarlo en Materiales"
            className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide whitespace-nowrap hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <Clock className="w-2.5 h-2.5" />
            Pendiente de verificar
          </button>
        );
      }
      return (
        <span
          title="Todavía no pasó por el job de verificación de precios de mercado"
          className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide whitespace-nowrap"
        >
          <Clock className="w-2.5 h-2.5" />
          Pendiente de verificar
        </span>
      );
    }

    const fecha = new Date(fuente.fechaUltimaVerificacion).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
    return (
      <span
        title={`Verificado ${fecha}`}
        className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-wide whitespace-nowrap"
      >
        <BadgeCheck className="w-2.5 h-2.5" />
        Verificado
      </span>
    );
  }

  return null;
}
