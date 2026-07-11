-- CONFIG WHATSAPP

CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    base_rating INT NOT NULL DEFAULT 1000
);

CREATE TABLE IF NOT EXISTS season_player_archive (
    id SERIAL PRIMARY KEY,
    season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    final_rating INT NOT NULL,
    total_matches INT NOT NULL DEFAULT 0,
    total_wins INT NOT NULL DEFAULT 0,
    archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (season_id, player_id)
);

CREATE TABLE config (
	id SERIAL PRIMARY KEY,
	k_match INT NULL,
	k_tournament INT NULL,
	group_ids TEXT[] NULL,
	admin_ids TEXT[] NULL,
	min_rating INT NULL,
	current_season_id INT NULL REFERENCES seasons(id)
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
    rating INT NOT NULL DEFAULT 1000,
    coins INT NOT NULL DEFAULT 0,
    total_matches INT DEFAULT 0,
    total_wins INT DEFAULT 0
);



--  SHOP
CREATE TABLE IF NOT EXISTS shop_items (
	id serial4 NOT NULL,
	pokemon_name varchar(50) NOT NULL,
	price int4 NOT NULL,
	sold bool DEFAULT false NULL,
	generation int4 DEFAULT 1 NOT NULL,
	options_poke varchar(50) NULL,
	CONSTRAINT shop_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS shop_transactions (
	id serial4 NOT NULL,
	player_id int4 NOT NULL,
	item_id int4 NOT NULL,
	purchased_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	delivered bool DEFAULT false NOT NULL,
	CONSTRAINT shop_transactions_pkey PRIMARY KEY (id)
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
    season_id INT REFERENCES seasons(id),
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
    formatoCopa VARCHAR(20) DEFAULT 'groups',
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
    team_image VARCHAR(255) DEFAULT NULL,
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
    tr.gen AS tournament_gen,
    pa.team_image,
    array_agg(pk.name ORDER BY pk.name) FILTER (WHERE pk.name IS NOT NULL) AS pokemon_list
FROM participants pa
JOIN players p ON pa.players_id = p.id
JOIN tournaments tr ON pa.tournaments_id = tr.id
LEFT JOIN choices c 
    ON c.participants_id = pa.id
   AND c.tournaments_id = tr.id
LEFT JOIN pokemons pk
    ON pk.id = c.pokemons_id
   AND (pk.af = c.pokemons_af OR (c.pokemons_af IS NULL AND (pk.af IS NULL OR pk.af = '')))
WHERE tr.dateend IS NULL
GROUP BY p.id, p.name, p.email, tr.id, tr.name, tr.gen, pa.team_image;


--  VIEW: CONFIG (DADOS DO ÚLTIMO TORNEIO)

CREATE OR REPLACE VIEW v_config
AS SELECT tournaments.id,
    tournaments.name AS titulo,
    tournaments.titulo2,
    tournaments.gen,
    tournaments.sprites,
    tournaments.qtdlimitado,
    tournaments.qtdlimitadolendario,
    tournaments.listalimitado,
    tournaments.listalimitadolendario,
    tournaments.listabanido,
    tournaments.hook,
    tournaments.enviardiscord,
    tournaments.qtdescolha,
    tournaments.encerrado,
    tournaments.prizes,
    tournaments.monotype,
    tournaments.paymentregister
   FROM tournaments
  ORDER BY tournaments.datestart DESC, tournaments.id DESC
 LIMIT 1;

CREATE VIEW v_player_stats AS
SELECT 
    p.id AS player_id,
    SUM(
        CASE 
            WHEN (m.player_a_id = p.id AND m.winner = 'A')
              OR (m.player_b_id = p.id AND m.winner = 'B')
            THEN 1 ELSE 0 
        END
    ) AS wins,
    SUM(
        CASE 
            WHEN (m.player_a_id = p.id AND m.winner = 'B')
              OR (m.player_b_id = p.id AND m.winner = 'A')
            THEN 1 ELSE 0 
        END
    ) AS losses
FROM 
    players p
LEFT JOIN 
    matches m ON m.player_a_id = p.id OR m.player_b_id = p.id
GROUP BY 
    p.id;
