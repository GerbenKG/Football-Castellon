<?php
declare(strict_types=1);
require_once __DIR__ . '/auth/session.php';
require_once __DIR__ . '/auth/csrf-lib.php';
require_once __DIR__ . '/predictions-lib.php';

$user=requireUser(); $pdo=db();
try {
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET') {
        $fixtures=$pdo->query("SELECT id,api_fixture_id,league_name,country,home_team_name,home_team_logo,away_team_name,away_team_logo,kickoff_utc,fixture_status,home_score,away_score,result_confirmed FROM prediction_fixtures f WHERE (f.kickoff_utc >= UTC_TIMESTAMP() - INTERVAL 14 DAY) AND (EXISTS (SELECT 1 FROM prediction_team_map tm WHERE tm.api_team_id=f.home_team_id AND tm.season=f.season) OR EXISTS (SELECT 1 FROM prediction_team_map tm WHERE tm.api_team_id=f.away_team_id AND tm.season=f.season)) ORDER BY f.kickoff_utc LIMIT 200")->fetchAll();
        $mine=[];
        if($user['player_id']) {
            $s=$pdo->prepare('SELECT fixture_id,predicted_home_score,predicted_away_score,points_awarded,scored_at FROM game_predictions WHERE player_id=?');$s->execute([$user['player_id']]);
            foreach($s->fetchAll() as $r)$mine[(string)$r['fixture_id']]=$r;
        }
        // Include every player who has submitted at least one prediction, even before results are scored.
        $board=$pdo->query("SELECT p.player_id,pl.name,COALESCE(SUM(p.points_awarded),0) points,SUM(CASE WHEN p.scored_at IS NOT NULL AND p.points_awarded>0 THEN 1 ELSE 0 END) correct_games,COUNT(p.scored_at) scored_games,COALESCE(ap.avatar_path,u.avatar_path) avatar_path,ap.email
            FROM game_predictions p
            JOIN players pl ON pl.id=p.player_id
            LEFT JOIN access_profiles ap ON ap.player_id=pl.id AND ap.active=1
            LEFT JOIN users u ON u.id=ap.user_id
            WHERE pl.archived_at IS NULL
            GROUP BY p.player_id,pl.name,ap.avatar_path,u.avatar_path,ap.email
            ORDER BY points DESC,correct_games DESC,pl.name")->fetchAll();
        $favoriteByEmail=[];
        foreach($pdo->query("SELECT record_key,payload FROM club_records WHERE kind='favorite_club'")->fetchAll(PDO::FETCH_ASSOC) as $favoriteRow) {
            $payload=json_decode($favoriteRow['payload'],true);
            if(!is_array($payload)) continue;
            $key=substr((string)$favoriteRow['record_key'],13);
            if(preg_match('/^[a-f0-9]{64}$/',$key)) $favoriteByEmail[$key]=$payload['club']??null;
        }
        foreach($board as &$entry) {
            $email=strtolower(trim((string)($entry['email']??'')));
            $entry['favorite_club']=$email!==''?($favoriteByEmail[hash('sha256',$email)]??null):null;
            unset($entry['email']);
        }
        unset($entry);
        jsonResponse(['fixtures'=>$fixtures,'my_predictions'=>(object)$mine,'leaderboard'=>$board,'player_id'=>$user['player_id']]);
    }
    if($method!=='POST')jsonResponse(['error'=>'Method not allowed'],405);
    requireCsrfToken();
    if(!$user['player_id'])jsonResponse(['error'=>'Your account must be linked to an active player profile'],403);
    $body=json_decode(file_get_contents('php://input')?:'',true);
    if(!is_array($body)||($body['action']??'')!=='save_prediction')throw new InvalidArgumentException('Invalid prediction request');
    $fixtureId=filter_var($body['fixture_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
    $home=$body['home_score']??null;$away=$body['away_score']??null;
    if(!$fixtureId||!is_int($home)||!is_int($away)||$home<0||$home>20||$away<0||$away>20)throw new InvalidArgumentException('Enter a valid score from 0 to 20');
    $pdo->beginTransaction();
    $s=$pdo->prepare('SELECT id,kickoff_utc,result_confirmed FROM prediction_fixtures WHERE id=? FOR UPDATE');$s->execute([$fixtureId]);$fixture=$s->fetch();
    if(!$fixture)throw new InvalidArgumentException('Fixture not found');
    $deadline=(new DateTimeImmutable($fixture['kickoff_utc'],new DateTimeZone('UTC')))->modify('-1 minute');
    if(new DateTimeImmutable('now',new DateTimeZone('UTC')) >= $deadline || (int)$fixture['result_confirmed']===1)throw new DomainException('Predictions close one minute before kick-off');
    $s=$pdo->prepare('INSERT INTO game_predictions (fixture_id,player_id,predicted_home_score,predicted_away_score) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE predicted_home_score=VALUES(predicted_home_score),predicted_away_score=VALUES(predicted_away_score),updated_at=CURRENT_TIMESTAMP');
    $s->execute([(int)$fixtureId,$user['player_id'],$home,$away]);$pdo->commit();
    jsonResponse(['ok'=>true,'message'=>'Prediction saved']);
} catch(Throwable $e) {
    if($pdo->inTransaction())$pdo->rollBack();
    $status=$e instanceof InvalidArgumentException?400:($e instanceof DomainException?409:500);
    jsonResponse(['error'=>$status===500?'Unable to save or load predictions':$e->getMessage()],$status);
}
