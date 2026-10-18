"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// MercadoPago devuelve al usuario acá después de pagar (back_url). Esta URL NO confirma nada: el
// estado real de la cuenta lo cambia el webhook de MercadoPago. Por eso solo se muestra
// "Procesando…" y a los 3 segundos se manda al login con el aviso de que la cuenta se activa en
// unos minutos (el login muestra el mensaje con ?aviso=pago).
export default function ConfirmacionPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace("/login?aviso=pago"), 3000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F0F4F8] px-4 py-12 font-sans flex flex-col items-center justify-center text-center">
      <p className="text-4xl font-bold tracking-tight text-[#1A3A5C]">CÓMPUTO+</p>
      <p className="text-sm text-slate-500 mt-1">Presupuestación de Obra Premium</p>
      <div role="status" className="mt-10 flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
        <p className="text-lg font-semibold text-[#1A3A5C]">Procesando tu pago...</p>
      </div>
    </div>
  );
}
