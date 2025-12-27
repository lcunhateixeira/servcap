"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeletePersonButton({ personId }: { personId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const ok = confirm(
      "Tem certeza que deseja excluir esta pessoa?\n\n" +
        "Esta ação não remove o histórico de credenciais."
    );
    if (!ok) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/admin/people/${personId}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao excluir");

      router.push("/admin/people");
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Erro ao excluir");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="border border-red-500 text-red-600 rounded px-3 py-2 text-sm font-semibold"
    >
      {loading ? "Excluindo..." : "Excluir pessoa"}
    </button>
  );
}
