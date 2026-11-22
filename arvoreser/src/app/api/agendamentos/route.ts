import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verificarAuth } from "@/lib/auth";

const TIPOS_VALIDOS = ["AVULSO", "PACOTE"] as const;
const STATUS_VALIDOS = ["AGENDADO", "CONCLUIDO", "CANCELADO"] as const;

export async function GET(req: Request) {
  const usuario = verificarAuth(req);
  if (!usuario) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const data = searchParams.get("data");
    const status = searchParams.get("status")?.toUpperCase();

    const valores: unknown[] = [usuario.psicologaId];
    const condicoes: string[] = ["p.psicologa_id = $1"];

    if (data) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return NextResponse.json(
          { erro: "Formato de data inválido. Use YYYY-MM-DD." },
          { status: 400 }
        );
      }
      valores.push(data);
      condicoes.push(`a.data_hora::date = $${valores.length}::date`);
    }

    if (status) {
      if (!STATUS_VALIDOS.includes(status as (typeof STATUS_VALIDOS)[number])) {
        return NextResponse.json(
          { erro: "Status inválido. Use AGENDADO, CONCLUIDO ou CANCELADO." },
          { status: 400 }
        );
      }
      valores.push(status);
      condicoes.push(`a.status = $${valores.length}`);
    }

    const query = `
      SELECT
        a.id,
        a.data_hora,
        a.status,
        a.tipo_atendimento,
        a.paciente_id,
        p.nome AS paciente_nome,
        p.contato AS paciente_contato,
        p.saldo_sessoes AS paciente_saldo_sessoes
      FROM agendamentos a
      INNER JOIN pacientes p ON p.id = a.paciente_id
      WHERE ${condicoes.join(" AND ")}
      ORDER BY a.data_hora ASC
    `;

    const result = await pool.query(query, valores);

    return NextResponse.json({
      total: result.rowCount,
      agendamentos: result.rows,
    });
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    return NextResponse.json(
      { erro: "Erro interno ao consultar a agenda." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const usuario = verificarAuth(req);
  if (!usuario) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const { paciente_id, data_hora, tipo_atendimento } = await req.json();

    const pacienteId = Number(paciente_id);
    if (!Number.isInteger(pacienteId) || pacienteId <= 0) {
      return NextResponse.json(
        { erro: "paciente_id inválido." },
        { status: 400 }
      );
    }

    if (!data_hora || Number.isNaN(Date.parse(data_hora))) {
      return NextResponse.json(
        { erro: "Informe uma data_hora válida (ex: 2026-11-25T14:00:00)." },
        { status: 400 }
      );
    }

    const tipo = String(tipo_atendimento || "").toUpperCase();
    if (!TIPOS_VALIDOS.includes(tipo as (typeof TIPOS_VALIDOS)[number])) {
      return NextResponse.json(
        { erro: "tipo_atendimento deve ser AVULSO ou PACOTE." },
        { status: 400 }
      );
    }

    // 1. Garante que o paciente existe e pertence à psicóloga logada
    const pacienteRes = await pool.query(
      `SELECT id, nome, saldo_sessoes
       FROM pacientes
       WHERE id = $1 AND psicologa_id = $2`,
      [pacienteId, usuario.psicologaId]
    );

    if (pacienteRes.rowCount === 0) {
      return NextResponse.json(
        { erro: "Paciente não encontrado na sua carteira." },
        { status: 404 }
      );
    }

    const paciente = pacienteRes.rows[0];

    if (tipo === "PACOTE" && paciente.saldo_sessoes <= 0) {
      return NextResponse.json(
        { erro: "Paciente sem saldo de sessões disponível para agendamento em PACOTE." },
        { status: 422 }
      );
    }

    // 2. Bloqueia conflito na janela de 60 min (50 min sessão + 10 min intervalo)
    const conflitoRes = await pool.query(
      `SELECT a.id, a.data_hora, p.nome AS paciente_nome
       FROM agendamentos a
       INNER JOIN pacientes p ON p.id = a.paciente_id
       WHERE p.psicologa_id = $1
         AND a.status = 'AGENDADO'
         AND a.data_hora > ($2::timestamp - INTERVAL '60 minutes')
         AND a.data_hora < ($2::timestamp + INTERVAL '60 minutes')
       LIMIT 1`,
      [usuario.psicologaId, data_hora]
    );

    if (conflitoRes.rowCount && conflitoRes.rowCount > 0) {
      return NextResponse.json(
        {
          erro: "Conflito de horário: já existe um atendimento agendado nesse intervalo de 60 minutos.",
          conflito: conflitoRes.rows[0],
        },
        { status: 409 }
      );
    }

    // 3. Insere o agendamento
    const insertRes = await pool.query(
      `INSERT INTO agendamentos (data_hora, status, tipo_atendimento, paciente_id)
       VALUES ($1::timestamp, 'AGENDADO', $2, $3)
       RETURNING id, data_hora, status, tipo_atendimento, paciente_id`,
      [data_hora, tipo, pacienteId]
    );

    return NextResponse.json(
      {
        mensagem: "Agendamento criado com sucesso.",
        agendamento: {
          ...insertRes.rows[0],
          paciente_nome: paciente.nome,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json(
      { erro: "Erro interno ao criar agendamento." },
      { status: 500 }
    );
  }
}