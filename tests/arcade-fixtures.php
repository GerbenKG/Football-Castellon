<?php
declare(strict_types=1);
// CLI-only helper: deliberately refuses every database except the isolated sample DB.
if(PHP_SAPI!=='cli')exit(1);
$config=require __DIR__.'/../.local/db-config.php';
if($config['host']!=='127.0.0.1'||$config['database']!=='football_castellon_dev'||$config['port']!==33079)throw new RuntimeException('Local sample database only');
$pdo=new PDO('mysql:host=127.0.0.1;port=33079;dbname=football_castellon_dev;charset=utf8mb4',$config['username'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$body=json_decode(stream_get_contents(STDIN),true,64,JSON_THROW_ON_ERROR);$action=$body['action'];
if($action==='past'){
    $s=$pdo->prepare('SELECT fixtures,title FROM club_prediction_rounds WHERE id=?');$s->execute([$body['id']]);$r=$s->fetch();
    if(!$r||!str_starts_with($r['title'],'LOCAL ARCADE TEST'))throw new RuntimeException('Test round only');
    $f=json_decode($r['fixtures'],true);$f[0]['kickoff']=gmdate('Y-m-d\TH:i:00\Z',time()-86400);
    $pdo->prepare('UPDATE club_prediction_rounds SET fixtures=? WHERE id=?')->execute([json_encode($f),$body['id']]);
}elseif($action==='expire'){
    $pdo->prepare("UPDATE club_quiz_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=? AND challenger LIKE '10000000-%' AND opponent LIKE '10000000-%'")->execute([$body['id']]);
}elseif($action==='cleanup'){
    foreach($body['challenges'] as $id)$pdo->prepare("DELETE FROM club_quiz_challenges WHERE id=? AND challenger LIKE '10000000-%' AND opponent LIKE '10000000-%'")->execute([$id]);
    foreach($body['rounds'] as $id)$pdo->prepare("DELETE FROM club_prediction_rounds WHERE id=? AND title LIKE 'LOCAL ARCADE TEST%'")->execute([$id]);
    foreach($body['members'] as $uid=>$games){
        if(!preg_match('/^10000000-0000-4000-8000-00000000000[1-6]$/D',$uid))throw new RuntimeException('Sample member only');
        $pdo->prepare('DELETE FROM club_arcade_members WHERE user_id=?')->execute([$uid]);
        foreach($games as $game)$pdo->prepare('INSERT INTO club_arcade_members(user_id,game) VALUES (?,?)')->execute([$uid,$game]);
    }
}else throw new RuntimeException('Unknown test action');
echo "OK\n";
