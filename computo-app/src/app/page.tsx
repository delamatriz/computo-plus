import { redirect } from "next/navigation";

// La raíz es el portal: va directo al login. La landing pública vive en
// /landing (ver src/app/landing/page.tsx).
export default function RaizPage() {
  redirect("/login");
}
