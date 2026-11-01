<?php
declare(strict_types=1);
require_once __DIR__.'/session.php';
require_once __DIR__.'/csrf-lib.php';
require_once __DIR__.'/presence-lib.php';
$user=requireUser();
if(previewRequested())jsonResponse(['error'=>'Member preview does not change online presence'],403);
if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')jsonResponse(['error'=>'Method not allowed'],405);
requireCsrfToken();
$body=json_decode(file_get_contents('php://input')?:'',true);$client=$body['client_id']??null;$action=$body['action']??'heartbeat';
if(!is_string($client)||!preg_match('/^[a-f0-9]{32}$/D',$client)||!in_array($action,['heartbeat','leave'],true))jsonResponse(['error'=>'Invalid online status request'],422);
$pdo=db();ensurePresenceSchema($pdo);
if($action==='leave'){presenceLeave($pdo,$user['id'],$client);jsonResponse(['ok'=>true]);}
jsonResponse(['members'=>presenceHeartbeat($pdo,$user['id'],$client)]);
