"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RenderCredentialButton({
  credentialId,
}: {
  credentialId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
      alert(e?.message ?? "Erro ao gerar credencial");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={loading}
      className="border rounded px-3 py-2 text-sm font-semibold"
    >
      {loading ? "Gerando..." : "Gerar / Regenerar credencial"}
    </button>
  );
}
