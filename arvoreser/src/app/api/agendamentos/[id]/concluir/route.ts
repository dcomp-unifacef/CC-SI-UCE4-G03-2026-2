import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verificarAuth } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = verificarAuth(req);
  if (!usuario) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const agendamentoId = Number(id);

  if (!Number.isInteger(agendamentoId) || agendamentoId <= 0) {
    return NextResponse.json(
      { erro: "ID do agendamento inválido." },
      { status: 400 }
    );
  }

  // Corpo opcional (usado apenas se quiser informar valor para consulta AVULSA)
  let valorAvulso: number | null = null;
  try {
    const body = await req.json();
    if (body?.valor_avulso !== undefined && body?.valor_avulso !== null) {
      const parsed = Number(body.valor_avulso);
      if (Number.isNaN(parsed) || parsed <= 0) {
        return NextResponse.json(
          { erro: "valor_avulso deve ser um número maior que zero." },
          { status: 400 }
        );
      }
      valorAvulso = parsed;
    }
  } catch {
    // Requisição sem body JSON é permitida (ex: consultas de PACOTE)
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Atualiza o status para CONCLUIDO garantindo posse pela psicóloga autenticada
    const agendamentoRes = await client.query(
      `UPDATE agendamentos a
       SET status = 'CONCLUIDO'
       FROM pacientes p
       WHERE a.paciente_id = p.id
         AND a.id = $1
         AND p.psicologa_id = $2
         AND a.status = 'AGENDADO'
       RETURNING a.id, a.paciente_id, a.tipo_atendimento, a.data_hora`,
      [agendamentoId, usuario.psicologaId]
    );

    if (agendamentoRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          erro: "Agendamento não encontrado na sua carteira ou já foi concluído/cancelado.",
        },
        { status: 404 }
      );
    }

    const agendamento = agendamentoRes.rows[0];
    let saldoRestante: number | null = null;
    let faturaGeradaId: number | null = null;

    // 2A. Se for PACOTE: abate 1 sessão do saldo do paciente (US-100)
    if (agendamento.tipo_atendimento === "PACOTE") {
      const baixaRes = await client.query(
        `UPDATE pacientes
         SET saldo_sessoes = saldo_sessoes - 1
         WHERE id = $1
           AND psicologa_id = $2
           AND saldo_sessoes > 0
         RETURNING saldo_sessoes`,
        [agendamento.paciente_id, usuario.psicologaId]
      );

      if (baixaRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { erro: "Paciente sem saldo de sessões disponível no pacote." },
          { status: 422 }
        );
      }

      saldoRestante = baixaRes.rows[0].saldo_sessoes;
    }

    // 2B. Se for AVULSO e houver valor informado: lança fatura pendente automaticamente
    if (
      agendamento.tipo_atendimento === "AVULSO" &&
      valorAvulso &&
      valorAvulso > 0
    ) {
      const faturaRes = await client.query(
        `INSERT INTO faturas (valor, vencimento, status_pagamento, paciente_id)
         VALUES ($1, CURRENT_DATE + INTERVAL '5 days', 'PENDENTE', $2)
         RETURNING id`,
        [valorAvulso, agendamento.paciente_id]
      );
      faturaGeradaId = faturaRes.rows[0].id;
    }

    // 3. Confirma todas as alterações no PostgreSQL
    await client.query("COMMIT");

    return NextResponse.json({
      mensagem: "Atendimento concluído com sucesso.",
      agendamento_id: agendamento.id,
      tipo_atendimento: agendamento.tipo_atendimento,
      saldo_sessoes_restante: saldoRestante,
      fatura_gerada_id: faturaGeradaId,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro na transação SQL de conclusão:", error);
    return NextResponse.json(
      { erro: "Erro interno ao processar conclusão do atendimento." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}