import { AppShell } from "@/components/layout/AppShell";

// Mismo chrome (Header + Sidebar) que el resto de las secciones. Antes
// /metrajes no tenía layout propio porque solo redirigía a
// /proyectos/[id]/metrajes (que hereda el de /proyectos); desde que muestra
// la guía directamente quedaba sin Sidebar.
export default function MetrajesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
