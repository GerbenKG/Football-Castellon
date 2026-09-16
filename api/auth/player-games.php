<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';

$user = requireUser();
$pdo = db();

if ($user['role'] !== 'player' || !$user['player_id']) {
    jsonResponse(['error' => 'Player access required'], 403);
}

$stmt = $pdo->prepare(
    'SELECT
        g.id,
        g.game_date,
        g.start_time,
        g.end_time,
        g.location,
        CASE WHEN gp.playing = TRUE THEN TRUE ELSE FALSE END AS playing,
        COALESCE(pc.playing_count, 0) AS playing_count
     FROM games g
     LEFT JOIN game_players gp
       ON gp.game_id = g.id
      AND gp.player_id = :player_id
     LEFT JOIN (
        SELECT game_id, COUNT(*) AS playing_count
        FROM game_players
        WHERE playing = TRUE
        GROUP BY game_id
     ) pc ON pc.game_id = g.id
     ORDER BY g.game_date ASC, g.start_time ASC'
);
$stmt->execute(['player_id' => $user['player_id']]);

$games = $stmt->fetchAll();
foreach ($games as &$game) {
    $game['playing'] = (bool) $game['playing'];
    $game['playing_count'] = (int) $game['playing_count'];
}
unset($game);

jsonResponse($games);
