<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/csrf-lib.php';

$user = requireUser();
$pdo = db();

function profileForEmail(PDO $pdo, string $email): ?array
{
    $stmt = $pdo->prepare(
        'SELECT
            ap.email,
            ap.display_name,
            ap.role,
            ap.player_id,
            ap.phone,
            ap.contact_email,
            COALESCE(ap.avatar_path, u.avatar_path) AS avatar_path,
            p.name AS player_name,
            p.bibs_taken_count
         FROM access_profiles ap
         LEFT JOIN users u ON u.id = ap.user_id
         LEFT JOIN players p ON p.id = ap.player_id
         WHERE ap.email = :email
         LIMIT 1'
    );
    $stmt->execute(['email' => $email]);
    $row = $stmt->fetch();
    if (!$row) return null;

    return [
        'id' => $row['player_id'] ?: $row['email'],
        'name' => $row['player_name'] ?: ($row['display_name'] ?: $row['email']),
        'email' => $row['contact_email'] ?: $row['email'],
        'phone' => $row['phone'],
        'role' => $row['role'],
        'avatar_path' => $row['avatar_path'],
        'bibs_taken_count' => (int) ($row['bibs_taken_count'] ?? 0),
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $previewEmail = trim((string) ($_GET['preview_email'] ?? ''));

    if ($previewEmail !== '') {
        if ($user['role'] !== 'super_admin') {
            jsonResponse(['error' => 'Permission denied'], 403);
        }
        $profile = profileForEmail($pdo, strtolower($previewEmail));
    } else {
        $profile = profileForEmail($pdo, $user['email']);
    }

    if (!$profile) {
        jsonResponse(['error' => 'Member profile is not available'], 404);
    }

    jsonResponse($profile);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireCsrfToken();

    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        jsonResponse(['error' => 'Invalid request body'], 400);
    }

    $phone = trim((string) ($body['phone'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));

    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'Please enter a valid email address.'], 422);
    }

    $stmt = $pdo->prepare(
        'UPDATE access_profiles
         SET phone = :phone,
             contact_email = :contact_email
         WHERE email = :login_email'
    );
    $stmt->execute([
        'phone' => $phone !== '' ? $phone : null,
        'contact_email' => $email !== '' ? $email : null,
        'login_email' => $user['email'],
    ]);

    jsonResponse(['ok' => true]);
}

jsonResponse(['error' => 'Method not allowed'], 405);
