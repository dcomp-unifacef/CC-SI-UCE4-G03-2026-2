# ArvoreSer — Sistema de Gestão Clínica Mobile-First

Sistema web *mobile-first* desenvolvido na Unidade Curricular de Extensão (UCE) para a **Clínica ArvoreSer**, projetado para eliminar o controle manual em múltiplas planilhas e otimizar a rotina clínica no **intervalo de 10 minutos** entre sessões — com isolamento ético por CRP, criptografia LGPD e cálculo automático de rateio entre sócias.

## Funcionalidades Principais

- **Acesso Isolado por CRP (JWT + bcrypt):** cada psicóloga visualiza e gerencia apenas a própria carteira de pacientes e agendamentos.
- **Agenda do Dia com Proteção de Conflito:** organização em blocos de 60 minutos (50 min de atendimento + 10 min de intervalo), remarcação e cancelamento lógico.
- **Baixa Atômica de Pacotes (Transação SQL):** conclusão de atendimento em 1 toque com abatimento automático de `saldo_sessoes` ou geração de fatura para consultas avulsas (`BEGIN / COMMIT / ROLLBACK`).
- **Prontuário Clínico LGPD (AES-256-GCM):** evoluções criptografadas em repouso no PostgreSQL (`iv:authTag:cifra`), descriptografadas apenas em memória para a profissional responsável.
- **Motor Financeiro e Rateio entre Sócias:** lançamento de faturas com recarga automática de pacotes e consolidação mensal em SQL puro (`LEFT JOIN`, `FILTER`, `SUM`, `GROUP BY`).

## Stack Tecnológica

- **Frontend & API:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide React
- **Banco de Dados:** PostgreSQL com SQL puro via driver oficial `pg` (sem ORM)
- **Segurança:** `bcryptjs`, `jsonwebtoken` e módulo nativo `crypto` (AES-256-GCM)

## Estrutura do Projeto

```text
CC-SI-UCE4-G03-2026-2/
├── database/
│   ├── schema.sql          # DDL das 5 tabelas, constraints e índices
│   └── seed.sql            # Dados de demonstração com senhas bcrypt e data atual
└── arvoreser/
    ├── .env.example        # Modelo de variáveis de ambiente
    └── src/
        ├── lib/            # Pool pg, JWT, AES-256-GCM e cliente fetch
        ├── components/     # Aba financeira e rateio
        └── app/
            ├── page.tsx    # Login e cadastro de psicólogas
            ├── painel/     # Interface mobile-first (Agenda, Pacientes, Rateio)
            └── api/        # Rotas REST em SQL puro