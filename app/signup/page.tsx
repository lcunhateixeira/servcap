"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);

    alert("Conta criada! Se o Supabase exigir confirmação por email, verifique sua caixa de entrada.");
    router.push("/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSignup} className="w-full max-w-sm space-y-3 border rounded p-4">
        <h1 className="text-xl font-bold">Criar conta</h1>

        <input className="border p-2 w-full rounded" placeholder="Email"
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <input className="border p-2 w-full rounded" placeholder="Senha"
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="border p-2 w-full rounded font-semibold">
          Cadastrar
        </button>

        <p className="text-sm">
          Já tem conta? <a className="underline" href="/login">Entrar</a>
        </p>
      </form>
    </main>
  );
}
