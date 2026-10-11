import { AppShell } from "@/components/layout/AppShell";

export default function MiBibliotecaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
