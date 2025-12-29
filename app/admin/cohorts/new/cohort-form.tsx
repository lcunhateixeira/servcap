"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CohortForm({ courses }: { courses: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          name,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao criar turma");
      router.push(`/admin/cohorts/${json.id}`);
    } catch (err: any) {
      alert(err?.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 max-w-xl">
      <label className="block text-sm">
        Curso
        <select className="border rounded w-full p-2 mt-1" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Nome da turma
        <input className="border rounded w-full p-2 mt-1" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="flex gap-3">
        <label className="block text-sm flex-1">
          Início
          <input type="date" className="border rounded w-full p-2 mt-1" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className="block text-sm flex-1">
          Fim
          <input type="date" className="border rounded w-full p-2 mt-1" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
      </div>

      <button disabled={loading} className="border rounded px-3 py-2 text-sm font-semibold">
        {loading ? "Salvando..." : "Criar turma"}
      </button>
    </form>
  );
}
