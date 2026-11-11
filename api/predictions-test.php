<?php
declare(strict_types=1);

// Isolated leaderboard/scoring test. CLI-only and development-database-only.
// All tables are TEMPORARY and disappear automatically when this process exits.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
if (strtolower(trim((string)getenv('FOOTBALL_ENV'))) !== 'dev') {
    fwrite(STDERR, "Refusing to run: set FOOTBALL_ENV=dev. Production is never supported.\n");
    exit(2);
}
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Temporary tables deliberately mirror only the columns used by the real
// scoring and leaderboard SQL. No persistent application rows are created.
$pdo->exec("CREATE TEMPORARY TABLE prediction_fixtures (
    id INT NOT NULL PRIMARY KEY,
    home_score TINYINT UNSIGNED NOT NULL,
    away_score TINYINT UNSIGNED NOT NULL,
    result_confirmed TINYINT(1) NOT NULL
) ENGINE=InnoDB");
$pdo->exec("CREATE TEMPORARY TABLE players (
    id INT NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    archived_at DATETIME NULL
) ENGINE=InnoDB");
$pdo->exec("CREATE TEMPORARY TABLE game_predictions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    fixture_id INT NOT NULL,
    player_id INT NOT NULL,
    predicted_home_score TINYINT UNSIGNED NOT NULL,
    predicted_away_score TINYINT UNSIGNED NOT NULL,
    points_awarded TINYINT UNSIGNED NOT NULL DEFAULT 0,
    scored_at DATETIME NULL
) ENGINE=InnoDB");

$pdo->exec("INSERT INTO prediction_fixtures (id,home_score,away_score,result_confirmed) VALUES (900001,3,1,1)");
$pdo->exec("INSERT INTO players (id,name,archived_at) VALUES
    (900001,'Test Player A',NULL),
    (900002,'Test Player B',NULL),
    (900003,'Test Player C',NULL),
    (900004,'Test Player D',NULL)");
$pdo->exec("INSERT INTO game_predictions
    (fixture_id,player_id,predicted_home_score,predicted_away_score)
    VALUES
    (900001,900001,3,1),
    (900001,900002,2,1),
    (900001,900003,1,2),
    (900001,900004,0,0)");

$pending = $pdo->query("SELECT p.id,p.predicted_home_score,p.predicted_away_score,
        f.home_score,f.away_score
    FROM game_predictions p
    JOIN prediction_fixtures f ON f.id=p.fixture_id
    WHERE f.result_confirmed=1 AND p.scored_at IS NULL
    FOR UPDATE")->fetchAll(PDO::FETCH_ASSOC);
$update = $pdo->prepare('UPDATE game_predictions SET points_awarded=?,scored_at=UTC_TIMESTAMP() WHERE id=?');
foreach ($pending as $p) {
    $exact = (int)$p['predicted_home_score'] === (int)$p['home_score']
        && (int)$p['predicted_away_score'] === (int)$p['away_score'];
    $predictedResult = (int)$p['predicted_home_score'] <=> (int)$p['predicted_away_score'];
    $actualResult = (int)$p['home_score'] <=> (int)$p['away_score'];
    $update->execute([$exact ? 3 : ($predictedResult === $actualResult ? 1 : 0), (int)$p['id']]);
}

$board = $pdo->query("SELECT p.player_id,pl.name,
        SUM(p.points_awarded) points,
        SUM(CASE WHEN p.points_awarded>0 THEN 1 ELSE 0 END) correct_games,
        COUNT(p.scored_at) scored_games
    FROM game_predictions p
    JOIN players pl ON pl.id=p.player_id
    WHERE p.scored_at IS NOT NULL AND pl.archived_at IS NULL
    GROUP BY p.player_id,pl.name
    ORDER BY points DESC,correct_games DESC,pl.name")->fetchAll(PDO::FETCH_ASSOC);

// Re-run the scoring selection: already-scored predictions must not be selected.
$pendingAgain = (int)$pdo->query("SELECT COUNT(*) FROM game_predictions p
    JOIN prediction_fixtures f ON f.id=p.fixture_id
    WHERE f.result_confirmed=1 AND p.scored_at IS NULL")->fetchColumn();

$expected = [
    ['name'=>'Test Player A','points'=>3,'correct_games'=>1,'scored_games'=>1],
    ['name'=>'Test Player B','points'=>1,'correct_games'=>1,'scored_games'=>1],
    ['name'=>'Test Player C','points'=>0,'correct_games'=>0,'scored_games'=>1],
    ['name'=>'Test Player D','points'=>0,'correct_games'=>0,'scored_games'=>1],
];
$actual = array_map(static fn(array $r): array => [
    'name'=>$r['name'],
    'points'=>(int)$r['points'],
    'correct_games'=>(int)$r['correct_games'],
    'scored_games'=>(int)$r['scored_games'],
], $board);
$passed = count($pending) === 4 && $actual === $expected && $pendingAgain === 0;

echo json_encode([
    'ok'=>$passed,
    'test'=>'isolated leaderboard scoring',
    'fixture_result'=>'3-1',
    'predictions_scored'=>count($pending),
    'leaderboard'=>$actual,
    'pending_after_rescore'=>$pendingAgain,
    'persistent_data_created'=>false,
    'note'=>'All test data lived in connection-scoped temporary tables and was discarded when this process exits.'
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;

exit($passed ? 0 : 1);
