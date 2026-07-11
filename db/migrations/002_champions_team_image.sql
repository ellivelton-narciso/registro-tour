-- Modo Pokémon Champions (gen 9): screenshot do time no upload

ALTER TABLE participants
    ADD COLUMN IF NOT EXISTS team_image VARCHAR(255) DEFAULT NULL;

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
