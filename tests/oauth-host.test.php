<?php
declare(strict_types=1);
require __DIR__ . '/../api/bootstrap.php';
set_exception_handler(static function (Throwable $error): void { fwrite(STDERR, $error->getMessage()); exit(1); });
foreach (['castellon.futbol', 'dev.castellon.futbol'] as $host) {
    if (oauthRedirectUri([], $host) !== 'https://' . $host . '/api/auth/google-callback.php') throw new RuntimeException('Wrong callback');
    echo "PASS: callback stays on $host\n";
}
foreach (['evil.example','castellon.futbol.evil.example','localhost:3001','castellon.futbol@evil.example'] as $host) {
    try { oauthRedirectUri([], $host); throw new LogicException('Untrusted callback accepted'); }
    catch (RuntimeException $error) { if ($error instanceof LogicException) throw $error; }
    echo "PASS: unconfigured hostname rejected\n";
}
foreach (['http://dev.castellon.futbol/api/auth/google-callback.php', 'https://evil.example/api/auth/google-callback.php'] as $uri) {
    $rejected = false;
    try { oauthRedirectUri(['redirect_uris' => ['dev.castellon.futbol' => $uri]], 'dev.castellon.futbol'); }
    catch (RuntimeException $error) { $rejected = true; }
    if (!$rejected) throw new LogicException('Unsafe callback accepted');
    echo "PASS: insecure or cross-host callback rejected\n";
}
