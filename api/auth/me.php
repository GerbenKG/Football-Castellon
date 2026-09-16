<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';

$user = currentUser();

if ($user === null) {
    jsonResponse([
        'authenticated' => false,
    ], 401);
}

jsonResponse([
    'authenticated' => true,
    'user' => [
        'id' => $user['id'],
        'email' => $user['email'],
        'display_name' => $user['display_name'],
        'role' => $user['role'],
        'player_id' => $user['player_id'],
    ],
]);
