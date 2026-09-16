<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '1');
ini_set('session.cookie_samesite', 'Lax');

session_name('fc_oauth');
session_start();

function authError(string $message, int $status = 400): never
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Login</title></head><body>';
    echo '<h1>Login could not be completed</h1><p>' . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</p>';
    echo '<p><a href="/">Back to Football Castellón</a></p></body></html>';
    exit;
}

if (isset($_GET['error'])) {
    authError('Google did not complete the sign-in request.');
}

$state = $_GET['state'] ?? '';
$expectedState = $_SESSION['oauth_state'] ?? '';
unset($_SESSION['oauth_state']);

if (!is_string($state) || !is_string($expectedState) || $state === '' || !hash_equals($expectedState, $state)) {
    authError('Invalid sign-in state. Please start the login process again.', 403);
}

$code = $_GET['code'] ?? '';
if (!is_string($code) || $code === '') {
    authError('Google did not return an authorization code.');
}

$config = require dirname(__DIR__, 3) . '/google-config.php';
$redirectUri = 'https://castellon.futbol/api/auth/google-callback.php';

$ch = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query([
        'code' => $code,
        'client_id' => $config['client_id'],
        'client_secret' => $config['client_secret'],
        'redirect_uri' => $redirectUri,
        'grant_type' => 'authorization_code',
    ], '', '&', PHP_QUERY_RFC3986),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
]);
$tokenResponse = curl_exec($ch);
$tokenStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($tokenResponse === false || $tokenStatus < 200 || $tokenStatus >= 300) {
    authError('Google token exchange failed. Please try again.');
}

$tokenData = json_decode($tokenResponse, true);

if (!is_array($tokenData)) {
    authError('Google returned an invalid token response.');
}

$accessToken = $tokenData['access_token'] ?? '';

if (!is_string($accessToken) || $accessToken === '') {
    authError('Google did not return a valid access token.');
}

$ch = curl_init('https://openidconnect.googleapis.com/v1/userinfo');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
]);
$userResponse = curl_exec($ch);
$userStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($userResponse === false || $userStatus < 200 || $userStatus >= 300) {
    authError('Google account information could not be verified.');
}

$googleUser = json_decode($userResponse, true);

if (!is_array($googleUser)) {
    authError('Google returned invalid account information.');
}

$googleSubject = $googleUser['sub'] ?? '';
$email = strtolower(trim((string) ($googleUser['email'] ?? '')));
$displayName = trim((string) ($googleUser['name'] ?? ''));
$emailVerified = (bool) ($googleUser['email_verified'] ?? false);

if (!is_string($googleSubject) || $googleSubject === '' || $email === '' || !$emailVerified) {
    authError('The Google account did not provide a verified email address.');
}

$pdo = db();

try {
    $pdo->beginTransaction();

    $profileStmt = $pdo->prepare(
        'SELECT email, user_id, display_name, role, active, player_id
         FROM access_profiles
         WHERE email = :email
         LIMIT 1'
    );
    $profileStmt->execute(['email' => $email]);
    $profile = $profileStmt->fetch();

    if (!$profile || !(bool) $profile['active']) {
        $pdo->rollBack();
        authError('This Google account is not authorized for Football Castellón.', 403);
    }

    $userStmt = $pdo->prepare(
        'SELECT id, google_subject, email
         FROM users
         WHERE google_subject = :google_subject
         LIMIT 1'
    );
    $userStmt->execute(['google_subject' => $googleSubject]);
    $user = $userStmt->fetch();

    if ($user && strtolower((string) $user['email']) !== $email) {
        $pdo->rollBack();
        authError('The Google account does not match the authorized account.', 403);
    }

    if ($profile['user_id'] !== null && (!$user || $profile['user_id'] !== $user['id'])) {
        $pdo->rollBack();
        authError('This access profile is linked to a different account.', 403);
    }

    if (!$user) {
        $userId = uuidV4();
        $insertUser = $pdo->prepare(
            'INSERT INTO users (id, google_subject, email, display_name, last_login_at)
             VALUES (:id, :google_subject, :email, :display_name, UTC_TIMESTAMP())'
        );
        $insertUser->execute([
            'id' => $userId,
            'google_subject' => $googleSubject,
            'email' => $email,
            'display_name' => $displayName !== '' ? $displayName : $email,
        ]);
        $user = [
            'id' => $userId,
            'google_subject' => $googleSubject,
            'email' => $email,
        ];
    } else {
        $pdo->prepare(
            'UPDATE users
             SET display_name = :display_name, last_login_at = UTC_TIMESTAMP()
             WHERE id = :id'
        )->execute([
            'display_name' => $displayName !== '' ? $displayName : $email,
            'id' => $user['id'],
        ]);
    }

    $pdo->prepare(
        'UPDATE access_profiles
         SET user_id = :user_id,
             display_name = CASE WHEN :profile_name <> \'\' THEN :display_name ELSE display_name END
         WHERE email = :email'
    )->execute([
        'user_id' => $user['id'],
        'profile_name' => $displayName,
        'display_name' => $displayName,
        'email' => $email,
    ]);

    $pdo->commit();

    session_regenerate_id(true);
    $_SESSION = [];
    session_destroy();

    setApplicationSession((string) $user['id']);

    header('Location: /api/auth/me.php');
    exit;
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    authError('Login could not be completed. Please try again.', 500);
}
