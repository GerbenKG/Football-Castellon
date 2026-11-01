<?php
declare(strict_types=1);
require_once __DIR__.'/auth/session.php';
require_once __DIR__.'/auth/csrf-lib.php';
require_once __DIR__.'/clubs-lib.php';
$user=requireUser();$method=$_SERVER['REQUEST_METHOD']??'GET';
try{
 if($method==='GET'&&isset($_GET['badge'])){
    $id=$_GET['badge'];if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))jsonResponse(['error'=>'Badge not found'],404);
    $path=clubBadgeDirectory().'/'.$id.'.image';if(!is_file($path))jsonResponse(['error'=>'Badge not found'],404);
    $info=@getimagesize($path);if(!$info||!in_array($info['mime'],['image/jpeg','image/png','image/webp'],true))jsonResponse(['error'=>'Badge not found'],404);
    header('Content-Type: '.$info['mime']);header('Cache-Control: private, max-age=86400');header('X-Content-Type-Options: nosniff');readfile($path);exit;
 }
 if($method==='GET'){
    if(isset($_GET['countries']))jsonResponse(['countries'=>clubCountries()]);
    $q=$_GET['q']??'';if(!is_string($q)||strlen(trim($q))<2||strlen($q)>100)throw new InvalidArgumentException('Enter at least two letters of the club name.');
    jsonResponse(['clubs'=>clubSearch(trim($q))]);
 }
 if($method!=='POST')jsonResponse(['error'=>'Method not allowed'],405);
 requireCsrfToken();$name=trim((string)($_POST['name']??''));$country=clubCountry((string)($_POST['country']??''));
 if($name===''||strlen($name)>160||!in_array($country,clubCountries(),true))throw new InvalidArgumentException('Enter the club name and choose its European country.');
 $file=$_FILES['badge']??null;if(!$file||$file['error']!==UPLOAD_ERR_OK||$file['size']>2*1024*1024||!is_uploaded_file($file['tmp_name']))throw new InvalidArgumentException('Upload a JPG, PNG or WebP badge smaller than 2 MB.');
 $id=bin2hex(random_bytes(16));clubSaveBadge($id,(string)file_get_contents($file['tmp_name']));
 $club=['id'=>'custom-'.$id,'name'=>$name,'country'=>$country,'badge_id'=>$id,'source'=>'Club member','owner'=>$user['id']];clubCacheWrite($club['id'].'.json',$club);jsonResponse(['club'=>clubPublicChoice($club)]);
}catch(Throwable $e){jsonResponse(['error'=>$e instanceof InvalidArgumentException||$e instanceof DomainException?$e->getMessage():'Club search is temporarily unavailable. You can still add a club with its badge.'],$e instanceof InvalidArgumentException?422:($e instanceof DomainException?403:503));}
