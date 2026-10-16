import { AppShell } from "@/components/layout/AppShell";

export default function ObrasEnCursoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
