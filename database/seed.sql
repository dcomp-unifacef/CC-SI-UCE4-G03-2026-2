-- ARVORESER - Seed de Demonstração (PostgreSQL)
-- Execute após rodar database/schema.sql no banco arvoreser_db
-- Senha padrão das duas sócias para login: senha123

CREATE EXTENSION IF NOT EXISTS pgcrypto;

TRUNCATE TABLE prontuarios, faturas, agendamentos, pacientes, psicologas
RESTART IDENTITY CASCADE;

-- 1. Sócias da Clínica ArvoreSer
INSERT INTO psicologas (nome, crp, email, senha_hash) VALUES
  ('Dra. Ana Paula Mendes', '06/123456', 'ana@arvoreser.com', crypt('senha123', gen_salt('bf', 10))),
  ('Dra. Beatriz Souza', '06/987654', 'beatriz@arvoreser.com', crypt('senha123', gen_salt('bf', 10)));

-- 2. Pacientes (2 na carteira de cada psicóloga, todos com aceite LGPD)
INSERT INTO pacientes (nome, cpf, contato, termos_aceitos, saldo_sessoes, psicologa_id) VALUES
  ('Carlos Eduardo Silva', '111.222.333-44', '(16) 99999-1111', TRUE, 4, 1),
  ('Fernanda Oliveira', '222.333.444-55', '(16) 99999-2222', TRUE, 0, 1),
  ('Mariana Lima', '333.444.555-66', '(16) 98888-3333', TRUE, 4, 2),
  ('Rafael Costa', '444.555.666-77', '(16) 98888-4444', TRUE, 2, 2);

-- 3. Agendamentos para a data atual (Agenda do Dia pronta para demonstração)
INSERT INTO agendamentos (data_hora, status, tipo_atendimento, paciente_id) VALUES
  (CURRENT_DATE + TIME '09:00:00', 'CONCLUIDO', 'PACOTE', 1),
  (CURRENT_DATE + TIME '10:00:00', 'AGENDADO',  'AVULSO', 2),
  (CURRENT_DATE + TIME '14:00:00', 'AGENDADO',  'PACOTE', 3),
  (CURRENT_DATE + TIME '15:00:00', 'AGENDADO',  'PACOTE', 4),
  (CURRENT_DATE + TIME '16:00:00', 'CONCLUIDO', 'AVULSO', 3);

-- 4. Faturas do mês atual (alimentam o cálculo de Rateio entre Sócias)
INSERT INTO faturas (valor, vencimento, status_pagamento, paciente_id) VALUES
  (600.00, CURRENT_DATE, 'PAGO',     1),
  (180.00, CURRENT_DATE, 'PENDENTE', 2),
  (600.00, CURRENT_DATE, 'PAGO',     3),
  (320.00, CURRENT_DATE, 'PAGO',     4),
  (180.00, CURRENT_DATE, 'PENDENTE', 3);

-- Nota: A tabela prontuarios fica propositalmente vazia no seed porque os registros
-- são criptografados em AES-256-GCM com a ENCRYPTION_KEY do arquivo .env.local de cada máquina.