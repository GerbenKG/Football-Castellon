<?php
declare(strict_types=1);
require_once __DIR__.'/session.php';
require_once __DIR__.'/email-code-lib.php';
header('Cache-Control: no-store');
$method=$_SERVER['REQUEST_METHOD']??'GET';
if($method!=='POST')jsonResponse(['error'=>'Method not allowed'],405);
$host=emailLoginHost();$origin=isLocalDevelopment()?'http://'.($_SERVER['HTTP_HOST']??''):'https://'.$host;
if(($_SERVER['HTTP_ORIGIN']??'')!==$origin||!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'))jsonResponse(['error'=>'Start sign-in from the clubhouse website.'],403);
$body=json_decode(file_get_contents('php://input')?:'',true);
if(!is_array($body))jsonResponse(['error'=>'Invalid request'],400);
$pdo=db();ensureEmailLoginSchema($pdo);
$cookie=isLocalDevelopment()?'fc_dev_email_code':'__Host-fc_email_code';
try {
    $action=$body['action']??'';
    if($action==='request'){
        $email=is_string($body['email']??null)?strtolower(trim($body['email'])):'';
        if(strlen($email)>254||!filter_var($email,FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$email))jsonResponse(['error'=>'Enter a valid email address.'],422);
        $started=microtime(true);$challenge=emailLoginIssue($pdo,$email,$_SERVER['REMOTE_ADDR']??'');
        setcookie($cookie,$challenge['token'],['expires'=>time()+EMAIL_CODE_SECONDS,'path'=>'/','secure'=>!isLocalDevelopment(),'httponly'=>true,'samesite'=>'Strict']);
        // FastCGI sends the same response before contacting mail, hiding membership and delivery timing.
        $response=['message'=>'If this email belongs to an active club member, a code will arrive shortly.','expires_in'=>EMAIL_CODE_SECONDS,'resend_after'=>60];
        if(function_exists('fastcgi_finish_request')){
            header('Content-Type: application/json; charset=utf-8');header('X-Content-Type-Options: nosniff');echo json_encode($response);fastcgi_finish_request();emailLoginDeliver($pdo,$email,$challenge);exit;
        }
        emailLoginDeliver($pdo,$email,$challenge);
        $remaining=0.8-(microtime(true)-$started);if($remaining>0)usleep((int)($remaining*1000000));
        jsonResponse($response);
    }
    if($action==='verify'){
        $token=$_COOKIE[$cookie]??'';$code=$body['code']??'';
        if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token)||!is_string($code))jsonResponse(['error'=>'The code is invalid or expired. Request a new code and use the same browser.'],422);
        $id=emailLoginVerify($pdo,$token,trim($code),$_SERVER['REMOTE_ADDR']??'');
        if(!$id)jsonResponse(['error'=>'The code is invalid or expired. Request a new code and use the same browser.'],422);
        setcookie($cookie,'',['expires'=>1,'path'=>'/','secure'=>!isLocalDevelopment(),'httponly'=>true,'samesite'=>'Strict']);
        setApplicationSession($id);jsonResponse(['signed_in'=>true]);
    }
    jsonResponse(['error'=>'Unsupported sign-in action'],400);
}catch(OverflowException $e){header('Retry-After: 60');jsonResponse(['error'=>$e->getMessage()],429);}
