-- MariaDB compatibility patch for the initial Football Castellón schema.
-- The application enforces these cross-column invariants in the PHP API.
-- Run this only if the schema import created game_players successfully but
-- rejected the CHECK constraints below.

ALTER TABLE game_players
    DROP CONSTRAINT chk_game_players_identity,
    DROP CONSTRAINT chk_game_players_guest;
