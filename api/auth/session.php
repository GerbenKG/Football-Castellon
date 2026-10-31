<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

const APP_SESSION_COOKIE = '__Host-fc_session';
const APP_SESSION_DAYS = 7;

function uuidV4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function setApplicationSession(string $userId): void
{
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $sessionId = uuidV4();

    $pdo = db();
    $pdo->exec('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()');

    $stmt = $pdo->prepare(
        'INSERT INTO sessions (id, user_id, token_hash, expires_at, last_seen_at)
         VALUES (:id, :user_id, :token_hash, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY), UTC_TIMESTAMP())'
    );
    $stmt->execute([
        'id' => $sessionId,
        'user_id' => $userId,
        'token_hash' => $tokenHash,
    ]);

    setcookie(APP_SESSION_COOKIE, $token, [
        'expires' => time() + (APP_SESSION_DAYS * 86400),
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function currentUser(): ?array
{
    $token = $_COOKIE[APP_SESSION_COOKIE] ?? '';

    if (!is_string($token) || $token === '') {
        return null;
    }

    $tokenHash = hash('sha256', $token);

    $stmt = db()->prepare(
        'SELECT
            u.id,
            u.email,
            u.display_name,
            ap.role,
            ap.active,
            ap.player_id,
            ap.phone,
            ap.contact_email,
            ap.avatar_path
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         INNER JOIN access_profiles ap ON ap.user_id = u.id
         WHERE s.token_hash = :token_hash
           AND s.expires_at > UTC_TIMESTAMP()
           AND ap.active = TRUE
         LIMIT 1'
    );
    $stmt->execute(['token_hash' => $tokenHash]);
    $user = $stmt->fetch();

    if (!$user) {
        return null;
    }

    db()->prepare(
        'UPDATE sessions SET last_seen_at = UTC_TIMESTAMP() WHERE token_hash = :token_hash'
    )->execute(['token_hash' => $tokenHash]);

    return $user;
}

function requireUser(): array
{
    $user = currentUser();

    if ($user === null) {
        jsonResponse(['error' => 'Authentication required'], 401);
    }

    return $user;
}

function destroyApplicationSession(): void
{
    $token = $_COOKIE[APP_SESSION_COOKIE] ?? '';

    if (is_string($token) && $token !== '') {
        db()->prepare('DELETE FROM sessions WHERE token_hash = :token_hash')
            ->execute(['token_hash' => hash('sha256', $token)]);
    }

    setcookie(APP_SESSION_COOKIE, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
