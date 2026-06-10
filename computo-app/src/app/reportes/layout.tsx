import { AppShell } from "@/components/layout/AppShell";

export default function ReportesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
