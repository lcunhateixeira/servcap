"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <><div>
      <label className="px-3 py-2 rounded text-red-600 text-sm" onClick={logout}>Sair</label></div>
    {/* <button onClick={logout} className="border p-2 rounded size-sm text-sm">
        Sair
      </button> */}
    </>
  );
}
