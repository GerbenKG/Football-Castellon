<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '1');
ini_set('session.cookie_samesite', 'Lax');

session_name('fc_oauth');
session_start();

$config = require dirname(__DIR__, 2) . '/google-config.php';
$redirectUri = 'https://castellon.futbol/api/auth/google-callback.php';
$state = bin2hex(random_bytes(32));

$_SESSION['oauth_state'] = $state;

$params = [
    'client_id' => $config['client_id'],
    'redirect_uri' => $redirectUri,
    'response_type' => 'code',
    'scope' => 'openid email profile',
    'state' => $state,
    'include_granted_scopes' => 'true',
    'prompt' => 'select_account',
];

header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986));
exit;
