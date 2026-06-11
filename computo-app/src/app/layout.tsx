import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { CalculadoraFlotante } from "@/components/CalculadoraFlotante";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CÓMPUTO+ — Presupuestación de Obra Premium",
  description: "Sistema profesional de presupuestación de obras de construcción para Uruguay",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${dmSans.variable} h-full`}>
      <body className="h-full font-sans antialiased bg-bg-base text-text-primary">
        {children}
        <CalculadoraFlotante />
      </body>
    </html>
  );
}
