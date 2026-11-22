-- ARVORESER - DDL PostgreSQL (SQL Puro)

CREATE TABLE IF NOT EXISTS psicologas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    crp VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pacientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    contato VARCHAR(30) NOT NULL,
    termos_aceitos BOOLEAN NOT NULL DEFAULT FALSE,
    saldo_sessoes INT NOT NULL DEFAULT 0 CHECK (saldo_sessoes >= 0),
    psicologa_id INT NOT NULL REFERENCES psicologas(id) ON DELETE RESTRICT,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agendamentos (
    id SERIAL PRIMARY KEY,
    data_hora TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AGENDADO'
        CHECK (status IN ('AGENDADO', 'CONCLUIDO', 'CANCELADO')),
    tipo_atendimento VARCHAR(20) NOT NULL
        CHECK (tipo_atendimento IN ('AVULSO', 'PACOTE')),
    paciente_id INT NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS prontuarios (
    id SERIAL PRIMARY KEY,
    conteudo_criptografado TEXT NOT NULL,
    data_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    agendamento_id INT NOT NULL UNIQUE REFERENCES agendamentos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS faturas (
    id SERIAL PRIMARY KEY,
    valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
    vencimento DATE NOT NULL,
    status_pagamento VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
        CHECK (status_pagamento IN ('PENDENTE', 'PAGO', 'CANCELADO')),
    paciente_id INT NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT
);

-- Índices para performance na agenda e filtro por psicóloga
CREATE INDEX IF NOT EXISTS idx_pacientes_psicologa ON pacientes(psicologa_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_hora);
CREATE INDEX IF NOT EXISTS idx_faturas_paciente_status ON faturas(paciente_id, status_pagamento);