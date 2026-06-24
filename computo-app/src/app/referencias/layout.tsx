import { AppShell } from "@/components/layout/AppShell";

export default function ReferenciasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
