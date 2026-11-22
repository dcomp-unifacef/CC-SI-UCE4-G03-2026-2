"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileLock2,
  Leaf,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  apiFetch,
  hojeLocalISO,
  limparSessao,
  obterSessao,
  PsicologaLogada,
} from "@/lib/api";
import { FinanceiroTab } from "@/components/FinanceiroTab";

interface Paciente {
  id: number;
  nome: string;
  cpf: string;
  contato: string;
  termos_aceitos: boolean;
  saldo_sessoes: number;
}

interface Agendamento {
  id: number;
  data_hora: string;
  status: "AGENDADO" | "CONCLUIDO" | "CANCELADO";
  tipo_atendimento: "PACOTE" | "AVULSO";
  paciente_id: number;
  paciente_nome: string;
  paciente_contato: string;
  paciente_saldo_sessoes: number;
}

interface Prontuario {
  id: number;
  agendamento_id: number;
  data_sessao: string;
  data_registro: string;
  conteudo: string;
}

export default function PainelPage() {
  const router = useRouter();
  const [psicologa, setPsicologa] = useState<PsicologaLogada | null>(null);
  const [aba, setAba] = useState<"agenda" | "pacientes" | "financeiro">("agenda");

  const [dataFiltro, setDataFiltro] = useState("");
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Formulário Novo Agendamento
  const [mostrarNovoAgend, setMostrarNovoAgend] = useState(false);
  const [agPacienteId, setAgPacienteId] = useState("");
  const [agHora, setAgHora] = useState("14:00");
  const [agTipo, setAgTipo] = useState<"PACOTE" | "AVULSO">("PACOTE");

  // Formulário Novo Paciente
  const [mostrarNovoPac, setMostrarNovoPac] = useState(false);
  const [pacNome, setPacNome] = useState("");
  const [pacCpf, setPacCpf] = useState("");
  const [pacContato, setPacContato] = useState("");
  const [pacSaldo, setPacSaldo] = useState("4");
  const [pacTermos, setPacTermos] = useState(true);

  // Modal de Prontuário Criptografado (AES-256)
  const [agendamentoProntuario, setAgendamentoProntuario] =
    useState<Agendamento | null>(null);
  const [historicoProntuarios, setHistoricoProntuarios] = useState<Prontuario[]>(
    []
  );
  const [textoEvolucao, setTextoEvolucao] = useState("");
  const [salvandoProntuario, setSalvandoProntuario] = useState(false);

  const carregarPacientes = useCallback(async () => {
    const res = await apiFetch<{ pacientes: Paciente[] }>("/api/pacientes");
    setPacientes(res.pacientes);
  }, []);

  const carregarAgenda = useCallback(async () => {
  if (!dataFiltro) return;
  const res = await apiFetch<{ agendamentos: Agendamento[] }>(
    `/api/agendamentos?data=${dataFiltro}`
  );
  setAgendamentos(res.agendamentos);
}, [dataFiltro]);

useEffect(() => {
  setDataFiltro(hojeLocalISO());
}, []);

  useEffect(() => {
    const { token, psicologa: user } = obterSessao();
    if (!token || !user) {
      router.replace("/");
      return;
    }
    setPsicologa(user);
    Promise.all([carregarPacientes(), carregarAgenda()]).catch((err) => {
      setErro(err instanceof Error ? err.message : "Erro ao carregar painel.");
    });
  }, [router, carregarPacientes, carregarAgenda]);

  function sair() {
    limparSessao();
    router.push("/");
  }

  async function criarAgendamento(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    try {
      await apiFetch("/api/agendamentos", {
        method: "POST",
        body: JSON.stringify({
          paciente_id: Number(agPacienteId),
          data_hora: `${dataFiltro}T${agHora}:00`,
          tipo_atendimento: agTipo,
        }),
      });
      setAviso("Horário agendado com sucesso.");
      setMostrarNovoAgend(false);
      await carregarAgenda();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao agendar.");
    }
  }

  async function concluirAtendimento(ag: Agendamento) {
    setErro(null);
    setAviso(null);

    let body: Record<string, number> = {};
    if (ag.tipo_atendimento === "AVULSO") {
      const resposta = window.prompt(
        "Valor da sessão avulsa em R$ (opcional — cancele ou deixe vazio para não gerar fatura agora):",
        "180"
      );
      if (resposta && Number(resposta) > 0) {
        body = { valor_avulso: Number(resposta) };
      }
    }

    try {
      const res = await apiFetch<{
        mensagem: string;
        saldo_sessoes_restante: number | null;
        fatura_gerada_id: number | null;
      }>(`/api/agendamentos/${ag.id}/concluir`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      const detalhe =
        res.saldo_sessoes_restante !== null
          ? ` Saldo restante: ${res.saldo_sessoes_restante} sessão(ões).`
          : res.fatura_gerada_id
          ? ` Fatura #${res.fatura_gerada_id} lançada automaticamente.`
          : "";

      setAviso(`${res.mensagem}${detalhe}`);
      await Promise.all([carregarAgenda(), carregarPacientes()]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao concluir sessão.");
    }
  }

  async function cancelarAgendamento(id: number) {
    setErro(null);
    setAviso(null);
    try {
      await apiFetch(`/api/agendamentos/${id}`, { method: "DELETE" });
      setAviso("Agendamento cancelado.");
      await carregarAgenda();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao cancelar.");
    }
  }

  async function criarPaciente(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    try {
      await apiFetch("/api/pacientes", {
        method: "POST",
        body: JSON.stringify({
          nome: pacNome,
          cpf: pacCpf,
          contato: pacContato,
          termos_aceitos: pacTermos,
          saldo_sessoes: Number(pacSaldo || 0),
        }),
      });
      setAviso("Paciente cadastrado na sua carteira.");
      setPacNome("");
      setPacCpf("");
      setPacContato("");
      setPacSaldo("4");
      setMostrarNovoPac(false);
      await carregarPacientes();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao cadastrar paciente.");
    }
  }

  async function abrirModalProntuario(ag: Agendamento) {
    setAgendamentoProntuario(ag);
    setTextoEvolucao("");
    setHistoricoProntuarios([]);
    try {
      const res = await apiFetch<{ prontuarios: Prontuario[] }>(
        `/api/prontuarios?paciente_id=${ag.paciente_id}`
      );
      setHistoricoProntuarios(res.prontuarios);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao abrir prontuário.");
    }
  }

  async function salvarProntuario(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agendamentoProntuario) return;
    setSalvandoProntuario(true);
    setErro(null);
    try {
      await apiFetch("/api/prontuarios", {
        method: "POST",
        body: JSON.stringify({
          agendamento_id: agendamentoProntuario.id,
          conteudo: textoEvolucao,
        }),
      });
      setTextoEvolucao("");
      setAviso("Evolução salva e criptografada com AES-256-GCM.");
      const res = await apiFetch<{ prontuarios: Prontuario[] }>(
        `/api/prontuarios?paciente_id=${agendamentoProntuario.paciente_id}`
      );
      setHistoricoProntuarios(res.prontuarios);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar prontuário.");
    } finally {
      setSalvandoProntuario(false);
    }
  }

  function formatarHora(dataIso: string) {
    const dt = new Date(dataIso);
    if (Number.isNaN(dt.getTime())) return dataIso.slice(11, 16);
    return dt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (!psicologa) return null;

  return (
    <>
    <div className="min-h-screen bg-stone-50 pb-24">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-stone-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-stone-800 leading-tight">
                ArvoreSer
              </h1>
              <p className="text-xs text-stone-500">
                {psicologa.nome} • CRP {psicologa.crp}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={sair}
            className="p-2 rounded-xl text-stone-500 hover:bg-stone-100"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {erro && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {erro}
          </div>
        )}
        {aviso && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
            {aviso}
          </div>
        )}

        {/* ABA 1: AGENDA DO DIA */}
        {aba === "agenda" && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500">
                  Agenda do Dia
                </label>
                <input
                  type="date"
                  value={dataFiltro}
                  onChange={(e) => setDataFiltro(e.target.value)}
                  className="mt-1 rounded-xl border border-stone-300 px-3 py-1.5 text-sm text-stone-800"
                />
              </div>

              <button
                type="button"
                onClick={() => setMostrarNovoAgend((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Agendar
              </button>
            </div>

            {mostrarNovoAgend && (
              <form
                onSubmit={criarAgendamento}
                className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-3"
              >
                <h2 className="text-sm font-semibold text-stone-800">
                  Novo Horário ({dataFiltro})
                </h2>

                <select
                  required
                  value={agPacienteId}
                  onChange={(e) => setAgPacienteId(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-800"
                >
                  <option value="">Selecione o paciente...</option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (Saldo: {p.saldo_sessoes})
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="time"
                    required
                    value={agHora}
                    onChange={(e) => setAgHora(e.target.value)}
                    className="rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-800"
                  />
                  <select
                    value={agTipo}
                    onChange={(e) =>
                      setAgTipo(e.target.value as "PACOTE" | "AVULSO")
                    }
                    className="rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-800"
                  >
                    <option value="PACOTE">Pacote</option>
                    <option value="AVULSO">Avulso</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-semibold"
                >
                  Confirmar Horário (Bloco 60 min)
                </button>
              </form>
            )}

            {agendamentos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-500 text-sm">
                Nenhum atendimento agendado para {dataFiltro}.
              </div>
            ) : (
              <div className="space-y-3">
                {agendamentos.map((ag) => (
                  <div
                    key={ag.id}
                    className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-800">
                            <Clock className="w-4 h-4" />
                            {formatarHora(ag.data_hora)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              ag.status === "CONCLUIDO"
                                ? "bg-emerald-100 text-emerald-800"
                                : ag.status === "CANCELADO"
                                ? "bg-stone-200 text-stone-600"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {ag.status}
                          </span>
                        </div>
                        <p className="font-semibold text-stone-800 mt-1">
                          {ag.paciente_nome}
                        </p>
                        <p className="text-xs text-stone-500">
                          {ag.tipo_atendimento} • Saldo atual:{" "}
                          {ag.paciente_saldo_sessoes} sessão(ões)
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {ag.status === "AGENDADO" && (
                        <button
                          type="button"
                          onClick={() => concluirAtendimento(ag)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Concluir + Baixa
                        </button>
                      )}

                      {ag.status !== "CANCELADO" && (
                        <button
                          type="button"
                          onClick={() => abrirModalProntuario(ag)}
                          className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-100 text-stone-800 text-xs font-semibold hover:bg-stone-200"
                        >
                          <FileLock2 className="w-4 h-4 text-emerald-700" />
                          Evolução LGPD
                        </button>
                      )}

                      {ag.status === "AGENDADO" && (
                        <button
                          type="button"
                          onClick={() => cancelarAgendamento(ag.id)}
                          className="p-2 rounded-xl border border-stone-200 text-stone-500 hover:text-red-600 hover:border-red-200"
                          title="Cancelar atendimento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ABA 2: CARTEIRA DE PACIENTES */}
        {aba === "pacientes" && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-stone-800">Meus Pacientes</h2>
                <p className="text-xs text-stone-500">
                  Carteira isolada por psicóloga ({pacientes.length})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarNovoPac((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Paciente
              </button>
            </div>

            {mostrarNovoPac && (
              <form
                onSubmit={criarPaciente}
                className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-3"
              >
                <input
                  type="text"
                  required
                  value={pacNome}
                  onChange={(e) => setPacNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-800"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={pacCpf}
                    onChange={(e) => setPacCpf(e.target.value)}
                    placeholder="CPF (000.000.000-00)"
                    className="rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-800"
                  />
                  <input
                    type="text"
                    required
                    value={pacContato}
                    onChange={(e) => setPacContato(e.target.value)}
                    placeholder="WhatsApp / Telefone"
                    className="rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-800"
                  />
                </div>
                <input
                  type="number"
                  min={0}
                  value={pacSaldo}
                  onChange={(e) => setPacSaldo(e.target.value)}
                  placeholder="Saldo inicial de sessões"
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-800"
                />
                <label className="flex items-center gap-2 text-xs text-stone-600">
                  <input
                    type="checkbox"
                    checked={pacTermos}
                    onChange={(e) => setPacTermos(e.target.checked)}
                    className="accent-emerald-700"
                  />
                  Paciente aceitou o Termo de Consentimento LGPD
                </label>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-semibold"
                >
                  Cadastrar Paciente
                </button>
              </form>
            )}

            <div className="space-y-2.5">
              {pacientes.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-sm text-stone-800">
                      {p.nome}
                    </p>
                    <p className="text-xs text-stone-500">
                      {p.contato} • CPF {p.cpf}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                    {p.saldo_sessoes} sessões
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ABA 3: FINANCEIRO E RATEIO */}
        {aba === "financeiro" && (
          <FinanceiroTab
            pacientes={pacientes}
            onSaldoAtualizado={carregarPacientes}
          />
        )}
      </main>

      {/* MODAL DE PRONTUÁRIO CRIPTOGRAFADO */}
      {agendamentoProntuario && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[88vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                  Prontuário — {agendamentoProntuario.paciente_nome}
                </h3>
                <p className="text-xs text-stone-500">
                  Criptografado em repouso com AES-256-GCM
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAgendamentoProntuario(null)}
                className="p-2 rounded-xl text-stone-500 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarProntuario} className="space-y-3">
              <textarea
                required
                rows={4}
                value={textoEvolucao}
                onChange={(e) => setTextoEvolucao(e.target.value)}
                placeholder="Registre a evolução rápida da sessão (máx. 1 minuto)..."
                className="w-full rounded-xl border border-stone-300 p-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                disabled={salvandoProntuario}
                className="w-full py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                {salvandoProntuario
                  ? "Criptografando..."
                  : "Salvar Evolução desta Sessão"}
              </button>
            </form>

            <div className="pt-2 border-t border-stone-200 space-y-2.5">
              <h4 className="text-xs font-semibold uppercase text-stone-500">
                Histórico Descriptografado ({historicoProntuarios.length})
              </h4>
              {historicoProntuarios.length === 0 ? (
                <p className="text-xs text-stone-500">
                  Nenhuma evolução registrada para este paciente ainda.
                </p>
              ) : (
                historicoProntuarios.map((pr) => (
                  <div
                    key={pr.id}
                    className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1"
                  >
                    <p className="text-[11px] font-semibold text-emerald-800">
                      Sessão #{pr.agendamento_id} •{" "}
                      {String(pr.data_sessao).slice(0, 10)}
                    </p>
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">
                      {pr.conteudo}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGAÇÃO INFERIOR MOBILE-FIRST */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200">
        <div className="max-w-lg mx-auto grid grid-cols-3">
          <button
            type="button"
            onClick={() => setAba("agenda")}
            className={`py-3 flex flex-col items-center gap-1 text-xs font-semibold ${
              aba === "agenda" ? "text-emerald-700" : "text-stone-500"
            }`}
          >
            <Calendar className="w-5 h-5" />
            Agenda
          </button>
          <button
            type="button"
            onClick={() => setAba("pacientes")}
            className={`py-3 flex flex-col items-center gap-1 text-xs font-semibold ${
              aba === "pacientes" ? "text-emerald-700" : "text-stone-500"
            }`}
          >
            <Users className="w-5 h-5" />
            Pacientes
          </button>
          <button
            type="button"
            onClick={() => setAba("financeiro")}
            className={`py-3 flex flex-col items-center gap-1 text-xs font-semibold ${
              aba === "financeiro" ? "text-emerald-700" : "text-stone-500"
            }`}
          >
            <Wallet className="w-5 h-5" />
            Rateio
          </button>
        </div>
      </nav>
    </div>
    </>
  );
}