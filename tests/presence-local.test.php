<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
$config=require __DIR__.'/../.local/db-config.php';
if($config['host']!=='127.0.0.1'||$config['database']!=='football_castellon_dev'||$config['port']!==33079)throw new RuntimeException('Local sample database only');
$pdo=new PDO('mysql:host=127.0.0.1;port=33079;dbname=football_castellon_dev;charset=utf8mb4',$config['username'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
function isLocalDevelopment(): bool{return true;}
require __DIR__.'/../api/auth/presence-lib.php';ensurePresenceSchema($pdo);
$id='10000000-0000-4000-8000-000000000004';$a=str_repeat('a',32);$b=str_repeat('b',32);
$before=[];foreach(['club_presence','club_presence_tabs'] as $table){$s=$pdo->prepare("SELECT * FROM $table WHERE host IN (?,?) AND user_id=?");$s->execute(['local','presence-test',$id]);$before[$table]=$s->fetchAll();}
$clear=static function()use($pdo,$id){foreach(['club_presence_tabs','club_presence'] as $table)$pdo->prepare("DELETE FROM $table WHERE host IN (?,?) AND user_id=?")->execute(['local','presence-test',$id]);};
try{
 $clear();$find=static fn($rows)=>array_values(array_filter($rows,static fn($p)=>$p['id']===$id))[0]??null;
 $first=$find(presenceHeartbeat($pdo,$id,$a));$again=$find(presenceHeartbeat($pdo,$id,$b));
 if(!$first||$first['online_key']!==$again['online_key'])throw new RuntimeException('Multiple tabs created multiple online spells');
 presenceLeave($pdo,$id,$a);if(!$find(presenceMembers($pdo)))throw new RuntimeException('Closing one tab hid another active tab');
 presenceLeave($pdo,$id,$b);if($find(presenceMembers($pdo)))throw new RuntimeException('Closing last tab did not clear online status');
 $new=$find(presenceHeartbeat($pdo,$id,$a));if($first['online_key']===$new['online_key'])throw new RuntimeException('Return did not start a new spell');
 $pdo->prepare('UPDATE club_presence_tabs SET last_seen_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 46 SECOND) WHERE host=? AND user_id=?')->execute(['local',$id]);
 if($find(presenceMembers($pdo)))throw new RuntimeException('Expired tab was still online');
 $fresh=$find(presenceHeartbeat($pdo,$id,$a));if($fresh['online_key']===$new['online_key'])throw new RuntimeException('Timeout return did not change online spell');
 $pdo->prepare('UPDATE club_presence SET host=? WHERE host=? AND user_id=?')->execute(['presence-test','local',$id]);
 $pdo->prepare('UPDATE club_presence_tabs SET host=? WHERE host=? AND user_id=?')->execute(['presence-test','local',$id]);
 if($find(presenceMembers($pdo)))throw new RuntimeException('Presence leaked between hosts');
 echo "PASS multiple tabs share an online spell; last-tab departure, timeout, reconnect and host isolation\n";
}finally{
 $clear();foreach($before['club_presence'] as $r)$pdo->prepare('INSERT INTO club_presence(host,user_id,online_key,last_seen_at) VALUES (?,?,?,?)')->execute([$r['host'],$r['user_id'],$r['online_key'],$r['last_seen_at']]);
 foreach($before['club_presence_tabs'] as $r)$pdo->prepare('INSERT INTO club_presence_tabs(host,user_id,client_id,last_seen_at) VALUES (?,?,?,?)')->execute([$r['host'],$r['user_id'],$r['client_id'],$r['last_seen_at']]);
}
