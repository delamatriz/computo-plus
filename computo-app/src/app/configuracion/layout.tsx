import { AppShell } from "@/components/layout/AppShell";

export default function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
