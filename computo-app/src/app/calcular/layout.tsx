import { AppShell } from "@/components/layout/AppShell";

export default function CalcularLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
