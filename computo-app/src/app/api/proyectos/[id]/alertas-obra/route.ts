import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto } from "@/lib/sesion";
import { hoyUruguayISO } from "@/lib/fechaUruguay";
import type { AlertaObra } from "@/lib/alertasObra";

// GET — avisos del resto de Gestión de Obra para el Resumen de la obra:
// garantías por vencer (o vencidas), saldo de caja negativo, trámites
// rechazados y certificaciones sin presentar o con el cobro vencido. Se
// calcula acá, en una sola consulta, para no cargar cada sección al abrir la
// página.

const DIAS_AVISO_GARANTIA = 30;

const GARANTIAS = [
  ["garantiaFielCumplimientoVence", "Garantía de fiel cumplimiento"],
  ["garantiaViciosOcultosVence", "Garantía por vicios ocultos"],
  ["garantiaResponsabilidadVence", "Garantía de responsabilidad"],
] as const;

function fmtDia(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function diasEntre(desdeISO: string, hastaISO: string): number {
  return Math.round((Date.parse(hastaISO) - Date.parse(desdeISO)) / 86_400_000);
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    const proyecto = await db.proyecto.findUnique({
      where: { id },
      select: {
        garantiaFielCumplimientoVence: true,
        garantiaViciosOcultosVence: true,
        garantiaResponsabilidadVence: true,
        tramitesLegales: { where: { estado: "Rechazado" }, select: { nombre: true } },
        movimientosCaja: { select: { tipo: true, monto: true, moneda: true, fecha: true } },
        certificaciones: {
          select: {
            numero: true,
            fechaPresentacion: true,
            fechaCobroPrevisto: true,
            movimientosCaja: { where: { tipo: "Ingreso" }, select: { id: true } },
          },
          orderBy: { numero: "asc" },
        },
      },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const hoy = hoyUruguayISO();
    const alertas: AlertaObra[] = [];

    for (const [campo, nombre] of GARANTIAS) {
      const vence = proyecto[campo]?.toISOString().slice(0, 10);
      if (!vence) continue;
      const dias = diasEntre(hoy, vence);
      if (dias < 0) {
        alertas.push({ nivel: "info", seccion: "Garantías", texto: `${nombre}: venció el ${fmtDia(vence)}.` });
      } else if (dias <= DIAS_AVISO_GARANTIA) {
        alertas.push({
          nivel: "aviso",
          seccion: "Garantías",
          texto: `${nombre}: vence el ${fmtDia(vence)} (${dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`}).`,
        });
      }
    }

    // Saldo de caja a hoy, por moneda (los movimientos con fecha futura no cuentan).
    const saldo: Record<string, number> = {};
    for (const m of proyecto.movimientosCaja) {
      if (m.fecha.toISOString().slice(0, 10) > hoy) continue;
      saldo[m.moneda] = (saldo[m.moneda] ?? 0) + (m.tipo === "Ingreso" ? m.monto : -m.monto);
    }
    for (const [moneda, v] of Object.entries(saldo)) {
      if (v < -0.5) {
        alertas.push({
          nivel: "grave",
          seccion: "Flujo de Caja",
          texto: `Saldo de caja negativo: ${moneda === "USD" ? "US$" : "$"} −${Math.round(-v).toLocaleString("es-UY")}.`,
        });
      }
    }

    for (const t of proyecto.tramitesLegales) {
      alertas.push({ nivel: "grave", seccion: "Trámites", texto: `Trámite rechazado: ${t.nombre}.` });
    }

    for (const c of proyecto.certificaciones) {
      if (c.movimientosCaja.length > 0) continue;
      const cobro = c.fechaCobroPrevisto?.toISOString().slice(0, 10);
      if (cobro && cobro < hoy) {
        alertas.push({
          nivel: "aviso",
          seccion: "Certificaciones",
          texto: `Certificación Nº${c.numero}: el cobro estaba previsto para el ${fmtDia(cobro)} y no figura en Flujo de Caja.`,
        });
      } else if (!c.fechaPresentacion) {
        alertas.push({
          nivel: "info",
          seccion: "Certificaciones",
          texto: `Certificación Nº${c.numero}: sin fecha de presentación al comitente.`,
        });
      }
    }

    const orden = { grave: 0, aviso: 1, info: 2 } as const;
    alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
    return NextResponse.json(alertas);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/alertas-obra]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
