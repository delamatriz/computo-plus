import { AppShell } from "@/components/layout/AppShell";

export default function SugerenciasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
