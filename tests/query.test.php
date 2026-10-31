<?php
declare(strict_types=1);
require __DIR__ . '/../api/query-lib.php';
function check(bool $condition, string $label): void {
    if (!$condition) throw new RuntimeException($label);
    echo "PASS: $label\n";
}
$params = [];
$sql = queryFilters([
    ['column' => 'id', 'operator' => 'in', 'value' => ["a' OR 1=1", 'b']],
    ['column' => 'archived_at', 'operator' => 'is', 'value' => null],
    ['column' => 'game_date', 'operator' => 'gte', 'value' => '2026-10-31'],
], ['id','archived_at','game_date'], $params);
check(!str_contains($sql, "OR 1=1") && $params['f0_0'] === "a' OR 1=1", 'Filter values are bound as parameters');
check(str_contains($sql, 'IS NULL') && str_contains($sql, '>= :f2'), 'Null and date filters retain their semantics');
$params = [];
check(queryFilters([['column'=>'id','operator'=>'in','value'=>[]]], ['id'], $params) === ' WHERE 1 = 0', 'Empty IN filter matches no rows');
foreach ([
    ['column'=>'id; DROP TABLE players','operator'=>'eq','value'=>'x'],
    ['column'=>'id','operator'=>'raw','value'=>'x'],
    ['column'=>'id','operator'=>'is','value'=>false],
] as $filter) {
    $failed = false;
    try { $params = []; queryFilters([$filter], ['id'], $params); } catch (InvalidArgumentException $error) { $failed = true; }
    check($failed, 'Invalid filter rejected');
}
$rows = normalizeRows([['playing'=>0,'paid'=>1,'active'=>'0']]);
check($rows[0] === ['playing'=>false,'paid'=>true,'active'=>false], 'Database booleans are normalized');
check(sqlValues(['paid'=>false,'phone'=>null]) === ['paid'=>0,'phone'=>null], 'Write values preserve false and null');
