import { formatDateBR } from "@/lib/formatters/date";
import { formatCPF } from "@/lib/formatters/helper";
import { createClient } from "@/lib/supabase/server";

export default async function CredentialPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_public_credential", {
    p_token: token,
  });

  const row = Array.isArray(data) ? data[0] : null;

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Credencial</h1>
        <p className="mt-4 text-red-600">Erro: {error.message}</p>
      </main>
    );
  }

  if (!row) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Credencial</h1>
        <p className="mt-4">Credencial não encontrada.</p>
      </main>
    );
  }

  const kindLabel =
    row.kind === "chaplain" ? "Capelão" : "Serviço de Capelania";

  const validNow =
    row.status === "active" && new Date(row.expires_at) > new Date();

  return (
    <main className="p-6 max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">Verificação de Credencial</h1>

      <div className="border rounded p-4 space-y-2">
        <p className="text-lg font-semibold">
          {validNow ? "✅ Credencial válida" : "❌ Credencial inválida"}
        </p>

        <p><b>Número:</b> {row.credential_number}</p>
        <p><b>Nome:</b> {row.full_name}</p>
        <p><b>Nascimento:</b> {formatDateBR(row.birth_date)}</p>
        <p><b>CPF:</b> {formatCPF(row.cpf)}</p>
        <p><b>Título:</b> {kindLabel}</p>
        <p>
          <b>Igreja:</b> {row.church_name}{" "}
          {row.church_cnpj ? `— ${row.church_cnpj}` : ""}
        </p>
        <p>
          <b>Validade:</b>{" "}
          {new Date(row.expires_at).toLocaleDateString("pt-BR")}
        </p>
        <p><b>Status:</b> {row.status}</p>
      </div>
    </main>
  );
}
