import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { sesionActual, esSuperadmin } from "@/lib/sesion";
import { PanelAdmin } from "@/components/admin/PanelAdmin";

// Panel de administración de la plataforma — solo SUPERADMIN. El proxy ya
// exige sesión; el rol se chequea acá (y otra vez en cada /api/admin/*).
export default async function AdminPage() {
  const sesion = await sesionActual();
  if (!sesion) redirect("/login?callbackUrl=%2Fadmin");

  if (!(await esSuperadmin(sesion))) {
    return (
      <div className="min-h-full bg-[#F0F4F8] flex items-center justify-center p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-8 py-10 max-w-md text-center">
          <ShieldAlert className="w-10 h-10 text-[#2563EB] mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-[#1A3A5C]">Acceso restringido</h1>
          <p className="text-sm text-slate-500 mt-2">
            El panel de administración es solo para usuarios SUPERADMIN.
          </p>
        </div>
      </div>
    );
  }

  return <PanelAdmin />;
}
