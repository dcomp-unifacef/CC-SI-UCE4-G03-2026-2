export interface PsicologaLogada {
  id: number;
  nome: string;
  crp: string;
  email: string;
}

const TOKEN_KEY = "arvoreser_token";
const USER_KEY = "arvoreser_psicologa";

export function salvarSessao(token: string, psicologa: PsicologaLogada) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(psicologa));
}

export function obterSessao(): {
  token: string | null;
  psicologa: PsicologaLogada | null;
} {
  if (typeof window === "undefined") {
    return { token: null, psicologa: null };
  }
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token || !rawUser) {
    return { token: null, psicologa: null };
  }
  try {
    return { token, psicologa: JSON.parse(rawUser) as PsicologaLogada };
  } catch {
    return { token: null, psicologa: null };
  }
}

export function limparSessao() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const { token } = obterSessao();
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.erro || `Erro HTTP ${res.status}`);
  }

  return data as T;
}

export function hojeLocalISO(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function mesAtualLocal(): string {
  return hojeLocalISO().slice(0, 7);
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}