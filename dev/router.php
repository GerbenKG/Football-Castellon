<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/api/bootstrap.php';
if (!isLocalDevelopment()) {
    http_response_code(404);
    exit;
}
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$path = str_replace('\\', '/', $path);
if (str_contains($path, '%') || str_contains($path, "\0")) { http_response_code(404); exit; }
if (preg_match('~(^|/)\.|^/(dev|tests)(/|$)|^/(README|BRANCH-STATUS)~i', $path)) {
    http_response_code(404);
    exit;
}
if ($path === '/api/auth/google.php') {
    require __DIR__ . '/login.php';
    exit;
}
if ($path === '/') {
    header('Content-Type: text/html; charset=utf-8');
    $html = file_get_contents(dirname(__DIR__) . '/index.html');
    $notice = '<div style="background:#fff3cd;color:#5c4300;padding:10px;text-align:center;font:14px system-ui">LOCAL TEST — sample data only · Google sign-in is simulated · <a href="/api/auth/google.php">Switch test account</a></div>';
    echo str_replace('<body>', '<body>' . $notice, $html);
    exit;
}
return false;
