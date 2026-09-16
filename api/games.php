<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/auth/session.php';

try {
    requireUser();

    $stmt = db()->query(
        'SELECT id, game_date, start_time, end_time, location
         FROM games
         ORDER BY game_date, start_time'
    );

    jsonResponse([
        'games' => $stmt->fetchAll(),
    ]);
} catch (Throwable $e) {
    if ($e instanceof PDOException) {
        jsonResponse([
            'error' => 'Unable to load games',
        ], 500);
    }

    throw $e;
}
