"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) return alert(error.message);
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-3 border rounded p-4">
        <h1 className="text-xl font-bold">Login</h1>

        <input className="border p-2 w-full rounded" placeholder="Email"
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <input className="border p-2 w-full rounded" placeholder="Senha"
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button disabled={loading} className="border p-2 w-full rounded font-semibold">
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-sm">
          Não tem conta? <a className="underline" href="/signup">Criar conta</a>
        </p>
      </form>
    </main>
  );
}
