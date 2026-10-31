<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
try {
    db()->query('SELECT 1')->fetch();
    jsonResponse(['status' => 'ok', 'database' => 'connected']);
} catch (Throwable $error) {
    jsonResponse(['status' => 'error', 'error' => 'Database connection unavailable'], 503);
}
