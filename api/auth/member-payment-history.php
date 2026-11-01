<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once __DIR__ . '/session.php';

$user = requireUser();
$pdo = db();

$previewEmail = trim((string) ($_GET['preview_email'] ?? ''));

if ($previewEmail !== '') {
    if ($user['role'] !== 'super_admin') {
        jsonResponse(['error' => 'Super Admin access required'], 403);
    }

    $profileStmt = $pdo->prepare(
        'SELECT player_id FROM access_profiles WHERE LOWER(email) = LOWER(:email) AND active = TRUE LIMIT 1'
    );
    $profileStmt->execute(['email' => $previewEmail]);
    $playerId = $profileStmt->fetchColumn();
} else {
    $playerId = $user['player_id'];
}

if (!is_string($playerId) || $playerId === '') {
    jsonResponse([
        'summary' => ['total' => 0, 'paid' => 0, 'open' => 0, 'outstanding' => 0],
        'items' => [],
    ]);
}

$items = [];

$seasonStmt = $pdo->prepare(
    'SELECT fst.id, fst.amount, fst.paid, fst.paid_on, fs.name, fs.starts_on
     FROM finance_season_tickets fst
     INNER JOIN finance_seasons fs ON fs.id = fst.season_id
     WHERE fst.player_id = :player_id
     ORDER BY fs.starts_on DESC'
);
$seasonStmt->execute(['player_id' => $playerId]);
foreach ($seasonStmt->fetchAll() as $row) {
    $items[] = [
        'id' => $row['id'],
        'type' => 'season',
        'label' => 'Season ticket ' . $row['name'],
        'date' => $row['starts_on'],
        'paid_on' => $row['paid_on'],
        'amount' => (float) $row['amount'],
        'paid' => (bool) $row['paid'],
    ];
}

$gameStmt = $pdo->prepare(
    'SELECT gp.id, gp.paid, g.game_date, fs.pay_per_game_amount
     FROM game_players gp
     INNER JOIN games g ON g.id = gp.game_id
     LEFT JOIN finance_seasons fs
       ON g.game_date BETWEEN fs.starts_on AND fs.ends_on
     LEFT JOIN finance_season_tickets fst
       ON fst.season_id = fs.id
      AND fst.player_id = gp.player_id
     WHERE gp.player_id = :player_id
       AND gp.playing = TRUE
       AND fst.id IS NULL
     ORDER BY g.game_date DESC'
);
$gameStmt->execute(['player_id' => $playerId]);
foreach ($gameStmt->fetchAll() as $row) {
    $amount = (float) ($row['pay_per_game_amount'] ?? 0);
    $items[] = [
        'id' => $row['id'],
        'type' => 'game',
        'label' => 'Game · ' . $row['game_date'],
        'date' => $row['game_date'],
        'paid_on' => null,
        'amount' => $amount,
        'paid' => (bool) $row['paid'],
    ];
}

usort($items, static function (array $a, array $b): int {
    return strcmp((string) $b['date'], (string) $a['date']);
});

$total = count($items);
$paid = count(array_filter($items, static fn (array $item): bool => $item['paid']));
$open = $total - $paid;
$outstanding = array_reduce(
    $items,
    static fn (float $sum, array $item): float => $sum + ($item['paid'] ? 0.0 : (float) $item['amount']),
    0.0
);

jsonResponse([
    'summary' => [
        'total' => $total,
        'paid' => $paid,
        'open' => $open,
        'outstanding' => round($outstanding, 2),
    ],
    'items' => $items,
]);
