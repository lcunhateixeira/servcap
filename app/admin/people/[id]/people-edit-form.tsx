"use client";

import { formatCPF } from "@/lib/formatters/helper";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Person = {
    id: string;
    full_name: string;
    birth_date: string | null;
    cpf?: string | null;
    photo_url?: string | null;
};

export default function PeopleEditForm({ person }: { person: Person }) {
    const router = useRouter();
    const [fullName, setFullName] = useState(person.full_name ?? "");
    const [birthDate, setBirthDate] = useState(person.birth_date ?? "");
    const [cpf, setCpf] = useState(person.cpf ?? "");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMsg(null);

        try {
            const res = await fetch(`/api/admin/people/${person.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    full_name: fullName.trim(),
                    birth_date: birthDate || null,
                    cpf: cpf || null,
                }),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? "Falha ao salvar");

            setMsg("Salvo com sucesso!");
            router.refresh();
        } catch (err: any) {
            setMsg(err?.message ?? "Erro ao salvar");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSave} className="space-y-3 max-w-lg">
            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" htmlFor="full_name">
                    Nome completo
                </label>
                <input
                    id="full_name"
                    className="border rounded p-2 text-sm"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                />
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" htmlFor="birth_date">
                    Data de nascimento
                </label>
                <input
                    id="birth_date"
                    type="date"
                    className="border rounded p-2 text-sm"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" htmlFor="cpf">CPF</label>
                <input
                    id="cpf"
                    className="border rounded p-2 text-sm"
                    value={formatCPF(cpf)}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                />
            </div>
            <div className="flex items-center gap-2">
                <button
                    disabled={loading}
                    className="border rounded px-3 py-2 text-sm font-semibold"
                >
                    {loading ? "Salvando..." : "Salvar"}
                </button>

                {msg && <span className="text-sm">{msg}</span>}
            </div>
        </form>
    );
}
