import { AppShell } from "@/components/layout/AppShell";

export default function ManoDeObraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
