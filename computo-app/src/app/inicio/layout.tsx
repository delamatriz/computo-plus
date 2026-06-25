import { Header } from "@/components/layout/Header";

export default function InicioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto bg-bg-base overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
