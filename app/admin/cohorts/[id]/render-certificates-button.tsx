"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RenderCertificatesButton({ cohortId }: { cohortId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    const ok = confirm("Gerar certificados para todos os alunos com status 'concluído'?");
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cohorts/${cohortId}/certifications/render`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao gerar certificados");

      if (json.failed?.length) {
        alert(`Gerou ${json.generated}/${json.total}. Falharam: ${json.failed.length}`);
      } else {
        alert(`Gerou ${json.generated}/${json.total} certificados com sucesso.`);
      }

      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Erro ao gerar certificados");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      disabled={loading}
      onClick={run}
      className="border rounded px-3 py-2 text-sm font-semibold"
    >
      {loading ? "Gerando..." : "Gerar certificados (concluídos)"}
    </button>
  );
}
