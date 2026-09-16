<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $stmt = db()->query(
        'SELECT id, game_date, start_time, end_time, location
         FROM games
         ORDER BY game_date, start_time'
    );

    jsonResponse([
        'games' => $stmt->fetchAll(),
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'error' => 'Unable to load games',
    ], 500);
}
