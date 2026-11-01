<?php
declare(strict_types=1);
// Exercise real CSRF validation without a database or production credentials.
const APP_SESSION_COOKIE = '__Host-fc_session';
class ApiReply extends RuntimeException {}
function jsonResponse(array $data, int $status = 200): never { throw new ApiReply($data['error'] ?? '', $status); }
$source = file_get_contents(__DIR__ . '/../api/auth/csrf-lib.php');
$source = preg_replace('/^<\?php\s*declare\(strict_types=1\);/', '', $source);
$source = preg_replace('/^require_once .*;\r?$/m', '', $source);
eval($source);
$_COOKIE[APP_SESSION_COOKIE] = 'test-browser-session-secret';
$_SERVER['HTTP_X_CSRF_TOKEN'] = csrfToken();
requireCsrfToken();
echo "PASS: session-bound token accepted\n";
$token = $_SERVER['HTTP_X_CSRF_TOKEN'];
foreach (['missing', 'forged', 'other-session'] as $case) {
    $_COOKIE[APP_SESSION_COOKIE] = $case === 'other-session' ? 'different-browser-session' : 'test-browser-session-secret';
    $_SERVER['HTTP_X_CSRF_TOKEN'] = match ($case) { 'missing' => '', 'forged' => str_repeat('0', 64) . '.' . str_repeat('0', 64), default => $token };
    try { requireCsrfToken(); throw new RuntimeException('Unsafe token accepted'); }
    catch (ApiReply $reply) { if ($reply->getCode() !== 403) throw $reply; }
    echo "PASS: $case token rejected\n";
}
