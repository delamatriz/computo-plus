import { AppShell } from "@/components/layout/AppShell";

export default function MaterialesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
