import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export default async function DashboardPage() {
  const supabase = await createClient(); // ✅ AQUI
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Bem-vindo, {data.user.email}</p>
      <LogoutButton />
    </main>
  );
}
