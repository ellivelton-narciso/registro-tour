-- Modo Suíço + mata-mata (substitui fase de grupos)

ALTER TABLE tournaments
    ADD COLUMN IF NOT EXISTS qtdRodadasSuico INT DEFAULT NULL;
