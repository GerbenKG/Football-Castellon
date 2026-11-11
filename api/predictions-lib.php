<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function predictionApiConfig(): array {
    $path = dirname(__DIR__, 2) . '/football-data-config.php';
    if (!is_file($path)) throw new RuntimeException('football-data.org configuration is missing. Create football-data-config.php beside db-config.php.');
    $config = require $path;
    if (!is_array($config) || !is_string($config['api_key'] ?? null) || trim($config['api_key']) === '') {
        throw new RuntimeException('football-data.org configuration is invalid');
    }
    return $config;
}

/** Local safety ledger: maximum 80 requests per UTC day. */
function predictionEnsureUsageSchema(PDO $pdo): void {
    static $ready = false;
    if ($ready) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS prediction_api_usage (
        usage_date DATE NOT NULL,
        request_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        provider_daily_limit SMALLINT UNSIGNED DEFAULT NULL,
        provider_daily_remaining SMALLINT UNSIGNED DEFAULT NULL,
        last_request_at DATETIME DEFAULT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (usage_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready = true;
}
function predictionReserveApiRequest(PDO $pdo): void {
    predictionEnsureUsageSchema($pdo);
    $today=(new DateTimeImmutable('now',new DateTimeZone('UTC')))->format('Y-m-d');
    $pdo->prepare('INSERT IGNORE INTO prediction_api_usage (usage_date) VALUES (?)')->execute([$today]);
    $s=$pdo->prepare("UPDATE prediction_api_usage SET request_count=request_count+1,last_request_at=UTC_TIMESTAMP()
        WHERE usage_date=? AND request_count<80");
    $s->execute([$today]);
    if($s->rowCount()!==1) throw new RuntimeException('Football-data.org local safety limit reached (80 requests today UTC). Sync deferred until 00:00 UTC.');
}
function predictionApi(string $endpoint, array $params = []): array {
    static $lastRequestAt = 0.0;
    $config=predictionApiConfig();
    $pdo=db();
    $url='https://api.football-data.org/v4/'.ltrim($endpoint,'/');
    if($params) $url.='?'.http_build_query($params);
    for($attempt=0;$attempt<3;$attempt++) {
        // Stay comfortably below the provider's 10 requests/minute free-tier limit.
        $wait=max(0.0,6.1-(microtime(true)-$lastRequestAt));
        if($wait>0) usleep((int)ceil($wait*1000000));
        predictionReserveApiRequest($pdo);
        $retryAfter=0;
        $ch=curl_init($url);
        curl_setopt_array($ch,[
            CURLOPT_RETURNTRANSFER=>true,
            CURLOPT_TIMEOUT=>25,
            CURLOPT_CONNECTTIMEOUT=>10,
            CURLOPT_HTTPHEADER=>['X-Auth-Token: '.$config['api_key'],'Accept: application/json'],
            CURLOPT_HEADERFUNCTION=>static function($curl,string $header) use (&$retryAfter): int {
                if(preg_match('/^Retry-After:\\s*(\\d+)/i',$header,$m)) $retryAfter=(int)$m[1];
                return strlen($header);
            },
        ]);
        $raw=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$error=curl_error($ch);curl_close($ch);
        $lastRequestAt=microtime(true);
        if($raw===false) throw new RuntimeException('football-data.org connection failed: '.$error);
        $json=json_decode($raw,true);
        if(!is_array($json)) throw new RuntimeException('football-data.org returned invalid JSON (HTTP '.$status.')');
        if($status===429 && $attempt<2) {
            $message=is_string($json['message']??null)?$json['message']:'';
            if($retryAfter<=0 && preg_match('/wait\\s+(\\d+)\\s+seconds?/i',$message,$m)) $retryAfter=(int)$m[1];
            sleep(max(7,min(60,$retryAfter?:7)));
            continue;
        }
        if($status<200||$status>=300) {
            $message=is_string($json['message']??null)?$json['message']:(is_string($json['error']??null)?$json['error']:'HTTP '.$status);
            throw new RuntimeException('football-data.org rejected the request (HTTP '.$status.'): '.mb_substr($message,0,500));
        }
        return $json;
    }
    throw new RuntimeException('football-data.org rate limit remained active after retries. Sync can be run again later.');
}

function predictionCurrentSeason(): int { return (int)(new DateTimeImmutable('now',new DateTimeZone('Europe/Madrid')))->format('Y'); }
function predictionNormalizeTeamName(string $name): string {
    $name=trim($name);
    if(function_exists('iconv')) {
        $ascii=iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$name);
        if(is_string($ascii)) $name=$ascii;
    }
    $name=strtolower($name);
    $name=preg_replace('/\\b(football club|futbol club|club de futbol|club football|calcio)\\b/i',' ',$name);
    $name=preg_replace('/\\b(afc|fc|cf|ssc|ac|as|sc|sv|fk|sk|bk|ks)\\b/i',' ',$name);
    $name=preg_replace('/[^a-z0-9]+/',' ',$name);
    $name=trim(preg_replace('/\\s+/',' ',$name));
    $aliases=[
        'inter milan'=>'internazionale',
        'inter'=>'internazionale',
        'internazionale'=>'internazionale',
        'internazionale milano'=>'internazionale',
    ];
    return $aliases[$name]??$name;
}
function predictionFavouriteNames(PDO $pdo): array {
    $names=[];
    $stmt=$pdo->query("SELECT payload FROM club_records WHERE kind='favorite_club'");
    foreach($stmt->fetchAll(PDO::FETCH_COLUMN) as $payload) {
        $row=json_decode($payload,true); $name=$row['club']['name']??null;
        if(is_string($name)&&trim($name)!=='') {
            $key=predictionNormalizeTeamName($name);
            if($key!=='') $names[$key]=trim($name);
        }
    }
    return array_values($names);
}
function predictionDomesticLeague(array $league): bool {
    $type=strtolower((string)($league['type']??''));
    $country=strtolower((string)($league['country']['name']??''));
    return $type==='league' && $country!=='' && !in_array($country,['world','international'],true);
}
function predictionSync(PDO $pdo, bool $discover=true): array {
    // Domestic competitions available in the provider's free tier.
    $competitions=[
        'PL'=>['id'=>2021,'name'=>'Premier League','country'=>'England'],
        'ELC'=>['id'=>2016,'name'=>'Championship','country'=>'England'],
        'PD'=>['id'=>2014,'name'=>'La Liga','country'=>'Spain'],
        'DED'=>['id'=>2003,'name'=>'Eredivisie','country'=>'Netherlands'],
        'BL1'=>['id'=>2002,'name'=>'Bundesliga','country'=>'Germany'],
        'SA'=>['id'=>2019,'name'=>'Serie A','country'=>'Italy'],
    ];
    $season=predictionCurrentSeason();$mapped=0;$fixtures=0;$scored=0;
    $favorites=predictionFavouriteNames($pdo);
    if($discover && $favorites) {
        // Rescan when the saved favourite-club set changes; otherwise cache discovery for seven days.
        $favoriteKeys=array_map('predictionNormalizeTeamName',$favorites);
        sort($favoriteKeys);
        // Include competition configuration so newly added leagues trigger discovery immediately.
        $competitionKeys=[];
        foreach($competitions as $code=>$competition) $competitionKeys[]=$code.':'.(int)$competition['id'];
        sort($competitionKeys);
        $favoriteHash=hash('sha256',implode('|',$favoriteKeys).'||'.implode('|',$competitionKeys));
        $pdo->exec("CREATE TABLE IF NOT EXISTS prediction_discovery_cache (
            season SMALLINT NOT NULL PRIMARY KEY,
            favourites_hash CHAR(64) NOT NULL,
            last_checked_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $cache=$pdo->prepare('SELECT favourites_hash,last_checked_at FROM prediction_discovery_cache WHERE season=?');
        $cache->execute([$season]);$cached=$cache->fetch(PDO::FETCH_ASSOC);
        $needsDiscovery=!$cached || !hash_equals((string)$cached['favourites_hash'],$favoriteHash)
            || strtotime((string)$cached['last_checked_at']) < time()-7*86400;
        if($needsDiscovery) {
            foreach($competitions as $code=>$competition) {
                $payload=predictionApi('competitions/'.$code.'/teams');
                foreach(($payload['teams']??[]) as $team) {
                    $teamName=trim((string)($team['name']??''));
                    if($teamName==='') continue;
                    $teamKey=predictionNormalizeTeamName($teamName);
                    foreach($favorites as $favorite) {
                        if(predictionNormalizeTeamName($favorite)!==$teamKey) continue;
                        $s=$pdo->prepare('INSERT INTO prediction_team_map (favourite_club,api_team_id,api_team_name,api_league_id,league_name,country,season) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE api_team_id=VALUES(api_team_id),api_team_name=VALUES(api_team_name),api_league_id=VALUES(api_league_id),league_name=VALUES(league_name),country=VALUES(country),updated_at=CURRENT_TIMESTAMP');
                        $s->execute([$favorite,(int)$team['id'],$teamName,$competition['id'],$competition['name'],$competition['country'],$season]);
                        if($s->rowCount()>0) $mapped++;
                    }
                }
            }
            $save=$pdo->prepare('INSERT INTO prediction_discovery_cache (season,favourites_hash,last_checked_at) VALUES (?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE favourites_hash=VALUES(favourites_hash),last_checked_at=UTC_TIMESTAMP()');
            $save->execute([$season,$favoriteHash]);
        }
    }
    $from=(new DateTimeImmutable('now',new DateTimeZone('UTC')))->modify('-14 days')->format('Y-m-d');
    $to=(new DateTimeImmutable('now',new DateTimeZone('UTC')))->modify('+45 days')->format('Y-m-d');
    foreach($competitions as $code=>$competition) {
        $selected=$pdo->prepare('SELECT DISTINCT api_team_id FROM prediction_team_map WHERE api_league_id=? AND season=?');
        $selected->execute([$competition['id'],$season]);
        $selectedIds=array_fill_keys(array_map('intval',$selected->fetchAll(PDO::FETCH_COLUMN)),true);
        if(!$selectedIds) continue;
        $payload=predictionApi('competitions/'.$code.'/matches',['dateFrom'=>$from,'dateTo'=>$to]);
        foreach(($payload['matches']??[]) as $match) {
            $home=$match['homeTeam']??[];$away=$match['awayTeam']??[];
            if(empty($match['id'])||empty($home['id'])||empty($away['id'])||empty($match['utcDate'])) continue;
            if(!isset($selectedIds[(int)$home['id']])&&!isset($selectedIds[(int)$away['id']])) continue;
            $status=(string)($match['status']??'SCHEDULED');
            $score=$match['score']['fullTime']??[];
            $finished=$status==='FINISHED'&&is_numeric($score['home']??null)&&is_numeric($score['away']??null);
            $kickoff=(new DateTimeImmutable($match['utcDate']))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
            $s=$pdo->prepare('INSERT INTO prediction_fixtures (api_fixture_id,api_league_id,league_name,country,season,home_team_id,home_team_name,home_team_logo,away_team_id,away_team_name,away_team_logo,kickoff_utc,fixture_status,home_score,away_score,result_confirmed,last_synced_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE kickoff_utc=VALUES(kickoff_utc),fixture_status=VALUES(fixture_status),home_score=VALUES(home_score),away_score=VALUES(away_score),result_confirmed=VALUES(result_confirmed),last_synced_at=UTC_TIMESTAMP(),home_team_name=VALUES(home_team_name),away_team_name=VALUES(away_team_name),home_team_logo=VALUES(home_team_logo),away_team_logo=VALUES(away_team_logo)');
            $s->execute([(int)$match['id'],$competition['id'],$competition['name'],$competition['country'],$season,(int)$home['id'],$home['name']??'Unknown',$home['crest']??null,(int)$away['id'],$away['name']??'Unknown',$away['crest']??null,$kickoff,$status,$finished?(int)$score['home']:null,$finished?(int)$score['away']:null,$finished?1:0]);
            $fixtures++;
        }
    }
    $pdo->beginTransaction();
    try {
        $pending=$pdo->query('SELECT p.id,p.predicted_home_score,p.predicted_away_score,f.home_score,f.away_score FROM game_predictions p JOIN prediction_fixtures f ON f.id=p.fixture_id WHERE f.result_confirmed=1 AND p.scored_at IS NULL FOR UPDATE')->fetchAll();
        $update=$pdo->prepare('UPDATE game_predictions SET points_awarded=?,scored_at=UTC_TIMESTAMP() WHERE id=?');
        foreach($pending as $p) {
            $exact=(int)$p['predicted_home_score']===(int)$p['home_score']&&(int)$p['predicted_away_score']===(int)$p['away_score'];
            $pred=(int)$p['predicted_home_score']<=>(int)$p['predicted_away_score'];$actual=(int)$p['home_score']<=>(int)$p['away_score'];
            $update->execute([$exact?3:($pred===$actual?1:0),(int)$p['id']]);$scored++;
        }
        $pdo->commit();
    } catch(Throwable $e) { if($pdo->inTransaction())$pdo->rollBack();throw $e; }
    $mappedRows=$pdo->prepare('SELECT favourite_club FROM prediction_team_map WHERE season=?');
    $mappedRows->execute([$season]);
    $mappedKeys=array_fill_keys(array_map('predictionNormalizeTeamName',$mappedRows->fetchAll(PDO::FETCH_COLUMN)),true);
    $unmapped=array_values(array_filter($favorites,static fn($name)=>!isset($mappedKeys[predictionNormalizeTeamName($name)])));
    return ['teams_mapped'=>$mapped,'fixtures_synced'=>$fixtures,'predictions_scored'=>$scored,'favourites_unmapped'=>$unmapped];
}
