import { AppShell } from "@/components/layout/AppShell";

export default function LeyesSocialesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
