import { AppShell } from "@/components/layout/AppShell";

export default function RecetasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
