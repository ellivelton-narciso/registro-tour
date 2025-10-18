-- CONFIG WHATSAPP

CREATE TABLE config (
	id SERIAL PRIMARY KEY,
	k_match INT NULL,
	k_tournament INT NULL,
	group_ids TEXT[] NULL,
	admin_ids TEXT[] NULL,
	min_rating INT NULL
);

--  USUÁRIOS E TOKENS

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    "user" VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) DEFAULT NULL UNIQUE,
    "password" VARCHAR(255) NOT NULL,
    admin INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(), 
    last_login TIMESTAMP 
);

CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY,
    usuarios_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expire_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '36 hour')
);


--  POKEMONS

CREATE TABLE IF NOT EXISTS pokemons (
    id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type TEXT DEFAULT '[]' NOT NULL,
    gen INT NOT NULL,
    af VARCHAR(100) DEFAULT '' NOT NULL,
    CONSTRAINT pokemons_id_af_unique UNIQUE (id, af)
);


--  PLAYERS (JOGADORES)

CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    user_app_id INT DEFAULT 0,
    name VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) DEFAULT NULL UNIQUE,
    rating INT NOT NULL DEFAULT 1200,
    coins INT NOT NULL DEFAULT 0,
    total_matches INT DEFAULT 0,
    total_wins INT DEFAULT 0
);


--  TOURNAMENTS (TORNEIOS)

CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    titulo2 VARCHAR(255) DEFAULT NULL,
    gen INT DEFAULT NULL,
    sprites VARCHAR(255) DEFAULT NULL,
    qtdLimitado INT DEFAULT NULL,
    qtdLimitadoLendario INT DEFAULT NULL,
    listaLimitado TEXT[] DEFAULT '{}',
    listaLimitadoLendario TEXT[] DEFAULT '{}',
    listaBanido TEXT[] DEFAULT '{}',
    hook VARCHAR(255) DEFAULT NULL,
    enviarDiscord BOOLEAN DEFAULT FALSE,
    qtdEscolha INT DEFAULT NULL,
    encerrado BOOLEAN DEFAULT FALSE,
    prizes BOOLEAN DEFAULT FALSE,
    monotype BOOLEAN DEFAULT FALSE,
    qtdGrupos INT DEFAULT 2,
    qtdClassificados INT DEFAULT 2,
    formatoMataMata SMALLINT DEFAULT 3,
    dateStart DATE DEFAULT CURRENT_DATE,
    dateEnd DATE DEFAULT NULL
);


--  PARTICIPANTS (PARTICIPANTES DOS TORNEIOS)

CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    tournaments_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    players_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    grupo CHAR(1) DEFAULT NULL,
    pontos INT DEFAULT 0,
    vitorias INT DEFAULT 0,
    derrotas INT DEFAULT 0,
    empates INT DEFAULT 0,
    saldo INT DEFAULT 0,
    posicao INT DEFAULT NULL,
    UNIQUE (tournaments_id, players_id)
);


--  CHOICES (POKÉMONS ESCOLHIDOS PELOS PARTICIPANTES)

CREATE TABLE IF NOT EXISTS choices (
    id SERIAL PRIMARY KEY,
    participants_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    pokemons_id INT NOT NULL,
    pokemons_af VARCHAR(100) NOT NULL DEFAULT '',
    tournaments_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT choices_pokemons_id_af_fkey FOREIGN KEY (pokemons_id, pokemons_af)
        REFERENCES pokemons (id, af) ON DELETE CASCADE
);


--  SHOP

CREATE TABLE IF NOT EXISTS shop_items (
    id SERIAL PRIMARY KEY,
    pokemon_name VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    sold BOOLEAN DEFAULT FALSE,
    generation int4 NOT NULL
);


CREATE TABLE IF NOT EXISTS shop_transactions (
    id SERIAL PRIMARY KEY,
    player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered boolean NOT NULL DEFAULT false
);


--  PRIZES (CONFIGURAÇÕES E LISTA DE POKÉMONS)

CREATE TABLE IF NOT EXISTS prizes_config (
    id SERIAL PRIMARY KEY,
    player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL UNIQUE,
    codigo VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS prizes_list (
    id SERIAL PRIMARY KEY,
    prizes_id INT NOT NULL REFERENCES prizes_config(id) ON DELETE CASCADE,
    pokemons_id INT NOT NULL,
    pokemons_af VARCHAR(100) NOT NULL DEFAULT '',
    UNIQUE (prizes_id, pokemons_id, pokemons_af),
    CONSTRAINT prizes_list_pokemons_id_af_fkey FOREIGN KEY (pokemons_id, pokemons_af)
        REFERENCES pokemons (id, af) ON DELETE CASCADE
);

CREATE OR REPLACE VIEW v_prizes AS
SELECT
    pc.id AS prize_id,
    pc.nome AS prize_name,
    pc.codigo AS prize_code,
    p.name AS player_name,
    ARRAY_AGG(DISTINCT pk_name ORDER BY pk_name) AS pokemon_list
FROM prizes_config pc
JOIN players p ON pc.player_id = p.id
LEFT JOIN LATERAL (
    -- Pokémons da lista de prêmios
    SELECT pk.name AS pk_name
    FROM prizes_list pl
    JOIN pokemons pk ON pk.id = pl.pokemons_id
    WHERE pl.prizes_id = pc.id

    UNION ALL

    -- Pokémons comprados no shop pelo jogador
    SELECT si.pokemon_name AS pk_name
    FROM shop_transactions st
    JOIN shop_items si ON si.id = st.item_id
    WHERE st.player_id = pc.player_id
) AS pk_names ON TRUE
GROUP BY pc.id, pc.nome, pc.codigo, p.name;




--  MATCHES E RESULTADOS

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    player_a_id INT REFERENCES players(id),
    player_b_id INT REFERENCES players(id),
    winner VARCHAR(1) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_results (
    id SERIAL PRIMARY KEY,
    match_id INT REFERENCES matches(id),
    player_id INT REFERENCES players(id),
    old_rating INT NOT NULL,
    new_rating INT NOT NULL,
    rating_change INT NOT NULL,
    coins_change INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


--  MATCHES E RESULTADOS DE TORNEIOS

CREATE TABLE IF NOT EXISTS tournament_matches (
    id SERIAL PRIMARY KEY,
    tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player_a_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player_b_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    winner_id INT REFERENCES players(id) ON DELETE SET NULL,
    phase VARCHAR(50) DEFAULT 'groups',
    best_of SMALLINT DEFAULT 3,
    score_a SMALLINT DEFAULT 0,
    score_b SMALLINT DEFAULT 0,
    grupo CHAR(1) DEFAULT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS tournament_games (
    id SERIAL PRIMARY KEY,
    match_id INT NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
    game_number SMALLINT NOT NULL,
    winner_id INT REFERENCES players(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS tournament_match_results (
    id SERIAL PRIMARY KEY,
    game_id INT NOT NULL REFERENCES tournament_games(id) ON DELETE CASCADE,
    player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    old_rating INT NOT NULL,
    new_rating INT NOT NULL,
    rating_change INT NOT NULL,
    coins_change INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE VIEW v_tournament_series_summary AS
SELECT
    tm.id AS series_id,
    tr.id AS tournament_id,
    tr.name AS tournament_name,
    tm.phase,
    tm.best_of,
    pa.name AS player_a,
    pb.name AS player_b,
    pw.name AS winner,
    tm.score_a,
    tm.score_b,
    tm.started_at,
    tm.ended_at
FROM tournament_matches tm
JOIN tournaments tr ON tm.tournament_id = tr.id
LEFT JOIN players pa ON tm.player_a_id = pa.id
LEFT JOIN players pb ON tm.player_b_id = pb.id
LEFT JOIN players pw ON tm.winner_id = pw.id;


--  TRANSAÇÕES (MOEDAS)

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id),
    type VARCHAR(50) NOT NULL,
    amount INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


--  RESULTADOS DE TORNEIO

CREATE TABLE IF NOT EXISTS tournament_results (
    id SERIAL PRIMARY KEY,
    tournament_id INT REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    placement INT NOT NULL,
    old_rating INT NOT NULL,
    new_rating INT NOT NULL,
    rating_change INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


--  VIEW: TRAINERS (JOGADORES DE TORNEIOS ATIVOS)

CREATE OR REPLACE VIEW v_trainers AS
SELECT
    p.id AS player_id,
    p.name,
    p.email,
    tr.id AS tournament_id,
    tr.name AS tournament_name,
    ARRAY_AGG(pk.name ORDER BY pk.name) AS pokemon_list
FROM participants pa
JOIN players p ON pa.players_id = p.id
JOIN tournaments tr ON pa.tournaments_id = tr.id
LEFT JOIN choices c ON c.participants_id = pa.id
LEFT JOIN pokemons pk ON pk.id = c.pokemons_id
WHERE tr.dateEnd IS NULL
GROUP BY p.id, p.name, p.email, tr.id, tr.name;


--  VIEW: CONFIG (DADOS DO ÚLTIMO TORNEIO)

CREATE OR REPLACE VIEW v_config AS
SELECT
    id,
    name AS titulo,
    titulo2,
    gen,
    sprites,
    qtdLimitado,
    qtdLimitadoLendario,
    listaLimitado,
    listaLimitadoLendario,
    listaBanido,
    hook,
    enviarDiscord,
    qtdEscolha,
    encerrado,
    prizes,
    monotype
FROM tournaments
ORDER BY dateStart DESC, id DESC
LIMIT 1;