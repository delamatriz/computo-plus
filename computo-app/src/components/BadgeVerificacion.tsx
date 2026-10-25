import Link from "next/link";
import { AlertTriangle, BadgeCheck, Clock, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  // Mismos nombres que la versión con acción del APU (ver ACCION_MOTIVO abajo).
  variacion_alta: "Precio desactualizado",
  producto_no_encontrado: "No encontrado",
  fuente_no_disponible: "No se pudo verificar",
  sin_costo_referencia: "Sin costo de referencia", // equipos, ver EquipoAPU.motivoVerificacion
};

// Versión "con acción" de los mismos estados (APU del presupuesto): dice qué
// hacer. Los que terminan en "revisá en Materiales" son clickeables.
const ACCION_MOTIVO: Record<string, string> = {
  variacion_alta: "Precio desactualizado — revisá en Materiales",
  producto_no_encontrado: "No encontrado en catálogo — revisá en Materiales",
};
// Marcado para revisar (requiereVerificacion) sin un motivo con nombre propio.
const ACCION_REQUIERE_VERIFICACION = "Requiere verificación — revisá en Materiales";
// Con texto de acción pero no clickeables: en /materiales no hay nada que hacer, se resuelve con el proveedor.
const ACCION_MOTIVO_SIN_CLICK: Record<string, string> = {
  fuente_no_disponible: "No se pudo verificar — confirmá con tu proveedor",
};
// "sin_precio_referencia" también lo tienen materiales CON precio (rubros
// generados desde Cálculo rápido guardan el monto estimado con ese motivo):
// ahí no es "sin precio" sino un precio estimado.
const ACCION_SIN_PRECIO = "Sin precio — cotizá con tu proveedor";
const ACCION_PRECIO_ESTIMADO = "Precio estimado — cotizá con tu proveedor";
// El nombre del estado ("Sin verificar" / "Pendiente de verificar" para el SUPERADMIN) sale de etiquetaPendiente.
const sufijoSinVerificar = " — revisá el precio en Materiales";

const BASE = "flex-shrink-0 flex items-center gap-1 rounded-[4px] border whitespace-nowrap";
// Badge corto de siempre (mayúsculas) y badge con acción (texto normal, más legible).
const ESTILO_CORTO = "text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wide";
const ESTILO_ACCION = "text-[10px] font-semibold px-1.5 py-0.5";
const AMBAR = "bg-amber-50 text-amber-600 border-amber-200";
const AMBAR_CLICK = "hover:bg-amber-100 hover:text-amber-700 transition-colors";

interface BadgeVerificacionProps {
  fuente: FuenteMaterial;
  // Solo lo pasa el drawer del APU (proyectos/[id]/page.tsx): activa los
  // textos con acción y vuelve clickeables los que mandan a /materiales
  // (deep-link a la ficha, ver urlMaterialEnCatalogo). El resto de los usos
  // (biblioteca /rubros, /materiales, equipos) no lo pasan y siguen con el
  // badge corto, no interactivo. Es un <Link>, no un <button>, a propósito:
  // el <fieldset disabled> del panel en un presupuesto entregado desactiva
  // los controles de formulario pero no los links, y mirar el material en
  // /materiales no modifica el presupuesto.
  hrefRevisarEnMateriales?: string;
  // Solo con hrefRevisarEnMateriales: si el material ya tiene un precio cargado,
  // "sin precio de referencia" se muestra como "Precio estimado".
  tienePrecio?: boolean;
  // /rubros lo pasa para quien no es SUPERADMIN: "Pendiente de verificar"
  // es un estado interno del job de precios.
  ocultarPendiente?: boolean;
  // Nombre del estado "nunca verificado". Sin pasarlo: "Pendiente de
  // verificar" en el badge corto y "Sin verificar" en el con acción. El
  // SUPERADMIN ve "Pendiente de verificar" en todas las pantallas.
  etiquetaPendiente?: string;
}

export function BadgeVerificacion({
  fuente,
  hrefRevisarEnMateriales,
  tienePrecio = false,
  ocultarPendiente,
  etiquetaPendiente,
}: BadgeVerificacionProps) {
  const conAccion = !!hrefRevisarEnMateriales;

  // Marca puntual — caso conocido y aceptado (honorarios profesionales,
  // materiales sin fuente de mercado confiable), no un problema a
  // resolver. Estilo neutro (slate), no ámbar, a propósito.
  if (fuente.motivoVerificacion === "sin_precio_referencia") {
    return (
      <span
        title={
          conAccion && tienePrecio
            ? "Precio estimado, sin precio de referencia de mercado — confirmalo con tu proveedor"
            : "Sin precio de referencia — a cotizar directamente"
        }
        className={cn(BASE, conAccion ? ESTILO_ACCION : ESTILO_CORTO, "bg-slate-100 text-slate-500 border-slate-200")}
      >
        <HelpCircle className="w-2.5 h-2.5" />
        {conAccion ? (tienePrecio ? ACCION_PRECIO_ESTIMADO : ACCION_SIN_PRECIO) : "Sin precio"}
      </span>
    );
  }

  const etiquetaEspecifica = fuente.motivoVerificacion
    ? ETIQUETAS_MOTIVO_ESPECIFICO[fuente.motivoVerificacion]
    : undefined;

  if (etiquetaEspecifica || fuente.requiereVerificacion) {
    const accion = conAccion && fuente.motivoVerificacion ? ACCION_MOTIVO[fuente.motivoVerificacion] : undefined;
    const accionSinClick =
      conAccion && fuente.motivoVerificacion ? ACCION_MOTIVO_SIN_CLICK[fuente.motivoVerificacion] : undefined;
    if (accionSinClick) {
      return (
        <span title="La verificación automática no pudo consultar la fuente del precio" className={cn(BASE, ESTILO_ACCION, AMBAR)}>
          <AlertTriangle className="w-2.5 h-2.5" />
          {accionSinClick}
        </span>
      );
    }
    if (accion) {
      return (
        <Link
          href={hrefRevisarEnMateriales!}
          title={`${etiquetaEspecifica} — click para revisarlo en Materiales`}
          className={cn(BASE, ESTILO_ACCION, AMBAR, AMBAR_CLICK)}
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          {accion}
        </Link>
      );
    }
    if (conAccion && !etiquetaEspecifica) {
      return (
        <Link
          href={hrefRevisarEnMateriales!}
          title="El precio de este material necesita revisión — click para revisarlo en Materiales"
          className={cn(BASE, ESTILO_ACCION, AMBAR, AMBAR_CLICK)}
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          {ACCION_REQUIERE_VERIFICACION}
        </Link>
      );
    }
    return (
      <span
        // Nombre legible (mismo mapa que el texto del badge), nunca el código interno del motivo.
        title={etiquetaEspecifica ?? "Requiere verificación"}
        className={cn(BASE, ESTILO_CORTO, AMBAR)}
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
    // scripts/_historico/limpiar-fecha-verificacion-falsa.ts). Ámbar — mismo color
    // que el reloj de "sin verificar" en la lista de rubros (mismo estado,
    // misma señal).
    if (!fuente.fechaUltimaVerificacion) {
      if (ocultarPendiente) return null;
      if (conAccion) {
        return (
          <Link
            href={hrefRevisarEnMateriales!}
            title="Precio de referencia de fuente de mercado — click para revisarlo en Materiales"
            className={cn(BASE, ESTILO_ACCION, AMBAR, AMBAR_CLICK)}
          >
            <Clock className="w-2.5 h-2.5" />
            {(etiquetaPendiente ?? "Sin verificar") + sufijoSinVerificar}
          </Link>
        );
      }
      return (
        <span title="Precio de referencia de fuente de mercado" className={cn(BASE, ESTILO_CORTO, AMBAR)}>
          <Clock className="w-2.5 h-2.5" />
          {etiquetaPendiente ?? "Pendiente de verificar"}
        </span>
      );
    }

    const fecha = new Date(fuente.fechaUltimaVerificacion).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
    return (
      <span
        title={`Verificado ${fecha}`}
        className={cn(BASE, ESTILO_CORTO, "bg-emerald-50 text-emerald-600 border-emerald-200")}
      >
        <BadgeCheck className="w-2.5 h-2.5" />
        Verificado
      </span>
    );
  }

  return null;
}
