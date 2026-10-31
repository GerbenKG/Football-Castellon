<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/csrf-lib.php';
require_once dirname(__DIR__) . '/query-lib.php';

$user = requireUser();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
requireCsrfToken();
if ($user['role'] !== 'player' || !$user['player_id']) jsonResponse(['error' => 'Player access required'], 403);
if (!hasPermission($user['role'], 'games.view')) jsonResponse(['error' => 'Permission denied'], 403);
$body = json_decode(file_get_contents('php://input') ?: '', true);
$gameId = is_array($body) ? ($body['game_id'] ?? null) : null;
if (!is_string($gameId) || !preg_match('/^[a-f0-9-]{36}$/i', $gameId)) jsonResponse(['error' => 'Invalid game'], 400);

$pdo = db();
try {
    $pdo->beginTransaction();
    // Lock the parent game even when no signup exists, serializing first signups.
    $stmt = $pdo->prepare('SELECT id FROM games WHERE id = :id AND game_date >= CURDATE() FOR UPDATE');
    $stmt->execute(['id' => $gameId]);
    if (!$stmt->fetch()) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Upcoming game not found'], 404);
    }
    $stmt = $pdo->prepare('SELECT id, playing FROM game_players WHERE game_id = :game_id AND player_id = :player_id FOR UPDATE');
    $stmt->execute(['game_id' => $gameId, 'player_id' => $user['player_id']]);
    $rows = $stmt->fetchAll();
    if (count($rows) > 1) throw new RuntimeException('Duplicate signup records');
    $row = $rows[0] ?? null;
    $playing = !$row || !(bool) $row['playing'];
    if ($row) {
        $stmt = $pdo->prepare('UPDATE game_players SET playing = :playing WHERE id = :id');
        $stmt->execute(['playing' => (int) $playing, 'id' => $row['id']]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO game_players (id, game_id, player_id, playing) VALUES (:id, :game_id, :player_id, 1)');
        $stmt->execute(['id' => uuidV4(), 'game_id' => $gameId, 'player_id' => $user['player_id']]);
    }
    $pdo->commit();
    jsonResponse(['game_id' => $gameId, 'playing' => $playing]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonResponse(['error' => 'Unable to update signup'], 409);
}
