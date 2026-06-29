-- Migração: modo copa só mata-mata
-- Executar uma vez em bancos já existentes:
--   psql ... -f db/migrations/001_formato_copa.sql

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS formatoCopa VARCHAR(20) DEFAULT 'groups';
