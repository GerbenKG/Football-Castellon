<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/auth/session.php';

try {
    requireUser();

    $stmt = db()->query(
        'SELECT id, game_id, player_id, guest_name, playing, paid
         FROM game_players
         ORDER BY game_id, created_at'
    );

    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['playing'] = (bool) $row['playing'];
        $row['paid'] = (bool) $row['paid'];
    }
    unset($row);

    jsonResponse(['game_players' => $rows]);
} catch (Throwable $e) {
    if ($e instanceof PDOException) {
        jsonResponse(['error' => 'Unable to load game squad'], 500);
    }

    throw $e;
}
