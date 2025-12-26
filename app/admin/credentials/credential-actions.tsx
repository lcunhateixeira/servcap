"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

type Props = {
  credentialId: string;
  status: string;
};

export default function CredentialActions({ credentialId, status }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<any>) {
    setLoading(true);
    try {
      const { error } = await action();
      if (error) alert(error.message);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        disabled={loading}
        className="border rounded px-2 py-1 text-xs"
        onClick={() =>
          run(() =>
            supabase.rpc("credential_renew", {
              p_credential_id: credentialId,
              p_note: "Renovação via admin",
            })
          )
        }
      >
        Renovar (+1 ano)
      </button>

      {status !== "suspended" && (
        <button
          disabled={loading}
          className="border rounded px-2 py-1 text-xs"
          onClick={() =>
            run(() =>
              supabase.rpc("credential_set_status", {
                p_credential_id: credentialId,
                p_status: "suspended",
                p_note: "Suspensa via admin",
              })
            )
          }
        >
          Suspender
        </button>
      )}

      {status === "suspended" && (
        <button
          disabled={loading}
          className="border rounded px-2 py-1 text-xs"
          onClick={() =>
            run(() =>
              supabase.rpc("credential_set_status", {
                p_credential_id: credentialId,
                p_status: "active",
                p_note: "Reativada via admin",
              })
            )
          }
        >
          Reativar
        </button>
      )}

      {status !== "revoked" && (
        <button
          disabled={loading}
          className="border rounded px-2 py-1 text-xs"
          onClick={() => {
            const ok = confirm("Tem certeza que deseja revogar esta credencial?");
            if (!ok) return;
            run(() =>
              supabase.rpc("credential_set_status", {
                p_credential_id: credentialId,
                p_status: "revoked",
                p_note: "Revogada via admin",
              })
            );
          }}
        >
          Revogar
        </button>
      )}
    </div>
  );
}
