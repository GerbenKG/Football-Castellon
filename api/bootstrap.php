<?php

declare(strict_types=1);

set_exception_handler(static function (Throwable $error): void {
    error_log('Football API: ' . $error->getMessage());
    jsonResponse(['error' => 'The application service is unavailable'], 500);
});

function isLocalDevelopment(): bool
{
    $host = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
    return PHP_SAPI === 'cli-server'
        && getenv('FOOTBALL_LOCAL_DEV') === '1'
        && in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)
        && in_array($host, ['localhost', '127.0.0.1'], true);
}

function avatarStorageDirectory(): string
{
    return isLocalDevelopment()
        ? dirname(__DIR__) . '/.local/avatars'
        : dirname(__DIR__, 2) . '/football-avatars';
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $configPath = isLocalDevelopment()
        ? dirname(__DIR__) . '/.local/db-config.php'
        : dirname(__DIR__, 2) . '/db-config.php';
    if (!is_file($configPath)) throw new RuntimeException('Database configuration is missing');
    $config = require $configPath;
    if (isLocalDevelopment() && ($config['host'] !== '127.0.0.1' || $config['database'] !== 'football_castellon_dev')) throw new RuntimeException('Invalid local database configuration');

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
