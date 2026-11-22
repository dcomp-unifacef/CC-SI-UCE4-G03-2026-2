"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, RefreshCw, Wallet } from "lucide-react";
import {
  apiFetch,
  formatarMoeda,
  hojeLocalISO,
  mesAtualLocal,
} from "@/lib/api";

export interface PacienteResumo {
  id: number;
  nome: string;
  saldo_sessoes: number;
}

interface FaturaItem {
  id: number;
  valor: number;
  vencimento: string;
  status_pagamento: "PENDENTE" | "PAGO" | "CANCELADO";
  paciente_id: number;
  paciente_nome: string;
}

interface RateioResponse {
  mes_referencia: string;
  percentual_clinica: number;
  resumo_clinica: {
    total_recebido: number;
    total_pendente: number;
    total_retencao_clinica: number;
    total_repasse_socias: number;
  };
  rateio_por_psicologa: {
    psicologa_id: number;
    psicologa_nome: string;
    crp: string;
    qtd_faturas_pagas: number;
    qtd_faturas_pendentes: number;
    total_recebido: number;
    total_pendente: number;
    retencao_clinica: number;
    repasse_liquido: number;
  }[];
}

interface FinanceiroTabProps {
  pacientes: PacienteResumo[];
  onSaldoAtualizado: () => void;
}

export function FinanceiroTab({
  pacientes,
  onSaldoAtualizado,
}: FinanceiroTabProps) {
  const [mes, setMes] = useState("");
  const [percentualClinica, setPercentualClinica] = useState(20);
  const [rateio, setRateio] = useState<RateioResponse | null>(null);
  const [faturas, setFaturas] = useState<FaturaItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [pacienteId, setPacienteId] = useState("");
  const [valor, setValor] = useState("600");
  const [vencimento, setVencimento] = useState("");
  const [sessoesPacote, setSessoesPacote] = useState("4");

  useEffect(() => {
    setMes(mesAtualLocal());
    setVencimento(hojeLocalISO());
  }, []);

  const carregarDados = useCallback(async () => {
    if (!mes) return;
    setCarregando(true);
    setErro(null);
    try {
      const [rateioRes, faturasRes] = await Promise.all([
        apiFetch<RateioResponse>(
          `/api/financeiro/rateio?mes=${mes}&percentual_clinica=${percentualClinica}`
        ),
        apiFetch<{ faturas: FaturaItem[] }>(`/api/faturas?mes=${mes}`),
      ]);
      setRateio(rateioRes);
      setFaturas(faturasRes.faturas);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar financeiro.");
    } finally {
      setCarregando(false);
    }
  }, [mes, percentualClinica]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  async function lancarFatura(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    try {
      await apiFetch("/api/faturas", {
        method: "POST",
        body: JSON.stringify({
          paciente_id: Number(pacienteId),
          valor: Number(valor),
          vencimento,
          sessoes_pacote: Number(sessoesPacote || 0),
        }),
      });
      setAviso("Fatura lançada e saldo de sessões atualizado.");
      setMostrarForm(false);
      onSaldoAtualizado();
      await carregarDados();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao lançar fatura.");
    }
  }

  async function marcarComoPago(faturaId: number) {
    setErro(null);
    setAviso(null);
    try {
      await apiFetch(`/api/faturas/${faturaId}`, {
        method: "PATCH",
        body: JSON.stringify({ status_pagamento: "PAGO" }),
      });
      setAviso("Pagamento confirmado e rateio recalculado.");
      await carregarDados();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao dar baixa.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-stone-800 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-700" />
            Fechamento e Rateio
          </h2>
          <button
            type="button"
            onClick={carregarDados}
            className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">
              Mês de Referência
            </label>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">
              Taxa Clínica (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={percentualClinica}
              onChange={(e) => setPercentualClinica(Number(e.target.value))}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-800"
            />
          </div>
        </div>
      </div>

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

      {rateio && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-700 text-white rounded-2xl p-4">
              <p className="text-xs text-emerald-100">Recebido no Mês</p>
              <p className="text-lg font-bold mt-1">
                {formatarMoeda(rateio.resumo_clinica.total_recebido)}
              </p>
              <p className="text-xs text-emerald-100 mt-1">
                Caixa Clínica: {formatarMoeda(rateio.resumo_clinica.total_retencao_clinica)}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-4">
              <p className="text-xs text-stone-500">A Receber (Pendente)</p>
              <p className="text-lg font-bold text-amber-700 mt-1">
                {formatarMoeda(rateio.resumo_clinica.total_pendente)}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Repasse Sócias: {formatarMoeda(rateio.resumo_clinica.total_repasse_socias)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-stone-700">
              Rateio Automático por Sócia
            </h3>
            {rateio.rateio_por_psicologa.map((item) => (
              <div
                key={item.psicologa_id}
                className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="font-semibold text-sm text-stone-800">
                    {item.psicologa_nome}
                  </p>
                  <p className="text-xs text-stone-500">
                    CRP {item.crp} • {item.qtd_faturas_pagas} paga(s) /{" "}
                    {item.qtd_faturas_pendentes} pend.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700">
                    {formatarMoeda(item.repasse_liquido)}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Bruto: {formatarMoeda(item.total_recebido)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-700">
            Faturas da Minha Carteira ({faturas.length})
          </h3>
          <button
            type="button"
            onClick={() => setMostrarForm((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Fatura
          </button>
        </div>

        {mostrarForm && (
          <form
            onSubmit={lancarFatura}
            className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-3"
          >
            <select
              required
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
            >
              <option value="">Selecione o paciente...</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} (Saldo: {p.saldo_sessoes})
                </option>
              ))}
            </select>

            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Valor R$"
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
              />
              <input
                type="number"
                min="0"
                value={sessoesPacote}
                onChange={(e) => setSessoesPacote(e.target.value)}
                placeholder="+ Sessões"
                title="Sessões creditadas no pacote"
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
              />
              <input
                type="date"
                required
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className="rounded-xl border border-stone-300 bg-white px-2 py-2 text-xs text-stone-800"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-semibold"
            >
              Salvar Cobrança e Creditar Pacote
            </button>
          </form>
        )}

        {faturas.length === 0 ? (
          <p className="text-sm text-stone-500 text-center py-4">
            Nenhuma fatura encontrada para este mês.
          </p>
        ) : (
          <div className="space-y-2">
            {faturas.map((f) => (
              <div
                key={f.id}
                className="p-3 rounded-xl border border-stone-200 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="font-medium text-sm text-stone-800">
                    {f.paciente_nome}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatarMoeda(f.valor)} • Venc:{" "}
                    {String(f.vencimento).slice(0, 10)}
                  </p>
                </div>

                {f.status_pagamento === "PENDENTE" ? (
                  <button
                    type="button"
                    onClick={() => marcarComoPago(f.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Dar Baixa
                  </button>
                ) : (
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      f.status_pagamento === "PAGO"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {f.status_pagamento}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}