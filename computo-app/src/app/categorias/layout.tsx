import { AppShell } from "@/components/layout/AppShell";

export default function CategoriasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
