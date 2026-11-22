import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verificarAuth } from "@/lib/auth";
import { criptografarTexto, descriptografarTexto } from "@/lib/crypto";

export async function POST(req: Request) {
  const usuario = verificarAuth(req);
  if (!usuario) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const { agendamento_id, conteudo } = await req.json();

    const agendamentoId = Number(agendamento_id);
    if (!Number.isInteger(agendamentoId) || agendamentoId <= 0) {
      return NextResponse.json(
        { erro: "agendamento_id inválido." },
        { status: 400 }
      );
    }

    if (!conteudo || typeof conteudo !== "string" || !conteudo.trim()) {
      return NextResponse.json(
        { erro: "O conteúdo da evolução clínica é obrigatório." },
        { status: 400 }
      );
    }

    // 1. Bloqueio ético (CRP/LGPD): garante que o agendamento é de um paciente desta psicóloga
    const donoRes = await pool.query(
      `SELECT a.id, a.status, p.nome AS paciente_nome
       FROM agendamentos a
       INNER JOIN pacientes p ON p.id = a.paciente_id
       WHERE a.id = $1 AND p.psicologa_id = $2`,
      [agendamentoId, usuario.psicologaId]
    );

    if (donoRes.rowCount === 0) {
      return NextResponse.json(
        { erro: "Agendamento não encontrado na sua carteira de pacientes." },
        { status: 404 }
      );
    }

    if (donoRes.rows[0].status === "CANCELADO") {
      return NextResponse.json(
        { erro: "Não é possível registrar prontuário para um agendamento cancelado." },
        { status: 422 }
      );
    }

    // 2. Criptografa o conteúdo antes de enviar ao PostgreSQL
    const conteudoCriptografado = criptografarTexto(conteudo.trim());

    const insertRes = await pool.query(
      `INSERT INTO prontuarios (conteudo_criptografado, agendamento_id)
       VALUES ($1, $2)
       RETURNING id, data_registro, agendamento_id`,
      [conteudoCriptografado, agendamentoId]
    );

    return NextResponse.json(
      {
        mensagem: "Prontuário registrado e criptografado com sucesso.",
        prontuario: {
          ...insertRes.rows[0],
          paciente_nome: donoRes.rows[0].paciente_nome,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return NextResponse.json(
        { erro: "Já existe um prontuário registrado para este agendamento." },
        { status: 409 }
      );
    }

    console.error("Erro ao salvar prontuário:", error);
    return NextResponse.json(
      { erro: "Erro interno ao salvar prontuário." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const usuario = verificarAuth(req);
  if (!usuario) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const pacienteIdParam = searchParams.get("paciente_id");
    const agendamentoIdParam = searchParams.get("agendamento_id");

    const valores: unknown[] = [usuario.psicologaId];
    const condicoes: string[] = ["p.psicologa_id = $1"];

    if (pacienteIdParam) {
      const pacienteId = Number(pacienteIdParam);
      if (!Number.isInteger(pacienteId) || pacienteId <= 0) {
        return NextResponse.json({ erro: "paciente_id inválido." }, { status: 400 });
      }
      valores.push(pacienteId);
      condicoes.push(`p.id = $${valores.length}`);
    }

    if (agendamentoIdParam) {
      const agendamentoId = Number(agendamentoIdParam);
      if (!Number.isInteger(agendamentoId) || agendamentoId <= 0) {
        return NextResponse.json(
          { erro: "agendamento_id inválido." },
          { status: 400 }
        );
      }
      valores.push(agendamentoId);
      condicoes.push(`a.id = $${valores.length}`);
    }

    const result = await pool.query(
      `SELECT
         pr.id,
         pr.conteudo_criptografado,
         pr.data_registro,
         pr.agendamento_id,
         a.data_hora AS data_sessao,
         p.id AS paciente_id,
         p.nome AS paciente_nome
       FROM prontuarios pr
       INNER JOIN agendamentos a ON a.id = pr.agendamento_id
       INNER JOIN pacientes p ON p.id = a.paciente_id
       WHERE ${condicoes.join(" AND ")}
       ORDER BY a.data_hora DESC`,
      valores
    );

    const prontuarios = result.rows.map((row) => ({
      id: row.id,
      agendamento_id: row.agendamento_id,
      paciente_id: row.paciente_id,
      paciente_nome: row.paciente_nome,
      data_sessao: row.data_sessao,
      data_registro: row.data_registro,
      conteudo: descriptografarTexto(row.conteudo_criptografado),
    }));

    return NextResponse.json({
      total: prontuarios.length,
      prontuarios,
    });
  } catch (error) {
    console.error("Erro ao consultar prontuários:", error);
    return NextResponse.json(
      { erro: "Erro interno ao consultar prontuários." },
      { status: 500 }
    );
  }
}