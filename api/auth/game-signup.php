<?php
// Compatibility endpoint: the club and older player pages share the same queue.
declare(strict_types=1);
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/csrf-lib.php';
require_once dirname(__DIR__) . '/query-lib.php';
require_once dirname(__DIR__) . '/club-lib.php';
$user = requireUser();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
requireCsrfToken();
if ($user['role'] !== 'player' || !$user['player_id']) jsonResponse(['error' => 'Player access required'], 403);
$body = json_decode(file_get_contents('php://input') ?: '', true);
$pdo = db();
try {
    $id = clubId($body['game_id'] ?? null);
    ensureClubSchema($pdo);
    $pdo->beginTransaction();
    $result = clubSignup($pdo, $user, $id);
    $pdo->commit();
    jsonResponse($result);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonResponse(['error' => $e instanceof InvalidArgumentException || $e instanceof DomainException ? $e->getMessage() : 'Unable to update signup'], $e instanceof DomainException ? 403 : 422);
}
