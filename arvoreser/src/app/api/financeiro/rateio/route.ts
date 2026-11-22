import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verificarAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const usuario = verificarAuth(req);
  if (!usuario) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const hoje = new Date();
    const mesPadrao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

    const mes = searchParams.get("mes") || mesPadrao;
    const percentualClinica = Number(searchParams.get("percentual_clinica") ?? 20);

    if (!/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json(
        { erro: "Formato de mês inválido. Use YYYY-MM (ex: 2026-11)." },
        { status: 400 }
      );
    }

    if (
      Number.isNaN(percentualClinica) ||
      percentualClinica < 0 ||
      percentualClinica > 100
    ) {
      return NextResponse.json(
        { erro: "percentual_clinica deve estar entre 0 e 100." },
        { status: 400 }
      );
    }

    const inicioMes = `${mes}-01`;

    // O filtro de data fica no ON do LEFT JOIN para manter sócias com R$ 0 no mês
    const result = await pool.query(
      `SELECT
         ps.id AS psicologa_id,
         ps.nome AS psicologa_nome,
         ps.crp,
         COUNT(f.id) FILTER (WHERE f.status_pagamento = 'PAGO')::int AS qtd_faturas_pagas,
         COUNT(f.id) FILTER (WHERE f.status_pagamento = 'PENDENTE')::int AS qtd_faturas_pendentes,
         COALESCE(SUM(f.valor) FILTER (WHERE f.status_pagamento = 'PAGO'), 0)::numeric(10, 2) AS total_recebido,
         COALESCE(SUM(f.valor) FILTER (WHERE f.status_pagamento = 'PENDENTE'), 0)::numeric(10, 2) AS total_pendente,
         ROUND(
           COALESCE(SUM(f.valor) FILTER (WHERE f.status_pagamento = 'PAGO'), 0) * ($2::numeric / 100),
           2
         ) AS retencao_clinica,
         ROUND(
           COALESCE(SUM(f.valor) FILTER (WHERE f.status_pagamento = 'PAGO'), 0) * (1 - ($2::numeric / 100)),
           2
         ) AS repasse_liquido
       FROM psicologas ps
       LEFT JOIN pacientes p ON p.psicologa_id = ps.id
       LEFT JOIN faturas f
         ON f.paciente_id = p.id
         AND f.vencimento >= $1::date
         AND f.vencimento < ($1::date + INTERVAL '1 month')
       GROUP BY ps.id, ps.nome, ps.crp
       ORDER BY total_recebido DESC, ps.nome ASC`,
      [inicioMes, percentualClinica]
    );

    const rateioPorPsicologa = result.rows.map((row) => ({
      psicologa_id: row.psicologa_id,
      psicologa_nome: row.psicologa_nome,
      crp: row.crp,
      qtd_faturas_pagas: row.qtd_faturas_pagas,
      qtd_faturas_pendentes: row.qtd_faturas_pendentes,
      total_recebido: Number(row.total_recebido),
      total_pendente: Number(row.total_pendente),
      retencao_clinica: Number(row.retencao_clinica),
      repasse_liquido: Number(row.repasse_liquido),
    }));

    const resumoClinica = rateioPorPsicologa.reduce(
      (acc, item) => ({
        total_recebido: Number((acc.total_recebido + item.total_recebido).toFixed(2)),
        total_pendente: Number((acc.total_pendente + item.total_pendente).toFixed(2)),
        total_retencao_clinica: Number(
          (acc.total_retencao_clinica + item.retencao_clinica).toFixed(2)
        ),
        total_repasse_socias: Number(
          (acc.total_repasse_socias + item.repasse_liquido).toFixed(2)
        ),
      }),
      {
        total_recebido: 0,
        total_pendente: 0,
        total_retencao_clinica: 0,
        total_repasse_socias: 0,
      }
    );

    return NextResponse.json({
      mes_referencia: mes,
      percentual_clinica: percentualClinica,
      resumo_clinica: resumoClinica,
      rateio_por_psicologa: rateioPorPsicologa,
    });
  } catch (error) {
    console.error("Erro ao calcular rateio financeiro:", error);
    return NextResponse.json(
      { erro: "Erro interno ao calcular rateio financeiro." },
      { status: 500 }
    );
  }
}