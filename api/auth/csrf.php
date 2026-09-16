<?php

declare(strict_types=1);

require_once __DIR__ . '/csrf-lib.php';

requireUser();
jsonResponse(['csrf_token' => csrfToken()]);
