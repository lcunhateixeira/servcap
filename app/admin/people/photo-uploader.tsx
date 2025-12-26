"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  personId: string;
  currentPhotoUrl?: string | null;
};

export default function PhotoUploader({ personId, currentPhotoUrl }: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleUpload(file: File) {
  setLoading(true);
  setErrorMsg(null);

  try {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Envie um arquivo de imagem (jpg/png/webp).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Imagem muito grande. Máximo recomendado: 2MB.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`/api/admin/people/${personId}/photo`, {
      method: "POST",
      body: fd,
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Falha no upload");

    router.refresh();
  } catch (e: any) {
    setErrorMsg(e?.message ?? "Erro ao enviar foto");
  } finally {
    setLoading(false);
  }
}


  return (
    <div className="space-y-2">
      {currentPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentPhotoUrl}
          alt="Foto"
          className="h-16 w-16 rounded object-cover border"
        />
      ) : (
        <div className="h-16 w-16 rounded border flex items-center justify-center text-xs opacity-70">
          sem foto
        </div>
      )}

      <label className="inline-block border rounded px-2 py-1 text-xs cursor-pointer">
        {loading ? "Enviando..." : "Enviar foto"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
      </label>

      {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
    </div>
  );
}
