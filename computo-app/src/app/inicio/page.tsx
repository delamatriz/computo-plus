import { db } from "@/lib/db";
import { sesionActual } from "@/lib/sesion";
import { redirect } from "next/navigation";
import { estadoEfectivo } from "@/lib/acceso";
import { CUPO_CALCULOS_RAPIDOS, CUPO_PROYECTOS_ASISTIDOS } from "@/lib/config-prueba";
import { BannerTrialDashboard } from "@/components/acceso/BannerTrialDashboard";
import InicioContenido from "./InicioContenido";

export const dynamic = "force-dynamic";

export default async function InicioPage() {
  const sesion = await sesionActual();
  if (!sesion) redirect("/login");

  // Datos del trial
  const empresa = await db.empresa.findUnique({
    where: { id: sesion.empresaId },
    select: { estado: true, fechaVencimientoPrueba: true },
  });
  const esPrueba = empresa && estadoEfectivo(empresa) === "PRUEBA";
  const diasRestantes = esPrueba && empresa.fechaVencimientoPrueba
    ? Math.max(0, Math.ceil((empresa.fechaVencimientoPrueba.getTime() - Date.now()) / 86_400_000))
    : null;
  const mostrarBanner = esPrueba && diasRestantes !== null && diasRestantes > 10;
  const [crUsados, iaUsados] = mostrarBanner
    ? await Promise.all([
        db.consumoFuncionesAsistidas.count({ where: { empresaId: sesion.empresaId, tipo: "calculo_rapido" } }),
        db.consumoFuncionesAsistidas.count({ where: { empresaId: sesion.empresaId, tipo: "proyecto_ia" } }),
      ])
    : [0, 0];

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      {mostrarBanner && diasRestantes !== null && (
        <div className="max-w-4xl mx-auto w-full px-6 pt-6">
          <BannerTrialDashboard
            diasRestantes={diasRestantes}
            crUsados={crUsados}
            crLimite={CUPO_CALCULOS_RAPIDOS}
            proyectosIAUsados={iaUsados}
            proyectosIALimite={CUPO_PROYECTOS_ASISTIDOS}
          />
        </div>
      )}
      <InicioContenido />
    </div>
  );
}
