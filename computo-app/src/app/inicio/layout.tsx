import { AppShell } from "@/components/layout/AppShell";

// Antes tenía su propio layout standalone (solo <Header/>, sin Sidebar
// en absoluto) — por eso en mobile no había ninguna forma de abrir un
// menú de navegación desde acá, ni hamburguesa ni drawer (bug real,
// visto en producción). Pasa a usar AppShell como el resto de las
// páginas para heredar el mismo Sidebar/drawer mobile sin duplicar esa
// lógica, pero con dockSidebarOnDesktop=false: /inicio es una landing
// centrada sin nav fija en desktop (y sus propias tarjetas de "Cálculo
// rápido"/"Nuevo proyecto" ya cubren esas dos acciones — un sidebar
// docked ahí las duplicaría) — ver Sidebar.tsx/AppShell.tsx.
export default function InicioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell dockSidebarOnDesktop={false}>{children}</AppShell>;
}
