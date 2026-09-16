<?php

header('Content-Type: application/json');

try {
    $config = require dirname(__DIR__, 2) . '/db-config.php';

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
        ]
    );

    $result = $pdo->query('SELECT 1 AS db_ok')->fetch();

    echo json_encode([
        'status' => 'ok',
        'php' => PHP_VERSION,
        'database' => 'connected',
        'db_test' => $result['db_ok'],
    ]);

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
    ]);
}