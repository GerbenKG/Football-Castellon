<?php
declare(strict_types=1);
require_once __DIR__ . '/auth/session.php';
require_once __DIR__ . '/auth/csrf-lib.php';
require_once __DIR__ . '/query-lib.php';
require_once __DIR__ . '/club-lib.php';
$user = requireUser();
$table = $_GET['table'] ?? '';
if (!is_string($table) || !isset(DATA_TABLES[$table])) jsonResponse(['error' => 'Unsupported data table'], 400);
$config = DATA_TABLES[$table];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();
try {
    if ($method === 'GET') {
        if (!hasPermission($user['role'], $config['read'])) jsonResponse(['error' => 'Permission denied'], 403);
        $filters = json_decode((string) ($_GET['filters'] ?? '[]'), true);
        $orders = json_decode((string) ($_GET['orders'] ?? '[]'), true);
        if (!is_array($filters) || !is_array($orders)) throw new InvalidArgumentException('Invalid query');
        $params = [];
        $sql = 'SELECT * FROM `' . $table . '`' . queryFilters($filters, $config['columns'], $params);
        $sort = [];
        foreach ($orders as $order) {
            if (!is_array($order) || !in_array($order['column'] ?? null, $config['order'], true)) throw new InvalidArgumentException('Invalid order');
            $sort[] = '`' . $order['column'] . '` ' . (($order['ascending'] ?? true) ? 'ASC' : 'DESC');
        }
        if ($sort) $sql .= ' ORDER BY ' . implode(',', $sort);
        if (isset($_GET['limit'])) {
            $limit = filter_var($_GET['limit'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
            if ($limit === false) throw new InvalidArgumentException('Invalid limit');
            $sql .= ' LIMIT ' . $limit;
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute(sqlValues($params));
        $rows = normalizeRows($stmt->fetchAll());
        if ($table === 'game_players' && ($_GET['include_players'] ?? '') === '1') {
            $ids = array_values(array_unique(array_filter(array_column($rows, 'player_id'))));
            $players = [];
            if ($ids) {
                $stmt = $pdo->prepare('SELECT id, name, skill_level FROM players WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
                $stmt->execute($ids);
                foreach ($stmt->fetchAll() as $player) $players[$player['id']] = $player;
            }
            foreach ($rows as &$row) $row['players'] = $players[$row['player_id']] ?? null;
            unset($row);
        }
        jsonResponse(['data' => $rows]);
    }
    if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
    requireCsrfToken();
    $body = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($body)) throw new InvalidArgumentException('Invalid request body');
    $action = $body['action'] ?? '';
    if (!in_array($action, ['insert','upsert','update','delete'], true)) throw new InvalidArgumentException('Invalid action');
    $canWrite = hasPermission($user['role'], $config['write']);
    $canPay = hasPermission($user['role'], 'payments.manage');
    if (!$canWrite && !($table === 'game_players' && $canPay && $action === 'update')) jsonResponse(['error' => 'Permission denied'], 403);
    $filters = $body['filters'] ?? [];
    if (!is_array($filters)) throw new InvalidArgumentException('Invalid filters');
    $validate = static function (array $row) use ($table, $config, $user, $canWrite, $canPay, $action): array {
        if (!$row || array_diff(array_keys($row), $config['columns'])) throw new InvalidArgumentException('Invalid data columns');
        foreach ($row as $value) if ($value !== null && !is_scalar($value)) throw new InvalidArgumentException('Invalid data value');
        if ($table === 'players' && array_key_exists('skill_level', $row) && $user['role'] !== 'super_admin') jsonResponse(['error' => 'Permission denied'], 403);
        if ($table === 'game_players') {
            if (!$canWrite && array_diff(array_keys($row), ['paid'])) jsonResponse(['error' => 'Permission denied'], 403);
            if (!$canPay && array_key_exists('paid', $row)) {
                if ($action === 'insert' && $row['paid'] === false) unset($row['paid']);
                else jsonResponse(['error' => 'Permission denied'], 403);
            }
        }
        return $row;
    };
    $financial = in_array($table, ['payments','finance_seasons','finance_season_tickets','finance_expenses'], true)
        || ($table === 'game_players' && ($action === 'delete' || array_key_exists('paid', $body['data'] ?? [])));
    if ($action === 'insert' || $action === 'upsert') {
        $data = $body['data'] ?? null;
        if (!is_array($data)) throw new InvalidArgumentException('Invalid data');
        $rows = array_is_list($data) ? $data : [$data];
        $rows = array_map($validate, $rows);
        if ($financial) ensureClubSchema($pdo);
        $pdo->beginTransaction();
        foreach ($rows as &$row) {
            if ($action === 'upsert' && !isset($row['id'])) throw new InvalidArgumentException('Upsert requires id');
            $row['id'] ??= uuidV4();
            if ($table === 'game_players' && isset($row['game_id'], $row['player_id'])) {
                $pdo->prepare('SELECT id FROM games WHERE id = :id FOR UPDATE')->execute(['id' => $row['game_id']]);
                $duplicate = $pdo->prepare('SELECT id FROM game_players WHERE game_id = :game AND player_id = :player AND id <> :id');
                $duplicate->execute(['game' => $row['game_id'], 'player' => $row['player_id'], 'id' => $row['id']]);
                if ($duplicate->fetch()) throw new InvalidArgumentException('Player is already in this squad');
            }
            $exists = false;
            if ($action === 'upsert') {
                $stmt = $pdo->prepare('SELECT id FROM `' . $table . '` WHERE id = :id FOR UPDATE');
                $stmt->execute(['id' => $row['id']]);
                $exists = (bool) $stmt->fetchColumn();
            }
            $columns = array_keys($row);
            if ($exists) {
                $updates = array_values(array_filter($columns, static fn($c) => $c !== 'id'));
                if (!$updates) continue;
                $sql = 'UPDATE `' . $table . '` SET ' . implode(',', array_map(static fn($c) => '`' . $c . '` = :' . $c, $updates)) . ' WHERE id = :id';
            } else {
                $sql = 'INSERT INTO `' . $table . '` (`' . implode('`,`', $columns) . '`) VALUES (:' . implode(',:', $columns) . ')';
            }
            $pdo->prepare($sql)->execute(sqlValues($row));
        }
        unset($row);
        if ($financial) clubAudit($pdo, $user, 'Finance records ' . $action, ['table' => $table, 'records' => $rows]);
        $pdo->commit();
        jsonResponse(['data' => normalizeRows($rows)]);
    }
    if (!$filters) throw new InvalidArgumentException('Mutation requires a filter');
    $params = [];
    $where = queryFilters($filters, $config['columns'], $params);
    if ($action === 'delete') {
        $sql = 'DELETE FROM `' . $table . '`' . $where;
    } else {
        $data = $body['data'] ?? null;
        if (!is_array($data)) throw new InvalidArgumentException('Invalid update');
        $data = $validate($data);
        if (array_key_exists('id', $data)) throw new InvalidArgumentException('Cannot change id');
        $sets = [];
        foreach ($data as $column => $value) {
            $sets[] = '`' . $column . '` = :u_' . $column;
            $params['u_' . $column] = $value;
        }
        $sql = 'UPDATE `' . $table . '` SET ' . implode(',', $sets) . $where;
    }
    if ($financial) { ensureClubSchema($pdo); $pdo->beginTransaction(); }
    $pdo->prepare($sql)->execute(sqlValues($params));
    if ($financial) {
        clubAudit($pdo, $user, 'Finance records ' . $action, ['table' => $table, 'filters' => $filters, 'changes' => $data ?? []]);
        $pdo->commit();
    }
    jsonResponse(['data' => true]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $status = $error instanceof InvalidArgumentException ? 400 : 409;
    jsonResponse(['error' => $status === 400 ? $error->getMessage() : 'Unable to save or load data'], $status);
}
