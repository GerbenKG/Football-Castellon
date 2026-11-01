<?php
declare(strict_types=1);
require_once __DIR__.'/quiz-questions.php';

function ensureArcadeSchema(PDO $pdo): void
{
    ensureClubPagePermissions($pdo);
    $pdo->exec("CREATE TABLE IF NOT EXISTS club_arcade_members (
        user_id CHAR(36) NOT NULL, game VARCHAR(20) NOT NULL, joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id,game), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS club_prediction_rounds (
        id CHAR(36) PRIMARY KEY, title VARCHAR(100) NOT NULL, fixtures LONGTEXT NOT NULL, created_by CHAR(36) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS club_predictions (
        round_id CHAR(36) NOT NULL, fixture_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
        home TINYINT UNSIGNED NOT NULL, away TINYINT UNSIGNED NOT NULL,
        PRIMARY KEY(round_id,fixture_id,user_id), FOREIGN KEY(round_id) REFERENCES club_prediction_rounds(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS club_quiz_challenges (
        id CHAR(36) PRIMARY KEY, challenger CHAR(36) NOT NULL, opponent CHAR(36) NOT NULL,
        questions TEXT NOT NULL, challenger_answers TEXT NULL, opponent_answers TEXT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL, KEY(challenger), KEY(opponent),
        FOREIGN KEY(challenger) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(opponent) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function arcadeUtc(string $value): string { return (new DateTimeImmutable($value,new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z'); }
function arcadeScore(array $prediction, array $fixture): int
{
    if(($fixture['status']??'scheduled')!=='final')return 0;
    if($prediction['home']===$fixture['home_score']&&$prediction['away']===$fixture['away_score'])return 3;
    return (($prediction['home']<=>$prediction['away'])===($fixture['home_score']<=>$fixture['away_score']))?1:0;
}
function arcadeGoals(mixed $value): int
{
    if(!is_int($value)||$value<0||$value>30)throw new InvalidArgumentException('Enter a whole-number score from 0 to 30');
    return $value;
}
function arcadeJoined(PDO $pdo,string $user,string $game): void
{
    $s=$pdo->prepare('SELECT user_id FROM club_arcade_members WHERE user_id=? AND game=? FOR UPDATE');$s->execute([$user,$game]);
    if(!$s->fetchColumn())throw new DomainException('Join this game first');
}
function arcadePeople(PDO $pdo): array
{
    return $pdo->query("SELECT u.id,ap.player_id,COALESCE(NULLIF(p.name,''),NULLIF(ap.display_name,''),NULLIF(u.display_name,''),'Club member') AS name,
        COALESCE(ap.avatar_path,u.avatar_path) AS avatar_path FROM users u JOIN access_profiles ap ON ap.user_id=u.id AND ap.active=1
        LEFT JOIN players p ON p.id=ap.player_id WHERE ap.role='super_admin' OR EXISTS(SELECT 1 FROM role_permissions rp WHERE rp.role=ap.role AND rp.permission='arcade.view' AND rp.enabled=1) ORDER BY name")->fetchAll();
}
function arcadeQuizScore(array $ids,array $answers): int
{
    $bank=arcadeQuestions();$score=0;foreach($ids as $i=>$id)if($answers[$i]===$bank[$id][2])$score++;return $score;
}
function arcadeChallenge(array $c,string $user): array
{
    $mine=$c['challenger']===$user?'challenger':'opponent';$other=$mine==='challenger'?'opponent':'challenger';
    $ids=json_decode($c['questions'],true,64,JSON_THROW_ON_ERROR);$bank=arcadeQuestions();
    $done=$c['challenger_answers']!==null&&$c['opponent_answers']!==null;
    $expired=strtotime($c['expires_at'].' UTC')<=time();
    $out=['id'=>$c['id'],'challenger'=>$c['challenger'],'opponent'=>$c['opponent'],'created_at'=>arcadeUtc($c['created_at']),
        'expires_at'=>arcadeUtc($c['expires_at']),'status'=>$done?'complete':($c['status']!=='active'?$c['status']:($expired?'expired':'active')),
        'my_submitted'=>$c[$mine.'_answers']!==null,'other_submitted'=>$c[$other.'_answers']!==null,'questions'=>[]];
    if($out['status']==='active'&&!$out['my_submitted'])foreach($ids as $i=>$id)$out['questions'][]=['text'=>$bank[$id][0],'options'=>$bank[$id][1]];
    if($done){
        $a=json_decode($c['challenger_answers'],true);$b=json_decode($c['opponent_answers'],true);
        $out['challenger_score']=arcadeQuizScore($ids,$a);$out['opponent_score']=arcadeQuizScore($ids,$b);
        foreach($ids as $i=>$id)$out['questions'][]=['text'=>$bank[$id][0],'options'=>$bank[$id][1],'correct'=>$bank[$id][2],'mine'=>($mine==='challenger'?$a:$b)[$i]];
    }
    return $out;
}
function arcadeSnapshot(PDO $pdo,array $user): array
{
    $people=arcadePeople($pdo);$active=array_column($people,'id');$members=$pdo->query('SELECT user_id,game FROM club_arcade_members')->fetchAll();
    $joined=array_column(array_filter($members,fn($m)=>$m['user_id']===$user['id']),'game');
    $rounds=$pdo->query('SELECT id,title,fixtures,created_at FROM club_prediction_rounds ORDER BY created_at DESC,id DESC')->fetchAll();
    $predictions=$pdo->query('SELECT * FROM club_predictions')->fetchAll();$byFixture=[];$standings=[];
    foreach($members as $m)if($m['game']==='predictions'&&in_array($m['user_id'],$active,true))$standings[$m['user_id']]=['user_id'=>$m['user_id'],'points'=>0,'exact'=>0,'played'=>0];
    foreach($predictions as $p){$p['home']=(int)$p['home'];$p['away']=(int)$p['away'];$byFixture[$p['fixture_id']][]=$p;}
    foreach($rounds as &$r){
        $r['fixtures']=json_decode($r['fixtures'],true,64,JSON_THROW_ON_ERROR);$r['created_at']=arcadeUtc($r['created_at']);
        foreach($r['fixtures'] as &$f){
            $rows=$byFixture[$f['id']]??[];$f['locked']=strtotime($f['kickoff'])<=time()||$f['status']!=='scheduled';$f['my_prediction']=null;$f['predictions']=[];
            foreach($rows as $p){
                $public=['user_id'=>$p['user_id'],'home'=>$p['home'],'away'=>$p['away'],'points'=>arcadeScore($p,$f)];
                if($p['user_id']===$user['id'])$f['my_prediction']=$public;
                if($f['locked']&&in_array($p['user_id'],$active,true))$f['predictions'][]=$public;
                if($f['status']==='final'&&in_array($p['user_id'],$active,true)){
                    $standings[$p['user_id']]??=['user_id'=>$p['user_id'],'points'=>0,'exact'=>0,'played'=>0];
                    $standings[$p['user_id']]['points']+=$public['points'];$standings[$p['user_id']]['exact']+=(int)($public['points']===3);$standings[$p['user_id']]['played']++;
                }
            }
        }unset($f);
    }unset($r);
    $standings=array_values($standings);usort($standings,fn($a,$b)=>($b['points']<=>$a['points'])?:($b['exact']<=>$a['exact'])?:strcmp($a['user_id'],$b['user_id']));
    $s=$pdo->prepare('SELECT * FROM club_quiz_challenges WHERE challenger=? OR opponent=? ORDER BY created_at DESC,id DESC');$s->execute([$user['id'],$user['id']]);
    $challenges=array_map(fn($c)=>arcadeChallenge($c,$user['id']),$s->fetchAll());
    return ['joined'=>$joined,'people'=>$people,'quiz_members'=>array_values(array_column(array_filter($members,fn($m)=>$m['game']==='quiz'&&in_array($m['user_id'],$active,true)),'user_id')),
        'prediction_members'=>count(array_filter($members,fn($m)=>$m['game']==='predictions'&&in_array($m['user_id'],$active,true))),
        'rounds'=>$rounds,'leaderboard'=>$standings,'challenges'=>$challenges,'can_manage'=>hasPermission($user['role'],'arcade.manage'),'server_time'=>gmdate('Y-m-d\TH:i:s\Z')];
}
function arcadeMutate(PDO $pdo,array $user,array $body): array
{
    $action=$body['action']??'';$uid=$user['id'];
    if($action==='join'||$action==='leave'){
        $game=$body['game']??null;if(!in_array($game,['predictions','quiz'],true))throw new InvalidArgumentException('Choose a game');
        if($action==='join')$pdo->prepare('INSERT IGNORE INTO club_arcade_members(user_id,game) VALUES (?,?)')->execute([$uid,$game]);
        else $pdo->prepare('DELETE FROM club_arcade_members WHERE user_id=? AND game=?')->execute([$uid,$game]);
        return ['ok'=>true];
    }
    if($action==='round_create'){
        clubRequire($user,'arcade.manage');$title=clubText($body['title']??null,100);$fixtures=$body['fixtures']??null;
        if(!is_array($fixtures)||!array_is_list($fixtures)||count($fixtures)<1||count($fixtures)>10)throw new InvalidArgumentException('Add between one and ten fixtures');
        $rows=[];foreach($fixtures as $f){
            if(!is_array($f))throw new InvalidArgumentException('Invalid fixture');
            $home=clubText($f['home']??null,80);$away=clubText($f['away']??null,80);
            if(strcasecmp($home,$away)===0)throw new InvalidArgumentException('Choose two different teams');
            $kickoff=$f['kickoff']??'';
            if(!is_string($kickoff)||!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/D',$kickoff))throw new InvalidArgumentException('Choose a valid kickoff');
            $dt=DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z',$kickoff,new DateTimeZone('UTC'));
            if(!$dt||$dt->format('Y-m-d\TH:i:s\Z')!==$kickoff||$dt->getTimestamp()<=time()||$dt->getTimestamp()>time()+366*86400)throw new InvalidArgumentException('Kickoff must be in the next year');
            $rows[]=['id'=>uuidV4(),'home'=>$home,'away'=>$away,'kickoff'=>$kickoff,'status'=>'scheduled','home_score'=>null,'away_score'=>null];
        }
        $id=uuidV4();$pdo->prepare('INSERT INTO club_prediction_rounds(id,title,fixtures,created_by) VALUES (?,?,?,?)')->execute([$id,$title,json_encode($rows,JSON_THROW_ON_ERROR),$uid]);return ['id'=>$id];
    }
    if($action==='predict'||$action==='fixture_result'){
        if($action==='predict')arcadeJoined($pdo,$uid,'predictions');else clubRequire($user,'arcade.manage');
        $s=$pdo->prepare('SELECT * FROM club_prediction_rounds WHERE id=? FOR UPDATE');$s->execute([clubId($body['round_id']??null)]);$round=$s->fetch();
        if(!$round)throw new InvalidArgumentException('Round not found');$fixtures=json_decode($round['fixtures'],true,64,JSON_THROW_ON_ERROR);$index=array_search($body['fixture_id']??null,array_column($fixtures,'id'),true);
        if($index===false)throw new InvalidArgumentException('Fixture not found');$f=$fixtures[$index];
        if($action==='predict'){
            if(strtotime($f['kickoff'])<=time()||$f['status']!=='scheduled')throw new InvalidArgumentException('Predictions are locked for this fixture');
            $pdo->prepare('INSERT INTO club_predictions(round_id,fixture_id,user_id,home,away) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE home=VALUES(home),away=VALUES(away)')->execute([$round['id'],$f['id'],$uid,arcadeGoals($body['home']??null),arcadeGoals($body['away']??null)]);
        }else{
            $status=$body['status']??null;if(!in_array($status,['final','void','scheduled'],true))throw new InvalidArgumentException('Choose final score, void or scheduled');
            if($status==='final'&&strtotime($f['kickoff'])>time())throw new InvalidArgumentException('A future fixture cannot have a final result');
            $fixtures[$index]['status']=$status;$fixtures[$index]['home_score']=$status==='final'?arcadeGoals($body['home']??null):null;$fixtures[$index]['away_score']=$status==='final'?arcadeGoals($body['away']??null):null;
            $pdo->prepare('UPDATE club_prediction_rounds SET fixtures=? WHERE id=?')->execute([json_encode($fixtures,JSON_THROW_ON_ERROR),$round['id']]);
        }return ['ok'=>true];
    }
    if($action==='challenge'){
        $opponent=clubId($body['opponent']??null);if($opponent===$uid)throw new InvalidArgumentException('Choose another member');
        if(!in_array($opponent,array_column(arcadePeople($pdo),'id'),true))throw new InvalidArgumentException('Member is not available');
        $s=$pdo->prepare("SELECT user_id FROM club_arcade_members WHERE game='quiz' AND user_id IN (?,?) ORDER BY user_id FOR UPDATE");$s->execute([$uid,$opponent]);if(count($s->fetchAll())!==2)throw new DomainException('Both members must join teammate challenges first');
        // The membership lock serialises outgoing invitations, including simultaneous clicks.
        $s=$pdo->prepare("SELECT COUNT(*) FROM club_quiz_challenges WHERE challenger=? AND created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY)");$s->execute([$uid]);if((int)$s->fetchColumn()>=10)throw new InvalidArgumentException('Ten challenges per day is plenty. Come back tomorrow!');
        $s=$pdo->prepare("SELECT id FROM club_quiz_challenges WHERE status='active' AND expires_at>UTC_TIMESTAMP() AND (challenger_answers IS NULL OR opponent_answers IS NULL) AND ((challenger=? AND opponent=?) OR (challenger=? AND opponent=?)) FOR UPDATE");$s->execute([$uid,$opponent,$opponent,$uid]);if($s->fetchColumn())throw new InvalidArgumentException('You already have an open challenge together');
        $keys=array_rand(arcadeQuestions(),5);shuffle($keys);$id=uuidV4();
        $pdo->prepare('INSERT INTO club_quiz_challenges(id,challenger,opponent,questions,expires_at) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))')->execute([$id,$uid,$opponent,json_encode($keys)]);return ['id'=>$id];
    }
    if($action==='quiz_submit'||$action==='decline'){
        $s=$pdo->prepare('SELECT * FROM club_quiz_challenges WHERE id=? FOR UPDATE');$s->execute([clubId($body['id']??null)]);$c=$s->fetch();
        if(!$c||!in_array($uid,[$c['challenger'],$c['opponent']],true))throw new DomainException('This challenge belongs to its two players');
        if($c['status']!=='active'||strtotime($c['expires_at'].' UTC')<=time())throw new InvalidArgumentException('This challenge is closed');
        $mine=$c['challenger']===$uid?'challenger':'opponent';
        if($c[$mine.'_answers']!==null)throw new InvalidArgumentException('Your answers are already submitted');
        if($action==='decline'){
            if($mine!=='opponent')throw new DomainException('Only the invited member can decline');
            $pdo->prepare("UPDATE club_quiz_challenges SET status='declined' WHERE id=?")->execute([$c['id']]);
        }else{
            $answers=$body['answers']??null;
            if(!is_array($answers)||!array_is_list($answers)||count($answers)!==5)throw new InvalidArgumentException('Answer all five questions');
            foreach($answers as $answer)if(!is_int($answer)||$answer<0||$answer>3)throw new InvalidArgumentException('Choose one answer for every question');
            $pdo->prepare('UPDATE club_quiz_challenges SET '.$mine.'_answers=? WHERE id=?')->execute([json_encode($answers),$c['id']]);
        }return ['ok'=>true];
    }
    throw new InvalidArgumentException('Unknown game action');
}
