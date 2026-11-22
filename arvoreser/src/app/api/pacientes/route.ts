import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verificarAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const usuario = verificarAuth(req);
  if (!usuario) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await pool.query(
      `SELECT id, nome, cpf, contato, termos_aceitos, saldo_sessoes, criado_em
       FROM pacientes
       WHERE psicologa_id = $1
       ORDER BY nome ASC`,
      [usuario.psicologaId]
    );

    return NextResponse.json({ pacientes: result.rows });
  } catch (error) {
    console.error("Erro ao listar pacientes:", error);
    return NextResponse.json(
      { erro: "Erro interno ao listar pacientes." },
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
    const { nome, cpf, contato, termos_aceitos, saldo_sessoes = 0 } =
      await req.json();

    if (!nome || !cpf || !contato) {
      return NextResponse.json(
        { erro: "Nome, CPF e contato são obrigatórios." },
        { status: 400 }
      );
    }

    if (termos_aceitos !== true) {
      return NextResponse.json(
        { erro: "O aceite dos termos de consentimento LGPD é obrigatório." },
        { status: 400 }
      );
    }

    const saldoNumerico = Number(saldo_sessoes);
    if (!Number.isInteger(saldoNumerico) || saldoNumerico < 0) {
      return NextResponse.json(
        { erro: "Saldo de sessões deve ser um número inteiro maior ou igual a zero." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO pacientes (nome, cpf, contato, termos_aceitos, saldo_sessoes, psicologa_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nome, cpf, contato, termos_aceitos, saldo_sessoes, psicologa_id, criado_em`,
      [
        nome.trim(),
        cpf.trim(),
        contato.trim(),
        true,
        saldoNumerico,
        usuario.psicologaId,
      ]
    );

    return NextResponse.json(
      {
        mensagem: "Paciente cadastrado com sucesso.",
        paciente: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return NextResponse.json(
        { erro: "Já existe um paciente cadastrado com este CPF." },
        { status: 409 }
      );
    }

    console.error("Erro ao cadastrar paciente:", error);
    return NextResponse.json(
      { erro: "Erro interno ao cadastrar paciente." },
      { status: 500 }
    );
  }
}