<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/csrf-lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
requireCsrfToken();

destroyApplicationSession();

jsonResponse([
    'authenticated' => false,
]);
