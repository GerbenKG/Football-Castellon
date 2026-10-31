<?php

declare(strict_types=1);

set_exception_handler(static function (Throwable $error): void {
    error_log('Football API: ' . $error->getMessage());
    jsonResponse(['error' => 'The application service is unavailable'], 500);
});

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $configPath = dirname(__DIR__, 2) . '/db-config.php';
    if (!is_file($configPath)) throw new RuntimeException('Database configuration is missing');
    $config = require $configPath;

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['host'],
        $config['port'],
        $config['database']
    );

    $pdo = new PDO(
        $dsn,
        $config['username'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    return $pdo;
}

function googleConfig(): array
{
    $path = dirname(__DIR__, 2) . '/google-config.php';
    if (!is_file($path)) throw new RuntimeException('Google sign-in configuration is missing');
    $config = require $path;
    if (!is_array($config) || empty($config['client_id']) || empty($config['client_secret'])) throw new RuntimeException('Google sign-in configuration is invalid');
    return $config;
}

function jsonResponse(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');

    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    exit;
}
