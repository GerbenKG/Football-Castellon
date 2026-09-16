<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/auth/session.php';
require_once __DIR__ . '/auth/csrf-lib.php';

const DATA_TABLES = [
    'players' => [
        'read' => 'players.view', 'write' => 'players.manage',
        'columns' => ['id', 'name', 'phone', 'email', 'bibs_taken_count', 'start_date', 'archived_at', 'skill_level'],
        'order' => ['id', 'name', 'email', 'start_date', 'created_at', 'updated_at'],
    ],
    'games' => [
        'read' => 'games.view', 'write' => 'games.manage',
        'columns' => ['id', 'game_date', 'start_time', 'end_time', 'location'],
        'order' => ['id', 'game_date', 'start_time', 'location', 'created_at', 'updated_at'],
    ],
    'game_players' => [
        'read' => 'attendance.view', 'write' => 'attendance.manage',
        'columns' => ['id', 'game_id', 'player_id', 'guest_name', 'playing', 'paid', 'took_bibs'],
        'order' => ['id', 'game_id', 'player_id', 'created_at', 'updated_at'],
    ],
    'payments' => [
        'read' => 'payments.view', 'write' => 'payments.manage',
        'columns' => ['id', 'player_id', 'game_id', 'payment_type', 'paid'],
        'order' => ['id', 'player_id', 'game_id', 'created_at'],
    ],
    'finance_seasons' => [
        'read' => 'payments.view', 'write' => 'payments.manage',
        'columns' => ['id', 'name', 'starts_on', 'ends_on', 'season_ticket_amount', 'pay_per_game_amount'],
        'order' => ['id', 'name', 'starts_on', 'ends_on', 'created_at', 'updated_at'],
    ],
    'finance_season_tickets' => [
        'read' => 'payments.view', 'write' => 'payments.manage',
        'columns' => ['id', 'season_id', 'player_id', 'amount', 'paid', 'paid_on'],
        'order' => ['id', 'season_id', 'player_id', 'paid_on', 'created_at', 'updated_at'],
    ],
    'finance_expenses' => [
        'read' => 'payments.view', 'write' => 'payments.manage',
        'columns' => ['id', 'season_id', 'due_date', 'description', 'category', 'amount', 'paid', 'paid_on'],
        'order' => ['id', 'season_id', 'due_date', 'description', 'created_at'],
    ],
];

function hasPermission(string $role, string $permission): bool
{
    if ($role === 'super_admin') return true;

    $stmt = db()->prepare(
        'SELECT enabled FROM role_permissions WHERE role = :role AND permission = :permission LIMIT 1'
    );
    $stmt->execute(['role' => $role, 'permission' => $permission]);
    return (bool) $stmt->fetchColumn();
}

function dataTable(string $name): array
{
    if (!isset(DATA_TABLES[$name])) jsonResponse(['error' => 'Unsupported data table'], 400);
    return DATA_TABLES[$name];
}

function filtersFrom(array $filters, array $allowedColumns, array &$params): string
{
    $parts = [];
    foreach ($filters as $index => $filter) {
        if (!is_array($filter)) jsonResponse(['error' => 'Invalid filter'], 400);
        $column = (string) ($filter['column'] ?? '');
        $operator = (string) ($filter['operator'] ?? 'eq');
        if (!in_array($column, $allowedColumns, true) || !in_array($operator, ['eq', 'neq'], true)) {
            jsonResponse(['error' => 'Invalid filter'], 400);
        }
        $param = ':f' . $index;
        $parts[] = '`' . $column . '` ' . ($operator === 'neq' ? '<>' : '=') . ' ' . $param;
        $params[$param] = $filter['value'] ?? null;
    }
    return $parts ? ' WHERE ' . implode(' AND ', $parts) : '';
}

function jsonBody(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($data)) jsonResponse(['error' => 'Invalid JSON body'], 400);
    return $data;
}

$user = requireUser();
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$tableName = (string) ($_GET['table'] ?? '');
$config = dataTable($tableName);

if ($method === 'GET') {
    if (!hasPermission((string) $user['role'], $config['read'])) jsonResponse(['error' => 'Permission denied'], 403);

    $params = [];
    $sql = 'SELECT * FROM `' . $tableName . '`';
    $filters = json_decode((string) ($_GET['filters'] ?? '[]'), true);
    if (!is_array($filters)) jsonResponse(['error' => 'Invalid filters'], 400);
    $sql .= filtersFrom($filters, $config['columns'], $params);

    $order = (string) ($_GET['order'] ?? '');
    if ($order !== '') {
        [$column, $direction] = array_pad(explode(':', $order, 2), 2, 'asc');
        if (!in_array($column, $config['order'], true)) jsonResponse(['error' => 'Invalid order column'], 400);
        $sql .= ' ORDER BY `' . $column . '` ' . (strtolower($direction) === 'desc' ? 'DESC' : 'ASC');
    }

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);

requireCsrfToken();
if (!hasPermission((string) $user['role'], $config['write'])) jsonResponse(['error' => 'Permission denied'], 403);

$body = jsonBody();
$action = (string) ($body['action'] ?? '');
$data = $body['data'] ?? null;
$filters = $body['filters'] ?? [];

if ($action === 'upsert' || $action === 'insert') {
    if (!is_array($data)) jsonResponse(['error' => 'Invalid data'], 400);
    $rows = array_is_list($data) ? $data : [$data];
    if (!$rows) jsonResponse(['data' => []]);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        foreach ($rows as $row) {
            if (!is_array($row) || !$row) throw new InvalidArgumentException('Invalid row');
            $row = array_intersect_key($row, array_flip($config['columns']));
            if (!isset($row['id'])) throw new InvalidArgumentException('Every row must include id');

            $columns = array_keys($row);
            $quoted = array_map(static fn(string $c): string => '`' . $c . '`', $columns);
            $placeholders = array_map(static fn(string $c): string => ':v_' . $c, $columns);
            $sql = 'INSERT INTO `' . $tableName . '` (' . implode(',', $quoted) . ') VALUES (' . implode(',', $placeholders) . ')';

            if ($action === 'upsert') {
                $updates = [];
                foreach ($columns as $column) {
                    if ($column !== 'id') $updates[] = '`' . $column . '` = VALUES(`' . $column . '`)';
                }
                if ($updates) $sql .= ' ON DUPLICATE KEY UPDATE ' . implode(',', $updates);
            }

            $params = [];
            foreach ($row as $column => $value) $params[':v_' . $column] = $value;
            $pdo->prepare($sql)->execute($params);
        }
        $pdo->commit();
        jsonResponse(['data' => $rows]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(['error' => $e instanceof PDOException ? 'Unable to save data' : $e->getMessage()], 400);
    }
}

if ($action === 'update') {
    if (!is_array($data) || !$data) jsonResponse(['error' => 'Invalid update data'], 400);
    if (!is_array($filters) || !$filters) jsonResponse(['error' => 'Update requires a filter'], 400);

    $data = array_intersect_key($data, array_flip($config['columns']));
    $sets = [];
    $params = [];
    foreach ($data as $column => $value) {
        $key = ':u_' . $column;
        $sets[] = '`' . $column . '` = ' . $key;
        $params[$key] = $value;
    }
    $sql = 'UPDATE `' . $tableName . '` SET ' . implode(',', $sets);
    $sql .= filtersFrom($filters, $config['columns'], $params);
    db()->prepare($sql)->execute($params);
    jsonResponse(['data' => true]);
}

if ($action === 'delete') {
    if (!is_array($filters) || !$filters) jsonResponse(['error' => 'Delete requires a filter'], 400);
    $params = [];
    $sql = 'DELETE FROM `' . $tableName . '`' . filtersFrom($filters, $config['columns'], $params);
    db()->prepare($sql)->execute($params);
    jsonResponse(['data' => true]);
}

jsonResponse(['error' => 'Unsupported data action'], 400);
