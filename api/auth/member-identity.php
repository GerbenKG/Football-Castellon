<?php
declare(strict_types=1);

class ClubMembershipException extends DomainException
{
    public function __construct(public readonly string $reason)
    {
        parent::__construct($reason === 'unknown' ? 'This email address is not registered as a club member.' : 'This membership is currently disabled.');
    }
}

// Caller owns the transaction, locking the membership row before linking identities.
function verifiedMemberAccount(PDO $pdo,string $email,?string $googleSubject=null,string $name=''): string
{
    $s=$pdo->prepare('SELECT * FROM access_profiles WHERE email=? FOR UPDATE');$s->execute([$email]);$profile=$s->fetch();
    if(!$profile)throw new ClubMembershipException('unknown');
    if(!$profile['active'])throw new ClubMembershipException('disabled');
    $s=$pdo->prepare('SELECT id,email,google_subject FROM users WHERE email=? FOR UPDATE');$s->execute([$email]);$user=$s->fetch();
    if($profile['user_id']!==null&&(!$user||$profile['user_id']!==$user['id']))throw new DomainException('The membership account does not match.');
    if($googleSubject!==null){
        $s=$pdo->prepare('SELECT id,email FROM users WHERE google_subject=? FOR UPDATE');$s->execute([$googleSubject]);$identity=$s->fetch();
        if($identity&&(!$user||$identity['id']!==$user['id']))throw new DomainException('The Google account does not match the membership.');
        if($user&&$user['google_subject']!==null&&!str_starts_with($user['google_subject'],'email:')&&$user['google_subject']!==$googleSubject)throw new DomainException('This membership is linked to a different Google account.');
    }
    if(!$user){
        $id=uuidV4();
        // A reserved marker also supports older databases with a NOT NULL Google column.
        $pdo->prepare('INSERT INTO users (id,email,google_subject,display_name,last_login_at) VALUES (?,?,?,?,UTC_TIMESTAMP())')->execute([$id,$email,$googleSubject??'email:'.$id,$profile['display_name']?:($name?:$email)]);
    }else{
        $id=$user['id'];
        if($googleSubject!==null)$pdo->prepare('UPDATE users SET google_subject=? WHERE id=?')->execute([$googleSubject,$id]);
        $pdo->prepare('UPDATE users SET last_login_at=UTC_TIMESTAMP() WHERE id=?')->execute([$id]);
    }
    $pdo->prepare('UPDATE access_profiles SET user_id=? WHERE email=?')->execute([$id,$email]);
    return $id;
}
