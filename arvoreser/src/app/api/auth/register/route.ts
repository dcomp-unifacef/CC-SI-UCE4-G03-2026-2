import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { nome, crp, email, senha } = await req.json();

    if (!nome || !crp || !email || !senha) {
      return NextResponse.json(
        { erro: "Preencha nome, CRP, e-mail e senha." },
        { status: 400 }
      );
    }

    if (String(senha).length < 6) {
      return NextResponse.json(
        { erro: "A senha deve ter no mínimo 6 caracteres." },
        { status: 400 }
      );
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const result = await pool.query(
      `INSERT INTO psicologas (nome, crp, email, senha_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, crp, email, criado_em`,
      [nome.trim(), crp.trim(), email.trim().toLowerCase(), senhaHash]
    );

    return NextResponse.json(
      {
        mensagem: "Psicóloga cadastrada com sucesso.",
        psicologa: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return NextResponse.json(
        { erro: "Já existe uma psicóloga cadastrada com este CRP ou e-mail." },
        { status: 409 }
      );
    }

    console.error("Erro ao cadastrar psicóloga:", error);
    return NextResponse.json(
      { erro: "Erro interno ao cadastrar psicóloga." },
      { status: 500 }
    );
  }
}