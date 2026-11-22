"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ShieldCheck } from "lucide-react";
import {
  apiFetch,
  obterSessao,
  PsicologaLogada,
  salvarSessao,
} from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [nome, setNome] = useState("");
  const [crp, setCrp] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    const { token } = obterSessao();
    if (token) {
      router.replace("/painel");
    }
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    try {
      if (modo === "cadastro") {
        await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ nome, crp, email, senha }),
        });
        setSucesso("Cadastro realizado! Agora faça login com seu e-mail e senha.");
        setModo("login");
        setSenha("");
      } else {
        const res = await apiFetch<{
          token: string;
          psicologa: PsicologaLogada;
        }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, senha }),
        });
        salvarSessao(res.token, res.psicologa);
        router.push("/painel");
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao autenticar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-stone-200 p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
            <Leaf className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800">ArvoreSer</h1>
          <p className="text-sm text-stone-500 mt-1">
            Gestão clínica pensada para o intervalo de 10 minutos
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setModo("login");
              setErro(null);
            }}
            className={`py-2 text-sm font-medium rounded-lg transition ${
              modo === "login"
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-stone-600"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setModo("cadastro");
              setErro(null);
              setSucesso(null);
            }}
            className={`py-2 text-sm font-medium rounded-lg transition ${
              modo === "cadastro"
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-stone-600"
            }`}
          >
            Criar Conta
          </button>
        </div>

        {erro && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
            {sucesso}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {modo === "cadastro" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Dra. Beatriz Souza"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Registro CRP
                </label>
                <input
                  type="text"
                  required
                  value={crp}
                  onChange={(e) => setCrp(e.target.value)}
                  placeholder="06/987654"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
              E-mail profissional
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="beatriz@arvoreser.com"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold text-sm transition"
          >
            {carregando
              ? "Processando..."
              : modo === "login"
              ? "Acessar Agenda"
              : "Cadastrar Psicóloga"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-center gap-2 text-xs text-stone-500">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Prontuários isolados por CRP com criptografia AES-256</span>
        </div>
      </div>
    </main>
    </>
  );
}