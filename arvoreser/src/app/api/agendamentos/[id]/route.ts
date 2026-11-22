import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verificarAuth } from "@/lib/auth";

const TIPOS_VALIDOS = ["AVULSO", "PACOTE"] as const;

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

  try {
    const body = await req.json();
    const { data_hora, status, tipo_atendimento } = body;

    if (!data_hora && !status && !tipo_atendimento) {
      return NextResponse.json(
        {
          erro: "Informe ao menos um campo para atualizar: data_hora, status ou tipo_atendimento.",
        },
        { status: 400 }
      );
    }

    const novoStatus = status ? String(status).toUpperCase() : null;
    if (novoStatus === "CONCLUIDO") {
      return NextResponse.json(
        {
          erro: "Para concluir um atendimento e processar a baixa financeira, utilize PATCH /api/agendamentos/[id]/concluir.",
        },
        { status: 400 }
      );
    }

    if (novoStatus && !["AGENDADO", "CANCELADO"].includes(novoStatus)) {
      return NextResponse.json(
        { erro: "Status inválido nesta rota. Use AGENDADO ou CANCELADO." },
        { status: 400 }
      );
    }

    const novoTipo = tipo_atendimento
      ? String(tipo_atendimento).toUpperCase()
      : null;
    if (
      novoTipo &&
      !TIPOS_VALIDOS.includes(novoTipo as (typeof TIPOS_VALIDOS)[number])
    ) {
      return NextResponse.json(
        { erro: "tipo_atendimento deve ser AVULSO ou PACOTE." },
        { status: 400 }
      );
    }

    if (data_hora && Number.isNaN(Date.parse(data_hora))) {
      return NextResponse.json(
        { erro: "data_hora inválida. Use formato ISO (ex: 2026-11-25T15:00:00)." },
        { status: 400 }
      );
    }

    // 1. Verifica existência e pertencimento à psicóloga logada via JOIN
    const atualRes = await pool.query(
      `SELECT a.id, a.data_hora, a.status, a.tipo_atendimento, a.paciente_id, p.saldo_sessoes
       FROM agendamentos a
       INNER JOIN pacientes p ON p.id = a.paciente_id
       WHERE a.id = $1 AND p.psicologa_id = $2`,
      [agendamentoId, usuario.psicologaId]
    );

    if (atualRes.rowCount === 0) {
      return NextResponse.json(
        { erro: "Agendamento não encontrado." },
        { status: 404 }
      );
    }

    const atual = atualRes.rows[0];

    if (atual.status !== "AGENDADO") {
      return NextResponse.json(
        { erro: `Não é possível alterar um agendamento já ${atual.status}.` },
        { status: 409 }
      );
    }

    if (novoTipo === "PACOTE" && atual.saldo_sessoes <= 0) {
      return NextResponse.json(
        { erro: "Paciente sem saldo de sessões para mudar o atendimento para PACOTE." },
        { status: 422 }
      );
    }

    // 2. Valida conflito na remarcação ignorando o próprio agendamento
    if (data_hora && novoStatus !== "CANCELADO") {
      const conflitoRes = await pool.query(
        `SELECT a.id, a.data_hora, p.nome AS paciente_nome
         FROM agendamentos a
         INNER JOIN pacientes p ON p.id = a.paciente_id
         WHERE p.psicologa_id = $1
           AND a.status = 'AGENDADO'
           AND a.id <> $3
           AND a.data_hora > ($2::timestamp - INTERVAL '60 minutes')
           AND a.data_hora < ($2::timestamp + INTERVAL '60 minutes')
         LIMIT 1`,
        [usuario.psicologaId, data_hora, agendamentoId]
      );

      if (conflitoRes.rowCount && conflitoRes.rowCount > 0) {
        return NextResponse.json(
          {
            erro: "Conflito de horário: já existe outro atendimento nessa janela de 60 minutos.",
            conflito: conflitoRes.rows[0],
          },
          { status: 409 }
        );
      }
    }

    // 3. Atualiza somente os campos enviados usando COALESCE
    const updateRes = await pool.query(
      `UPDATE agendamentos
       SET data_hora = COALESCE($1::timestamp, data_hora),
           status = COALESCE($2, status),
           tipo_atendimento = COALESCE($3, tipo_atendimento)
       WHERE id = $4
       RETURNING id, data_hora, status, tipo_atendimento, paciente_id`,
      [data_hora ?? null, novoStatus, novoTipo, agendamentoId]
    );

    return NextResponse.json({
      mensagem:
        novoStatus === "CANCELADO"
          ? "Agendamento cancelado com sucesso."
          : "Agendamento remarcado com sucesso.",
      agendamento: updateRes.rows[0],
    });
  } catch (error) {
    console.error("Erro ao atualizar agendamento:", error);
    return NextResponse.json(
      { erro: "Erro interno ao atualizar agendamento." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

  try {
    const result = await pool.query(
      `UPDATE agendamentos a
       SET status = 'CANCELADO'
       FROM pacientes p
       WHERE a.paciente_id = p.id
         AND a.id = $1
         AND p.psicologa_id = $2
         AND a.status = 'AGENDADO'
       RETURNING a.id, a.data_hora, a.status, a.tipo_atendimento, a.paciente_id`,
      [agendamentoId, usuario.psicologaId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { erro: "Agendamento não encontrado ou já foi concluído/cancelado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      mensagem: "Agendamento cancelado com sucesso.",
      agendamento: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    return NextResponse.json(
      { erro: "Erro interno ao cancelar agendamento." },
      { status: 500 }
    );
  }
}