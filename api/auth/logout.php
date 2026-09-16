<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';

destroyApplicationSession();

jsonResponse([
    'authenticated' => false,
]);
