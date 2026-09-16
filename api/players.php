<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $stmt = db()->query(
        'SELECT id, name, phone, email
         FROM players
         ORDER BY name'
    );

    jsonResponse([
        'players' => $stmt->fetchAll(),
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'error' => 'Unable to load players',
    ], 500);
}
