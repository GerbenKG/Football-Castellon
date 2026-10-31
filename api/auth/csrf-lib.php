<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';

function csrfSecret(): string
{
    // The application session token is already the secret credential for this
    // browser session. Keep the CSRF signing key independent from db-config.php
    // so the CSRF endpoint cannot fail because of deployment-path/config issues.
    return hash('sha256', APP_SESSION_COOKIE . '|football-castellon-csrf-v2', true);
}

function csrfToken(): string
{
    $sessionToken = $_COOKIE[APP_SESSION_COOKIE] ?? '';
    if (!is_string($sessionToken) || $sessionToken === '') {
        jsonResponse(['error' => 'Authentication required'], 401);
    }

    $nonce = bin2hex(random_bytes(32));
    $signature = hash_hmac(
        'sha256',
        $nonce . '.' . hash('sha256', $sessionToken),
        csrfSecret()
    );

    return $nonce . '.' . $signature;
}

function requireCsrfToken(): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $sessionToken = $_COOKIE[APP_SESSION_COOKIE] ?? '';

    if (!is_string($provided) || !is_string($sessionToken) || $sessionToken === '') {
        jsonResponse(['error' => 'CSRF validation failed'], 403);
    }

    $parts = explode('.', $provided, 2);
    if (count($parts) !== 2 || !preg_match('/^[a-f0-9]{64}$/', $parts[0]) || !preg_match('/^[a-f0-9]{64}$/', $parts[1])) {
        jsonResponse(['error' => 'CSRF validation failed'], 403);
    }

    $expected = hash_hmac(
        'sha256',
        $parts[0] . '.' . hash('sha256', $sessionToken),
        csrfSecret()
    );

    if (!hash_equals($expected, $parts[1])) {
        jsonResponse(['error' => 'CSRF validation failed'], 403);
    }
}
