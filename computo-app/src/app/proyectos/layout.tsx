"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

// El Visor (/proyectos/[id]/visor) es una "pantalla de trabajo enfocada" con
// su propio mini-header (ver comentario en visor/page.tsx) — nunca quiso el
// Header global (con hamburguesa/nav) ni el Sidebar de este layout, que
// terminaba heredando igual porque los layouts de Next.js siempre anidan:
// un layout hijo no puede "optar out" de un padre solo por estructura de
// archivos, ni siquiera si ya tiene su propio contenido de header. La forma
// de excluirlo es chequear acá el pathname y saltear AppShell para esa ruta
// puntual — el Visor ya tiene su propio botón "Cerrar y volver a
// Presupuesto" para navegar, no necesita el chrome global para eso.
export default function ProyectosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname?.endsWith("/visor")) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
