<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$config = require $argv[1];
if ($config['host'] !== '127.0.0.1' || $config['database'] !== 'football_castellon_dev' || $config['port'] !== 33079) throw new RuntimeException('Refusing to seed anything except the private local database');
$pdo = new PDO('mysql:host=127.0.0.1;port=33079;charset=utf8mb4', $config['username'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE IF NOT EXISTS football_castellon_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo->exec('USE football_castellon_dev');
$pdo->exec(file_get_contents(__DIR__ . '/schema.sql'));
$roles = ['super_admin', 'admin', 'attendance', 'finance', 'viewer', 'player'];
foreach ($roles as $index => $role) {
    $playerId = sprintf('00000000-0000-4000-8000-%012d', $index + 1);
    $userId = sprintf('10000000-0000-4000-8000-%012d', $index + 1);
    $name = 'Local ' . ucwords(str_replace('_', ' ', $role));
    $email = 'local-' . $role . '@example.test';
    $pdo->prepare('INSERT IGNORE INTO players (id, name, email, skill_level) VALUES (?, ?, ?, ?)')->execute([$playerId, $name, $email, 1 + ($index % 5)]);
    $pdo->prepare('INSERT IGNORE INTO users (id, google_subject, email, display_name) VALUES (?, ?, ?, ?)')->execute([$userId, 'local:' . $role, $email, $name]);
    $pdo->prepare('INSERT IGNORE INTO access_profiles (email, user_id, display_name, role, active, player_id) VALUES (?, ?, ?, ?, 1, ?)')->execute([$email, $userId, $name, $role, $playerId]);
}
$season = '20000000-0000-4000-8000-000000000001';
$pdo->prepare('INSERT IGNORE INTO finance_seasons (id, name, starts_on, ends_on, season_ticket_amount, pay_per_game_amount) VALUES (?, ?, DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 300 DAY), 100, 10)')->execute([$season, 'Local test season']);
foreach ([-7, 1, 8] as $index => $days) {
    $gameId = sprintf('30000000-0000-4000-8000-%012d', $index + 1);
    $date = (new DateTimeImmutable())->modify(($days >= 0 ? '+' : '') . $days . ' days')->format('Y-m-d');
    $pdo->prepare('INSERT IGNORE INTO games (id, game_date, start_time, end_time, location) VALUES (?, ?, ?, ?, ?)')->execute([$gameId, $date, '19:30:00', '21:30:00', 'Local test pitch']);
    foreach ($roles as $n => $role) {
        $rowId = sprintf('40000000-0000-4000-8000-%012d', $index * 10 + $n + 1);
        $playerId = sprintf('00000000-0000-4000-8000-%012d', $n + 1);
        $pdo->prepare('INSERT IGNORE INTO game_players (id, game_id, player_id, playing, paid, took_bibs) VALUES (?, ?, ?, 1, ?, ?)')->execute([$rowId, $gameId, $playerId, $n % 2, (int) ($n === 0)]);
    }
}
$pdo->prepare('INSERT IGNORE INTO finance_season_tickets (id, season_id, player_id, amount, paid) VALUES (?, ?, ?, 100, 1)')->execute(['50000000-0000-4000-8000-000000000001', $season, '00000000-0000-4000-8000-000000000001']);
$pdo->prepare('INSERT IGNORE INTO finance_expenses (id, season_id, due_date, description, amount, paid) VALUES (?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?, 80, 0)')->execute(['60000000-0000-4000-8000-000000000001', $season, 'Sample pitch rental']);
echo "Local sample database is ready.\n";
