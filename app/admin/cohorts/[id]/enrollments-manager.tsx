"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type EnrollmentRow = {
    id: string;
    person_id: string;
    status: string;
    created_at: string;
    people?: { full_name?: string } | null;
};

type PeopleRow = {
    id: string;
    full_name: string;
};

const STATUS_OPTIONS = ["matriculado", "em andamento", "concluído", "cancelado"] as const;

export default function EnrollmentsManager({
    cohortId,
    initialEnrollments,
}: {
    cohortId: string;
    initialEnrollments: EnrollmentRow[];
}) {
    const router = useRouter();

    const [enrollments, setEnrollments] = useState(initialEnrollments);
    
    useEffect(() => {
        setEnrollments(initialEnrollments);
    }, [initialEnrollments]);

    // --- search people
    const [q, setQ] = useState("");
    const [peopleResults, setPeopleResults] = useState<PeopleRow[]>([]);
    const [selected, setSelected] = useState<PeopleRow | null>(null);
    const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("matriculado");

    const [loadingSearch, setLoadingSearch] = useState(false);
    const [loadingAdd, setLoadingAdd] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const enrolledIds = useMemo(() => new Set(enrollments.map((e) => e.person_id)), [enrollments]);

    useEffect(() => {
        const t = setTimeout(async () => {
            const term = q.trim();
            if (term.length < 2) {
                setPeopleResults([]);
                return;
            }
            setLoadingSearch(true);
            try {

                const res = await fetch(`/api/admin/people?q=${encodeURIComponent(term)}&page=1`, {
                    method: "GET",
                    headers: { "Accept": "application/json" },
                });

                const contentType = res.headers.get("content-type") ?? "";
                const text = await res.text();

                console.log("people search status:", res.status);
                console.log("people search content-type:", contentType);
                console.log("people search body (first 200):", text.slice(0, 200));

                if (!contentType.includes("application/json")) {
                    throw new Error("Resposta não é JSON (provavelmente HTML). Veja logs acima.");
                }

                const json = JSON.parse(text);
                // Aceita vários formatos comuns:
                // 1) array direto
                // 2) { rows: [...] }
                // 3) { data: [...] }
                // 4) { data: { rows: [...] } }
                // 5) { items: [...] }
                const rowsRaw =
                    (Array.isArray(json) && json) ||
                    (Array.isArray(json?.rows) && json.rows) ||
                    (Array.isArray(json?.data) && json.data) ||
                    (Array.isArray(json?.data?.rows) && json.data.rows) ||
                    (Array.isArray(json?.items) && json.items) ||
                    [];

                const mapped = rowsRaw
                    .map((r: any) => ({
                        id: r.id,
                        full_name: r.full_name ?? r.name ?? "",
                    }))
                    .filter((r: any) => r.id && r.full_name);

                setPeopleResults(mapped);

            } catch (e) {
                console.error("Erro na busca de people:", e);
                setPeopleResults([]);
            } finally {
                setLoadingSearch(false);
            }
        }, 350);

        return () => clearTimeout(t);
    }, [q]);

    async function addEnrollment() {
        if (!selected) return;

        if (enrolledIds.has(selected.id)) {
            alert("Esta pessoa já está matriculada nesta turma.");
            return;
        }

        setLoadingAdd(true);
        try {
            const res = await fetch(`/api/admin/cohorts/${cohortId}/enrollments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ person_id: selected.id, status }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? "Falha ao adicionar aluno");

            // atualiza UI de forma simples: refaz a página
            setSelected(null);
            setQ("");
            setPeopleResults([]);
            router.refresh();
        } catch (e: any) {
            alert(e?.message ?? "Erro ao adicionar aluno");
        } finally {
            setLoadingAdd(false);
        }
    }

    async function updateStatus(enrollmentId: string, newStatus: string) {
        setBusyId(enrollmentId);
        try {
            const res = await fetch(`/api/admin/enrollments/${enrollmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? "Falha ao atualizar status");

            router.refresh();
        } catch (e: any) {
            alert(e?.message ?? "Erro ao atualizar");
        } finally {
            setBusyId(null);
        }
    }

    async function removeEnrollment(enrollmentId: string) {
        const ok = confirm("Remover esta matrícula da turma?");
        if (!ok) return;

        setBusyId(enrollmentId);
        try {
            const res = await fetch(`/api/admin/enrollments/${enrollmentId}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? "Falha ao remover matrícula");
            router.refresh();
        } catch (e: any) {
            alert(e?.message ?? "Erro ao remover");
        } finally {
            setBusyId(null);
        }
    }

    async function renderOne(personId: string) {
        setBusyId(personId);
        try {
            const res = await fetch(`/api/admin/cohorts/${cohortId}/certifications/render-one`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ person_id: personId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? "Falha ao gerar certificado");

            // abre o detalhe do certificado para revisar/baixar
            if (json.certificationId) {
                router.push(`/admin/certifications/${json.certificationId}`);
                return;
            }

            router.refresh();
        } catch (e: any) {
            alert(e?.message ?? "Erro ao gerar certificado");
        } finally {
            setBusyId(null);
        }
    }

    // render
    return (
        <div className="space-y-4">
            {/* Add student */}
            <div className="border rounded p-3 space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                        <label className="text-xs opacity-70">Buscar pessoa</label>
                        <input
                            value={q}
                            onChange={(e) => {
                                setQ(e.target.value);
                                setSelected(null);
                            }}
                            placeholder="Digite pelo menos 2 letras..."
                            className="border rounded w-full p-2 text-sm"
                        />
                        {loadingSearch && <p className="text-xs opacity-60 mt-1">Buscando…</p>}
                        {!!peopleResults.length && !selected && (
                            <div className="mt-2 border rounded max-h-56 overflow-auto">
                                {peopleResults.map((p) => {
                                    const disabled = enrolledIds.has(p.id);
                                    return (
                                        <button
                                            type="button"
                                            key={p.id}
                                            disabled={disabled}
                                            className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-50"
                                                }`}
                                            onClick={() => setSelected(p)}
                                        >
                                            {p.full_name}
                                            {disabled ? " (já matriculado)" : ""}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {selected && (
                            <p className="text-xs mt-2">
                                Selecionado: <strong>{selected.full_name}</strong>{" "}
                                <button className="underline" type="button" onClick={() => setSelected(null)}>
                                    trocar
                                </button>
                            </p>
                        )}
                    </div>

                    <div className="w-full sm:w-52">
                        <label className="text-xs opacity-70">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                            className="border rounded w-full p-2 text-sm"
                        >
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="sm:self-end">
                        <button
                            type="button"
                            disabled={!selected || loadingAdd}
                            onClick={addEnrollment}
                            className="border rounded px-3 py-2 text-sm font-semibold w-full sm:w-auto"
                        >
                            {loadingAdd ? "Adicionando..." : "Adicionar na turma"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border rounded">
                <table className="min-w-[980px] w-full text-sm">
                    <thead className="bg-zinc-50">
                        <tr className="text-left">
                            <th className="p-3">Aluno</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {enrollments.length ? (
                            enrollments.map((row) => {
                                const canRender = row.status === "concluído";
                                const busy = busyId === row.id || busyId === row.person_id;

                                return (
                                    <tr key={row.id} className="border-t">
                                        <td className="p-3">{row.people?.full_name ?? "-"}</td>

                                        <td className="p-3">
                                            <select
                                                value={row.status}
                                                disabled={busy}
                                                className="border rounded px-2 py-1 text-xs"
                                                onChange={(e) => updateStatus(row.id, e.target.value)}
                                            >
                                                {STATUS_OPTIONS.map((s) => (
                                                    <option key={s} value={s}>
                                                        {s}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        <td className="p-3">
                                            <div className="flex gap-3 flex-wrap">
                                                <button
                                                    type="button"
                                                    className={`underline ${!canRender ? "opacity-40 cursor-not-allowed" : ""}`}
                                                    disabled={!canRender || busy}
                                                    onClick={() => renderOne(row.person_id)}
                                                >
                                                    Gerar certificado
                                                </button>

                                                <button
                                                    type="button"
                                                    className="underline text-red-600"
                                                    disabled={busy}
                                                    onClick={() => removeEnrollment(row.id)}
                                                >
                                                    Remover
                                                </button>
                                            </div>

                                            {!canRender && (
                                                <p className="text-xs opacity-50 mt-1">
                                                    Para gerar certificado, status precisa ser <strong>concluído</strong>.
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td className="p-3" colSpan={3}>
                                    <span className="opacity-70">Nenhum aluno nesta turma.</span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-xs opacity-60">
                Dica: marque como <strong>concluído</strong> e gere individualmente, ou use o botão de geração em lote no topo.
            </p>
        </div>
    );
}
