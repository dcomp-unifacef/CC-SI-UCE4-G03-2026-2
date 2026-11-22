import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verificarAuth } from "@/lib/auth";

const STATUS_VALIDOS = ["PENDENTE", "PAGO", "CANCELADO"] as const;

export async function GET(req: Request) {
  const usuario = verificarAuth(req);
  if (!usuario) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.toUpperCase();
    const mes = searchParams.get("mes"); // Ex: 2026-11

    const valores: unknown[] = [usuario.psicologaId];
    const condicoes: string[] = ["p.psicologa_id = $1"];

    if (status) {
      if (!STATUS_VALIDOS.includes(status as (typeof STATUS_VALIDOS)[number])) {
        return NextResponse.json(
          { erro: "Status inválido. Use PENDENTE, PAGO ou CANCELADO." },
          { status: 400 }
        );
      }
      valores.push(status);
      condicoes.push(`f.status_pagamento = $${valores.length}`);
    }

    if (mes) {
      if (!/^\d{4}-\d{2}$/.test(mes)) {
        return NextResponse.json(
          { erro: "Formato de mês inválido. Use YYYY-MM (ex: 2026-11)." },
          { status: 400 }
        );
      }
      valores.push(`${mes}-01`);
      const idx = valores.length;
      condicoes.push(
        `f.vencimento >= $${idx}::date AND f.vencimento < ($${idx}::date + INTERVAL '1 month')`
      );
    }

    const result = await pool.query(
      `SELECT
         f.id,
         f.valor,
         f.vencimento,
         f.status_pagamento,
         f.paciente_id,
         p.nome AS paciente_nome,
         p.contato AS paciente_contato
       FROM faturas f
       INNER JOIN pacientes p ON p.id = f.paciente_id
       WHERE ${condicoes.join(" AND ")}
       ORDER BY f.vencimento ASC, f.id DESC`,
      valores
    );

    const faturas = result.rows.map((row) => ({
      ...row,
      valor: Number(row.valor),
    }));

    return NextResponse.json({
      total: faturas.length,
      faturas,
    });
  } catch (error) {
    console.error("Erro ao listar faturas:", error);
    return NextResponse.json(
      { erro: "Erro interno ao listar faturas." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const usuario = verificarAuth(req);
  if (!usuario) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const pacienteId = Number(body.paciente_id);
  const valor = Number(body.valor);
  const vencimento = String(body.vencimento || "");
  const statusInicial = String(body.status_pagamento || "PENDENTE").toUpperCase();
  const sessoesPacote = Number(body.sessoes_pacote ?? 0);

  if (!Number.isInteger(pacienteId) || pacienteId <= 0) {
    return NextResponse.json({ erro: "paciente_id inválido." }, { status: 400 });
  }

  if (Number.isNaN(valor) || valor <= 0) {
    return NextResponse.json(
      { erro: "O valor da fatura deve ser maior que zero." },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
    return NextResponse.json(
      { erro: "Informe vencimento no formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  if (!["PENDENTE", "PAGO"].includes(statusInicial)) {
    return NextResponse.json(
      { erro: "status_pagamento inicial deve ser PENDENTE ou PAGO." },
      { status: 400 }
    );
  }

  if (!Number.isInteger(sessoesPacote) || sessoesPacote < 0) {
    return NextResponse.json(
      { erro: "sessoes_pacote deve ser um inteiro maior ou igual a zero." },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pacienteRes = await client.query(
      `SELECT id, nome, saldo_sessoes
       FROM pacientes
       WHERE id = $1 AND psicologa_id = $2`,
      [pacienteId, usuario.psicologaId]
    );

    if (pacienteRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { erro: "Paciente não encontrado na sua carteira." },
        { status: 404 }
      );
    }

    const faturaRes = await client.query(
      `INSERT INTO faturas (valor, vencimento, status_pagamento, paciente_id)
       VALUES ($1, $2::date, $3, $4)
       RETURNING id, valor, vencimento, status_pagamento, paciente_id`,
      [valor, vencimento, statusInicial, pacienteId]
    );

    let novoSaldo = pacienteRes.rows[0].saldo_sessoes;

    if (sessoesPacote > 0) {
      const saldoRes = await client.query(
        `UPDATE pacientes
         SET saldo_sessoes = saldo_sessoes + $1
         WHERE id = $2
         RETURNING saldo_sessoes`,
        [sessoesPacote, pacienteId]
      );
      novoSaldo = saldoRes.rows[0].saldo_sessoes;
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        mensagem: "Fatura lançada com sucesso.",
        fatura: {
          ...faturaRes.rows[0],
          valor: Number(faturaRes.rows[0].valor),
          paciente_nome: pacienteRes.rows[0].nome,
        },
        saldo_sessoes_atual: novoSaldo,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao lançar fatura:", error);
    return NextResponse.json(
      { erro: "Erro interno ao lançar fatura." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}