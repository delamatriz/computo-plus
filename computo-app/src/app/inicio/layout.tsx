import { AppShell } from "@/components/layout/AppShell";

export default function InicioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
