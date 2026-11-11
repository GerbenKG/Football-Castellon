<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function predictionApiConfig(): array {
    $path = dirname(__DIR__, 2) . '/api-football-config.php';
    if (!is_file($path)) throw new RuntimeException('API-Football configuration is missing');
    $config = require $path;
    if (!is_array($config) || !is_string($config['api_key'] ?? null) || trim($config['api_key']) === '') throw new RuntimeException('API-Football configuration is invalid');
    return $config;
}
/**
 * Create the local daily usage ledger. This is deliberately independent of
 * API-Football so the quota gate can run before any paid/limited request.
 */
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

/**
 * Atomically reserve one outbound request. The internal ceiling is 80/day,
 * and the provider's last reported daily remaining quota must stay above 20.
 */
function predictionReserveApiRequest(PDO $pdo): void {
    predictionEnsureUsageSchema($pdo);
    $today = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');
    $pdo->prepare('INSERT IGNORE INTO prediction_api_usage (usage_date) VALUES (?)')->execute([$today]);
    $stmt = $pdo->prepare("UPDATE prediction_api_usage
        SET request_count = request_count + 1, last_request_at = UTC_TIMESTAMP()
        WHERE usage_date = ?
          AND request_count < 80
          AND (provider_daily_remaining IS NULL OR provider_daily_remaining > 20)");
    $stmt->execute([$today]);
    if ($stmt->rowCount() !== 1) {
        $usage = $pdo->prepare('SELECT request_count, provider_daily_remaining FROM prediction_api_usage WHERE usage_date=?');
        $usage->execute([$today]);
        $row = $usage->fetch(PDO::FETCH_ASSOC) ?: [];
        $count = (int)($row['request_count'] ?? 0);
        $remaining = $row['provider_daily_remaining'] ?? null;
        if ($count >= 80) {
            throw new RuntimeException('API-Football daily safety limit reached (80 requests). Sync deferred until 00:00 UTC.');
        }
        if ($remaining !== null && (int)$remaining <= 20) {
            throw new RuntimeException('API-Football quota safety margin reached (20 requests remaining). Sync deferred until 00:00 UTC.');
        }
        throw new RuntimeException('API-Football request blocked by the daily quota guard.');
    }
}

/** Store provider daily quota headers when API-Football supplies them. */
function predictionStoreApiQuota(PDO $pdo, array $headers): void {
    $remaining = null;
    $limit = null;
    foreach ($headers as $name => $value) {
        $key = strtolower(trim((string)$name));
        if ($key === 'x-ratelimit-requests-remaining' && is_numeric($value)) $remaining = max(0, (int)$value);
        if ($key === 'x-ratelimit-requests-limit' && is_numeric($value)) $limit = max(0, (int)$value);
    }
    if ($remaining === null && $limit === null) return;
    $today = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');
    $stmt = $pdo->prepare('UPDATE prediction_api_usage SET
        provider_daily_remaining = COALESCE(?, provider_daily_remaining),
        provider_daily_limit = COALESCE(?, provider_daily_limit)
        WHERE usage_date = ?');
    $stmt->execute([$remaining, $limit, $today]);
}

function predictionApi(string $endpoint, array $params = []): array {
    $pdo = db();
    predictionReserveApiRequest($pdo);

    $url = 'https://v3.football.api-sports.io/' . ltrim($endpoint, '/') . ($params ? '?' . http_build_query($params) : '');
    $headers = [];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['x-apisports-key: ' . predictionApiConfig()['api_key'], 'Accept: application/json'],
        CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$headers): int {
            $length = strlen($line);
            $parts = explode(':', $line, 2);
            if (count($parts) === 2) $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
            return $length;
        },
    ]);

    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    // A request is counted even when it times out or returns an HTTP error:
    // the provider may still have received and charged the request.
    predictionStoreApiQuota($pdo, $headers);

    if ($raw === false || $status < 200 || $status >= 300) {
        throw new RuntimeException('API-Football request failed (' . $status . ')' . ($error ? ': ' . $error : ''));
    }
    $json = json_decode($raw, true);
    if (!is_array($json) || !empty($json['errors'])) throw new RuntimeException('API-Football returned an invalid response');
    return $json['response'] ?? [];
}
function predictionCurrentSeason(): int { return (int)(new DateTimeImmutable('now', new DateTimeZone('Europe/Madrid')))->format('Y'); }
function predictionFavouriteNames(PDO $pdo): array {
    $names=[];
    $stmt=$pdo->query("SELECT payload FROM club_records WHERE kind='favorite_club'");
    foreach($stmt->fetchAll(PDO::FETCH_COLUMN) as $payload) {
        $row=json_decode($payload,true); $name=$row['club']['name']??null;
        if(is_string($name)&&trim($name)!=='') $names[mb_strtolower(trim($name))]=trim($name);
    }
    return array_values($names);
}
function predictionDomesticLeague(array $league): bool {
    $type=strtolower((string)($league['type']??''));
    $country=strtolower((string)($league['country']['name']??''));
    return $type==='league' && $country!=='' && !in_array($country,['world','international'],true);
}
function predictionSync(PDO $pdo, bool $discover=true): array {
    $season=predictionCurrentSeason(); $mapped=0; $fixtures=0; $scored=0;
    if($discover) {
        foreach(predictionFavouriteNames($pdo) as $club) {
            $cached=$pdo->prepare('SELECT COUNT(*) FROM prediction_team_map WHERE favourite_club=? AND season=? AND updated_at>UTC_TIMESTAMP()-INTERVAL 7 DAY');$cached->execute([$club,$season]);if((int)$cached->fetchColumn()>0)continue;
            $matches=predictionApi('teams',['search'=>$club]);
            $team=null;
            foreach($matches as $candidate) if(mb_strtolower(trim($candidate['team']['name']??''))===mb_strtolower($club)) {$team=$candidate['team'];break;}
            if(!$team) continue;
            $leagues=predictionApi('leagues',['team'=>(int)$team['id'],'season'=>$season]);
            foreach($leagues as $entry) {
                $league=$entry['league']??[]; $country=$entry['country']??[];
                if(!predictionDomesticLeague(['type'=>$league['type']??'','country'=>$country])) continue;
                $s=$pdo->prepare('INSERT INTO prediction_team_map (favourite_club,api_team_id,api_team_name,api_league_id,league_name,country,season) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE api_team_id=VALUES(api_team_id),api_team_name=VALUES(api_team_name),api_league_id=VALUES(api_league_id),league_name=VALUES(league_name),country=VALUES(country),updated_at=CURRENT_TIMESTAMP');
                $s->execute([$club,(int)$team['id'],$team['name'],(int)$league['id'],$league['name'],$country['name']??'', $season]); $mapped++;
            }
        }
    }
    $leagues=$pdo->query('SELECT DISTINCT api_league_id,league_name,country,season FROM prediction_team_map')->fetchAll();
    foreach($leagues as $league) {
        $from=(new DateTimeImmutable('now',new DateTimeZone('UTC')))->modify('-14 days')->format('Y-m-d');
        $to=(new DateTimeImmutable('now',new DateTimeZone('UTC')))->modify('+45 days')->format('Y-m-d');
        $response=predictionApi('fixtures',['league'=>(int)$league['api_league_id'],'season'=>(int)$league['season'],'from'=>$from,'to'=>$to]);
        foreach($response as $item) {
            $f=$item['fixture']??[];$teams=$item['teams']??[];$goals=$item['goals']??[];$status=$f['status']['short']??'NS';
            if(empty($f['id'])||empty($teams['home']['id'])||empty($teams['away']['id'])||empty($f['date'])) continue;
            $kickoff=(new DateTimeImmutable($f['date']))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
            $finished=in_array($status,['FT','AET','PEN'],true)&&is_numeric($goals['home']??null)&&is_numeric($goals['away']??null);
            $s=$pdo->prepare('INSERT INTO prediction_fixtures (api_fixture_id,api_league_id,league_name,country,season,home_team_id,home_team_name,home_team_logo,away_team_id,away_team_name,away_team_logo,kickoff_utc,fixture_status,home_score,away_score,result_confirmed,last_synced_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE kickoff_utc=VALUES(kickoff_utc),fixture_status=VALUES(fixture_status),home_score=VALUES(home_score),away_score=VALUES(away_score),result_confirmed=VALUES(result_confirmed),last_synced_at=UTC_TIMESTAMP(),home_team_name=VALUES(home_team_name),away_team_name=VALUES(away_team_name),home_team_logo=VALUES(home_team_logo),away_team_logo=VALUES(away_team_logo)');
            $s->execute([(int)$f['id'],(int)$league['api_league_id'],$league['league_name'],$league['country'],(int)$league['season'],(int)$teams['home']['id'],$teams['home']['name'],$teams['home']['logo']??null,(int)$teams['away']['id'],$teams['away']['name'],$teams['away']['logo']??null,$kickoff,$status,$finished?(int)$goals['home']:null,$finished?(int)$goals['away']:null,$finished?1:0]);
            $fixtures++;
        }
    }
    $pdo->beginTransaction();
    try {
        $pending=$pdo->query('SELECT p.id,p.predicted_home_score,p.predicted_away_score,f.home_score,f.away_score FROM game_predictions p JOIN prediction_fixtures f ON f.id=p.fixture_id WHERE f.result_confirmed=1 AND p.scored_at IS NULL FOR UPDATE')->fetchAll();
        $update=$pdo->prepare('UPDATE game_predictions SET points_awarded=?,scored_at=UTC_TIMESTAMP() WHERE id=?');
        foreach($pending as $p) {
            $exact=(int)$p['predicted_home_score']===(int)$p['home_score']&&(int)$p['predicted_away_score']===(int)$p['away_score'];
            $pred=(int)$p['predicted_home_score'] <=> (int)$p['predicted_away_score']; $actual=(int)$p['home_score'] <=> (int)$p['away_score'];
            $update->execute([$exact?3:($pred===$actual?1:0),(int)$p['id']]);$scored++;
        }
        $pdo->commit();
    } catch(Throwable $e) { if($pdo->inTransaction())$pdo->rollBack();throw $e; }
    return ['teams_mapped'=>$mapped,'fixtures_synced'=>$fixtures,'predictions_scored'=>$scored];
}
