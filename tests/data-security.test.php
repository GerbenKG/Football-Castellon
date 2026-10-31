<?php
declare(strict_types=1);
// Recording PDO fixture for real data-handler control flow.
$scenario = $argv[1] ?? 'finance-paid';
$writes = [];
$permissions = match ($scenario) {
    'finance-paid', 'finance-squad-edit' => ['payments.manage'],
    'attendance-paid', 'empty-delete' => ['attendance.manage'],
    default => [],
};
class RecordingStatement extends PDOStatement {
    public function __construct(private string $sql) {}
    public function execute(?array $params = null): bool {
        global $writes;
        if (preg_match('/^(INSERT|UPDATE|DELETE)/', $this->sql)) $writes[] = ['sql' => $this->sql, 'params' => $params];
        return true;
    }
}
class RecordingPDO extends PDO {
    public function __construct() {}
    public function prepare(string $query, array $options = []): PDOStatement|false { return new RecordingStatement($query); }
    public function inTransaction(): bool { return false; }
}
function db(): PDO { return new RecordingPDO(); }
function requireUser(): array { return ['id' => 'user', 'role' => 'fixture']; }
function requireCsrfToken(): void {}
function hasPermission(string $role, string $permission): bool { global $permissions; return in_array($permission, $permissions, true); }
function jsonResponse(array $data, int $status = 200): never {
    global $scenario, $writes;
    $expected = $scenario === 'finance-paid' ? 200 : ($scenario === 'empty-delete' ? 400 : 403);
    if ($status !== $expected) { fwrite(STDERR, json_encode([$scenario, $status, $data])); exit(1); }
    if ($expected !== 200 && $writes) { fwrite(STDERR, 'Denied operation wrote data'); exit(1); }
    if ($scenario === 'finance-paid' && (count($writes) !== 1 || !str_contains($writes[0]['sql'], 'UPDATE `game_players` SET `paid`') || $writes[0]['params']['u_paid'] !== 1)) exit(1);
    echo "PASS: $scenario\n"; exit;
}
$query = file_get_contents(__DIR__ . '/../api/query-lib.php');
$query = preg_replace('/^<\?php\s*declare\(strict_types=1\);/', '', $query);
$start = strpos($query, 'function hasPermission');
$end = strpos($query, 'function sqlValues');
$query = substr($query, 0, $start) . substr($query, $end);
eval($query);
const DATA_TABLES = ['game_players' => ['read' => 'attendance.view', 'write' => 'attendance.manage', 'columns' => ['id','game_id','player_id','paid','playing'], 'order' => ['id']]];
$_GET = ['table' => 'game_players'];
$_SERVER['REQUEST_METHOD'] = 'POST';
$body = ['action' => 'update', 'data' => ['paid' => true], 'filters' => [['column' => 'id', 'operator' => 'eq', 'value' => 'row']]];
if ($scenario === 'finance-squad-edit') $body['data'] = ['playing' => false];
if ($scenario === 'empty-delete') $body = ['action' => 'delete', 'filters' => []];
$handler = file_get_contents(__DIR__ . '/../api/data-handler.php');
$handler = preg_replace('/^<\?php\s*declare\(strict_types=1\);/', '', $handler);
$handler = preg_replace('/^require_once .*;$/m', '', $handler);
$handler = str_replace("file_get_contents('php://input')", 'json_encode($GLOBALS["body"])', $handler);
eval($handler);
