<?php
declare(strict_types=1);
require_once __DIR__.'/auth/session.php';
require_once __DIR__.'/auth/csrf-lib.php';
require_once __DIR__.'/query-lib.php';
require_once __DIR__.'/club-lib.php';
require_once __DIR__.'/arcade-lib.php';
$user=requireUser();$pdo=db();
try{
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if(!in_array($method,['GET','POST'],true))jsonResponse(['error'=>'Method not allowed'],405);
    if($method==='POST')requireCsrfToken();
    ensureArcadeSchema($pdo);clubRequire($user,'arcade.view');
    if($method==='GET')jsonResponse(arcadeSnapshot($pdo,$user));
    $raw=file_get_contents('php://input')?:'';if(strlen($raw)>20000)throw new InvalidArgumentException('Game request is too large');
    $body=json_decode($raw,true);if(!is_array($body))throw new InvalidArgumentException('Invalid game request');
    $pdo->beginTransaction();$result=arcadeMutate($pdo,$user,$body);$pdo->commit();jsonResponse($result);
}catch(Throwable $e){
    if($pdo->inTransaction())$pdo->rollBack();$expected=$e instanceof DomainException||$e instanceof InvalidArgumentException;
    if(!$expected)error_log('Games API: '.$e->getMessage());
    jsonResponse(['error'=>$expected?$e->getMessage():'Games are temporarily unavailable. Please try again.'],$e instanceof DomainException?403:($expected?422:500));
}
