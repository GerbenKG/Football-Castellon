<?php
declare(strict_types=1);
require_once __DIR__ . '/auth/session.php';
require_once __DIR__ . '/auth/csrf-lib.php';
require_once __DIR__ . '/query-lib.php';
$user = requireUser();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
$body = $method === 'POST' ? json_decode(file_get_contents('php://input') ?: '', true) : $_GET;
if (!is_array($body)) jsonResponse(['error' => 'Invalid request'], 400);
$name = $body['name'] ?? '';
if ($name === 'list_player_avatars' && $method === 'GET') {
    $rows = db()->query('SELECT p.name AS player_name, ap.avatar_path FROM access_profiles ap INNER JOIN players p ON p.id = ap.player_id WHERE ap.active = TRUE AND ap.avatar_path IS NOT NULL')->fetchAll();
    jsonResponse($rows);
}
if ($name === 'player_list_game_squad' && $method === 'GET') {
    if (!hasPermission($user['role'], 'games.view')) jsonResponse(['error' => 'Permission denied'], 403);
    $stmt = db()->prepare('SELECT gp.player_id, COALESCE(p.name, gp.guest_name) AS name FROM game_players gp LEFT JOIN players p ON p.id = gp.player_id WHERE gp.game_id = :id AND gp.playing = TRUE ORDER BY name');
    $stmt->execute(['id' => (string) ($body['p_game_id'] ?? '')]);
    jsonResponse($stmt->fetchAll());
}
if ($name === 'set_game_bib_taker' && $method === 'POST') {
    requireCsrfToken();
    if (!hasPermission($user['role'], 'attendance.manage')) jsonResponse(['error' => 'Permission denied'], 403);
    $pdo = db();
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT game_id FROM game_players WHERE id = :id AND player_id IS NOT NULL');
        $stmt->execute(['id' => (string) ($body['p_game_player_id'] ?? '')]);
        $game = $stmt->fetchColumn();
        if (!$game) throw new RuntimeException('Squad member not found');
        $pdo->prepare('SELECT id FROM games WHERE id = :id FOR UPDATE')->execute(['id' => $game]);
        $stmt = $pdo->prepare('SELECT id FROM game_players WHERE id = :id AND game_id = :game AND playing = TRUE FOR UPDATE');
        $stmt->execute(['id' => $body['p_game_player_id'], 'game' => $game]);
        if (!$stmt->fetch()) throw new RuntimeException('Player is not playing');
        $pdo->prepare('UPDATE game_players SET took_bibs = FALSE WHERE game_id = :game')->execute(['game' => $game]);
        $pdo->prepare('UPDATE game_players SET took_bibs = TRUE WHERE id = :id')->execute(['id' => $body['p_game_player_id']]);
        $pdo->commit();
        jsonResponse(['ok' => true]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(['error' => 'Unable to select bib taker'], 409);
    }
}
jsonResponse(['error' => 'Unsupported operation'], 400);
