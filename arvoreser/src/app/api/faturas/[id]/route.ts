import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verificarAuth } from "@/lib/auth";

const STATUS_VALIDOS = ["PENDENTE", "PAGO", "CANCELADO"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = verificarAuth(req);
  if (!usuario) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const faturaId = Number(id);

  if (!Number.isInteger(faturaId) || faturaId <= 0) {
    return NextResponse.json({ erro: "ID da fatura inválido." }, { status: 400 });
  }

  try {
    const { status_pagamento } = await req.json();
    const novoStatus = String(status_pagamento || "").toUpperCase();

    if (!STATUS_VALIDOS.includes(novoStatus as (typeof STATUS_VALIDOS)[number])) {
      return NextResponse.json(
        { erro: "status_pagamento deve ser PENDENTE, PAGO ou CANCELADO." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `UPDATE faturas f
       SET status_pagamento = $1
       FROM pacientes p
       WHERE f.paciente_id = p.id
         AND f.id = $2
         AND p.psicologa_id = $3
       RETURNING f.id, f.valor, f.vencimento, f.status_pagamento, f.paciente_id`,
      [novoStatus, faturaId, usuario.psicologaId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { erro: "Fatura não encontrada na sua carteira." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      mensagem: `Status da fatura atualizado para ${novoStatus}.`,
      fatura: {
        ...result.rows[0],
        valor: Number(result.rows[0].valor),
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar fatura:", error);
    return NextResponse.json(
      { erro: "Erro interno ao atualizar fatura." },
      { status: 500 }
    );
  }
}