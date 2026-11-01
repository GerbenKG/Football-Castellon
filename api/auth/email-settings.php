<?php
declare(strict_types=1);
require_once __DIR__.'/session.php';
require_once __DIR__.'/csrf-lib.php';
require_once __DIR__.'/email-code-lib.php';
$user=requireUser();if($user['role']!=='super_admin')jsonResponse(['error'=>'Only a Club owner can edit sign-in emails'],403);
$pdo=db();ensureEmailLoginSchema($pdo);$method=$_SERVER['REQUEST_METHOD']??'GET';
if($method==='GET')jsonResponse(['sender'=>'login@castellon.futbol','template'=>emailLoginTemplate($pdo)]);
if($method!=='POST')jsonResponse(['error'=>'Method not allowed'],405);
requireCsrfToken();$body=json_decode(file_get_contents('php://input')?:'',true);
foreach(['sender_name'=>80,'subject'=>160,'body'=>4000] as $key=>$max){if(!is_string($body[$key]??null)||trim($body[$key])===''||strlen($body[$key])>$max)jsonResponse(['error'=>'Fill in the sender name, subject and email text within the size limits.'],422);}
if(preg_match('/[\r\n\x00-\x1f\x7f]/',$body['sender_name'].$body['subject'])||!str_contains($body['body'],'{code}')||!str_contains($body['body'],'{minutes}')||!str_contains($body['body'],'{site}'))jsonResponse(['error'=>'Keep {code}, {minutes} and {site} in the email text. Sender and subject must use one line.'],422);
$template=array_intersect_key($body,array_flip(['sender_name','subject','body']));
$pdo->prepare('INSERT INTO email_login_settings (host,payload) VALUES (?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload)')->execute([emailLoginHost(),json_encode($template,JSON_THROW_ON_ERROR)]);
jsonResponse(['saved'=>true,'sender'=>'login@castellon.futbol','template'=>$template]);
