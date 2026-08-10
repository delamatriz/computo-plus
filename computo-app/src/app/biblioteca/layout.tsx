import { AppShell } from "@/components/layout/AppShell";

export default function BibliotecaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
