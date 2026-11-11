<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') { http_response_code(404); exit; }
require_once __DIR__ . '/predictions-lib.php';
try {
    $pdo=db();
    $result=predictionSync($pdo,true);
    echo json_encode(['ok'=>true]+$result,JSON_UNESCAPED_SLASHES).PHP_EOL;
} catch(Throwable $e) {
    error_log('League Games Predictions sync: '.$e->getMessage());
    fwrite(STDERR,'Sync failed: '.$e->getMessage().PHP_EOL);
    exit(1);
}
