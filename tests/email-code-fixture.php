<?php
declare(strict_types=1);
// CLI helper strictly confined to the disposable sample database.
if(PHP_SAPI!=='cli')exit(1);
$config=require __DIR__.'/../.local/db-config.php';
if($config['host']!=='127.0.0.1'||$config['database']!=='football_castellon_dev')throw new RuntimeException('Sample database only');
$pdo=new PDO('mysql:host=127.0.0.1;port=33079;dbname=football_castellon_dev;charset=utf8mb4',$config['username'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
function isLocalDevelopment(): bool{return true;}
function uuidV4(): string{return vsprintf('%s%s-%s-%s-%s-%s%s%s',str_split(bin2hex(random_bytes(16)),4));}
require __DIR__.'/../api/auth/email-code-lib.php';
ensureEmailLoginSchema($pdo);$email='email-code-fixture@example.test';$action=$argv[1]??'';
if($action==='cleanup'||$action==='reset'){
 $s=$pdo->prepare('SELECT user_id FROM access_profiles WHERE email=?');$s->execute([$email]);$id=$s->fetchColumn();
 $pdo->prepare('DELETE FROM access_profiles WHERE email=?')->execute([$email]);
 if($id)$pdo->prepare('DELETE FROM users WHERE id=?')->execute([$id]);
 $pdo->prepare('DELETE FROM email_login_challenges WHERE host=? AND email IN (?,?)')->execute(['local',$email,'email-code-unknown@example.test']);
 foreach(['request-ip:'.hash('sha256','127.0.0.1'),'verify-ip:'.hash('sha256','127.0.0.1'),'request-email:'.hash('sha256',$email),'request-email:'.hash('sha256','email-code-unknown@example.test')] as $key)$pdo->prepare('DELETE FROM email_login_limits WHERE bucket=?')->execute([hash('sha256','local|'.$key.'|'.intdiv(time(),3600))]);
 foreach([$email,'email-code-unknown@example.test'] as $e){$p=__DIR__.'/../.local/email-outbox/'.hash('sha256',$e).'.json';if(is_file($p))unlink($p);}
 if($action==='reset')$pdo->prepare("INSERT INTO access_profiles (email,display_name,role,active) VALUES (?,'Disposable email test','player',1)")->execute([$email]);
}
if($action==='cooldown')$pdo->prepare('UPDATE email_login_limits SET last_request=0 WHERE bucket=?')->execute([hash('sha256','local|request-email:'.hash('sha256',$email).'|'.intdiv(time(),3600))]);
if($action==='expire')$pdo->prepare('UPDATE email_login_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE email=?')->execute([$email]);
if($action==='disable')$pdo->prepare('UPDATE access_profiles SET active=0 WHERE email=?')->execute([$email]);
if($action==='google'){
 $pdo->beginTransaction();$id=verifiedMemberAccount($pdo,$email,'fixture-google-subject','Fixture Google name');$pdo->commit();echo json_encode(['id'=>$id]);
}
if($action==='other-google'){
 $pdo->beginTransaction();try{verifiedMemberAccount($pdo,$email,'different-fixture-subject');throw new RuntimeException('Wrong Google identity accepted');}catch(DomainException $e){$pdo->rollBack();echo 'rejected';}
}
