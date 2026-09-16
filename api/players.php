<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/auth/session.php';

try {
    requireUser();

    $stmt = db()->query(
        'SELECT id, name, phone, email
         FROM players
         ORDER BY name'
    );

    jsonResponse([
        'players' => $stmt->fetchAll(),
    ]);
} catch (Throwable $e) {
    if ($e instanceof PDOException) {
        jsonResponse([
            'error' => 'Unable to load players',
        ], 500);
    }

    throw $e;
}
