"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RenderCertificateButton({ certificationId }: { certificationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/certifications/${certificationId}/render`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao gerar certificado");
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Erro ao gerar certificado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button disabled={loading} onClick={run} className="border rounded px-3 py-2 text-sm font-semibold">
      {loading ? "Gerando..." : "Gerar / Regenerar certificado"}
    </button>
  );
}
