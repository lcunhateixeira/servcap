import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PeopleEditForm from "./people-edit-form";
import DeletePersonButton from "./delete-person-button";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPersonDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const supabase = await createClient();

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", auth.user.id)
        .single();

    if (!profile || profile.role !== "super_admin") redirect("/dashboard");

    const { data: person, error } = await supabase
        .from("people")
        .select("id, full_name, birth_date, cpf, photo_url, created_at")
        .eq("id", id)
        .single();

    if (error || !person) {
        return (
            <main className="p-6 space-y-4">
                <h1 className="text-2xl font-bold">Pessoa</h1>
                <p className="text-red-600">Pessoa não encontrada.</p>
                <Link className="underline" href="/admin/people">
                    Voltar
                </Link>
            </main>
        );
    }

    return (
        <main className="p-6 space-y-4">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Pessoa</h1>
                    <p className="text-sm opacity-70">{person.id}</p>
                </div>

                <Link className="underline" href="/admin/people">
                    ← Voltar
                </Link>

            </header>

            <section className="border rounded p-4 space-y-3">
                <div className="flex items-start gap-4">
                    {person.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={person.photo_url}
                            alt="Foto"
                            className="h-24 w-24 rounded object-cover border"
                        />
                    ) : (
                        <div className="h-24 w-24 rounded border flex items-center justify-center text-xs opacity-70">
                            sem foto
                        </div>
                    )}

                    <div className="text-sm space-y-1">
                        <div>
                            <span className="opacity-70">Nome: </span>
                            <strong>{person.full_name}</strong>
                        </div>
                        <div>
                            <span className="opacity-70">Nascimento: </span>
                            {person.birth_date
                                ? new Date(person.birth_date).toLocaleDateString("pt-BR")
                                : "-"}
                        </div>
                    </div>
                </div>
            </section>

            <section className="border rounded p-4">
                <h2 className="font-semibold mb-3">Editar</h2>
                <PeopleEditForm person={person} />
            </section>
            <div className="flex items-center gap-3">
                <DeletePersonButton personId={person.id} />
            </div>

        </main>
    );
}
