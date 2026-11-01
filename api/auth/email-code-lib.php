<?php
declare(strict_types=1);
require_once __DIR__.'/member-identity.php';

const EMAIL_CODE_SECONDS=600;
function emailLoginHost(): string {
    $host=strtolower(preg_replace('/:\d+$/','',$_SERVER['HTTP_HOST']??''));
    if(!isLocalDevelopment()&&!in_array($host,['dev.castellon.futbol','castellon.futbol'],true))throw new DomainException('Sign-in is unavailable on this address.');
    return isLocalDevelopment()?'local':$host;
}
function ensureEmailLoginSchema(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS email_login_challenges (
        token_hash CHAR(64) PRIMARY KEY, host VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL,
        code_hash CHAR(64) NOT NULL, expires_at DATETIME NOT NULL, attempts TINYINT NOT NULL DEFAULT 0,
        ready BOOLEAN NOT NULL DEFAULT FALSE, KEY idx_email_login_expiry(expires_at), KEY idx_email_login_member(host,email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS email_login_limits (
        bucket CHAR(64) PRIMARY KEY, hits INT NOT NULL DEFAULT 0, last_request BIGINT NOT NULL DEFAULT 0, expires_at DATETIME NOT NULL,
        KEY idx_email_limit_expiry(expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS email_login_settings (
        host VARCHAR(100) PRIMARY KEY, payload TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function emailLoginTemplate(PDO $pdo): array {
    $s=$pdo->prepare('SELECT payload FROM email_login_settings WHERE host=?');$s->execute([emailLoginHost()]);$raw=$s->fetchColumn();
    return ($raw?json_decode($raw,true,16,JSON_THROW_ON_ERROR):[]) + [
        'sender_name'=>'FC Castellon Clubhouse', 'subject'=>'Your FC Castellon sign-in code',
        'body'=>"Welcome to the clubhouse!\n\nYour sign-in code is: {code}\n\nIt expires in {minutes} minutes and can only be used once. Enter it on {site} in the browser where you requested it.\n\nNever share this code. If you did not request it, you can ignore this email.\n\nFC Castellon\nGood football. Better company."
    ];
}
function emailLoginMessage(array $settings,string $code): array {
    $site=emailLoginHost()==='local'?'your local test clubhouse':'https://'.emailLoginHost();
    return ['subject'=>$settings['subject'],'body'=>strtr($settings['body'],['{code}'=>$code,'{minutes}'=>'10','{site}'=>$site]),'sender_name'=>$settings['sender_name']];
}
function emailLoginSend(string $email,array $message): bool {
    if(isLocalDevelopment()){
        $dir=dirname(__DIR__,2).'/.local/email-outbox';if(!is_dir($dir))mkdir($dir,0700,true);
        // Never exposed by the local router; test fixtures only, no real mail is sent.
        return file_put_contents($dir.'/'.hash('sha256',$email).'.json',json_encode($message,JSON_THROW_ON_ERROR),LOCK_EX)!==false;
    }
    $headers=['From'=>'=?UTF-8?B?'.base64_encode($message['sender_name']).'?= <login@castellon.futbol>','MIME-Version'=>'1.0','Content-Type'=>'text/plain; charset=UTF-8','Content-Transfer-Encoding'=>'base64','Auto-Submitted'=>'auto-generated','X-Auto-Response-Suppress'=>'All'];
    return mail($email,'=?UTF-8?B?'.base64_encode($message['subject']).'?=',chunk_split(base64_encode($message['body']),76,"\r\n"),$headers,'-flogin@castellon.futbol');
}
function emailLoginRate(PDO $pdo,string $key,int $maximum,int $cooldown=0): void {
    $now=time();$bucket=hash('sha256',emailLoginHost().'|'.$key.'|'.intdiv($now,3600));
    $pdo->prepare('INSERT IGNORE INTO email_login_limits (bucket,expires_at) VALUES (?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 2 HOUR))')->execute([$bucket]);
    $s=$pdo->prepare('SELECT hits,last_request FROM email_login_limits WHERE bucket=? FOR UPDATE');$s->execute([$bucket]);$r=$s->fetch();
    if($r['hits']>=$maximum||$now-(int)$r['last_request']<$cooldown)throw new OverflowException('Please wait before requesting another code. Try again later if you have requested several.');
    $pdo->prepare('UPDATE email_login_limits SET hits=hits+1,last_request=? WHERE bucket=?')->execute([$now,$bucket]);
}
function emailLoginIssue(PDO $pdo,string $email,string $ip): array {
    $token=bin2hex(random_bytes(32));$hash=hash('sha256',$token);$code=str_pad((string)random_int(0,999999),6,'0',STR_PAD_LEFT);
    $pdo->beginTransaction();
    try {
        emailLoginRate($pdo,'request-ip:'.hash('sha256',$ip),20);
        emailLoginRate($pdo,'request-email:'.hash('sha256',$email),5,60);
        $pdo->prepare('DELETE FROM email_login_challenges WHERE (host=? AND email=?) OR expires_at<UTC_TIMESTAMP()')->execute([emailLoginHost(),$email]);
        $pdo->exec('DELETE FROM email_login_limits WHERE expires_at<UTC_TIMESTAMP()');
        $s=$pdo->prepare('SELECT active FROM access_profiles WHERE email=?');$s->execute([$email]);$profile=$s->fetch();
        $membership=!$profile?'unknown':($profile['active']?'active':'disabled');$active=$membership==='active';
        if($active)$pdo->prepare('INSERT INTO email_login_challenges (token_hash,host,email,code_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))')->execute([$hash,emailLoginHost(),$email,hash_hmac('sha256',$code,$token)]);
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    return ['token'=>$token,'hash'=>$hash,'code'=>$code,'eligible'=>$active,'membership'=>$membership];
}
function emailLoginDeliver(PDO $pdo,string $email,array $challenge): void {
    if(!$challenge['eligible'])return;
    try {
        if(!emailLoginSend($email,emailLoginMessage(emailLoginTemplate($pdo),$challenge['code'])))throw new RuntimeException('Mail transport rejected delivery');
        $pdo->prepare('UPDATE email_login_challenges SET ready=1 WHERE token_hash=? AND host=?')->execute([$challenge['hash'],emailLoginHost()]);
    }catch(Throwable $e){error_log('Football email sign-in: delivery failed; check hosting mail service.');}
}
function emailLoginVerify(PDO $pdo,string $token,string $code,string $ip): ?string {
    $pdo->beginTransaction();
    try {
        emailLoginRate($pdo,'verify-ip:'.hash('sha256',$ip),60);
        $s=$pdo->prepare('SELECT *,expires_at>UTC_TIMESTAMP() AS valid_time FROM email_login_challenges WHERE token_hash=? AND host=? FOR UPDATE');$s->execute([hash('sha256',$token),emailLoginHost()]);$r=$s->fetch();
        $id=null;
        if($r&&$r['valid_time']&&$r['attempts']<5){
            $pdo->prepare('UPDATE email_login_challenges SET attempts=attempts+1 WHERE token_hash=?')->execute([$r['token_hash']]);
            if($r['ready']&&preg_match('/^\d{6}$/D',$code)&&hash_equals($r['code_hash'],hash_hmac('sha256',$code,$token))){
                try{$id=verifiedMemberAccount($pdo,$r['email']);}catch(DomainException $e){$id=null;}
                // Invalidate even if membership was disabled since requesting the email.
                $pdo->prepare('DELETE FROM email_login_challenges WHERE token_hash=?')->execute([$r['token_hash']]);
            }
        }
        $pdo->commit();return $id;
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
