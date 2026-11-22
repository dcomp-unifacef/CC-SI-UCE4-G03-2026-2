import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { gerarToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, senha } = await req.json();

    if (!email || !senha) {
      return NextResponse.json(
        { erro: "Informe e-mail e senha." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT id, nome, crp, email, senha_hash
       FROM psicologas
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { erro: "Credenciais inválidas." },
        { status: 401 }
      );
    }

    const psicologa = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, psicologa.senha_hash);

    if (!senhaValida) {
      return NextResponse.json(
        { erro: "Credenciais inválidas." },
        { status: 401 }
      );
    }

    const token = gerarToken({
      psicologaId: psicologa.id,
      nome: psicologa.nome,
      crp: psicologa.crp,
      email: psicologa.email,
    });

    return NextResponse.json({
      token,
      psicologa: {
        id: psicologa.id,
        nome: psicologa.nome,
        crp: psicologa.crp,
        email: psicologa.email,
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return NextResponse.json(
      { erro: "Erro interno ao realizar login." },
      { status: 500 }
    );
  }
}