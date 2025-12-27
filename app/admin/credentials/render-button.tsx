"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RenderButton({ credentialId }: { credentialId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/credentials/${credentialId}/render`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao gerar");

      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={loading}
      className="border rounded px-2 py-1 text-xs"
    >
      {loading ? "Gerando..." : "Gerar credencial"}
    </button>
  );
}
