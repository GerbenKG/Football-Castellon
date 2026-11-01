<?php
declare(strict_types=1);

function hasPermission(string $role, string $permission): bool
{
    if ($role === 'super_admin') return true;
    $stmt = db()->prepare('SELECT enabled FROM role_permissions WHERE role = :role AND permission = :permission');
    $stmt->execute(['role' => $role, 'permission' => $permission]);
    return (bool) $stmt->fetchColumn();
}

function sqlValues(array $values): array
{
    return array_map(static fn($value) => is_bool($value) ? (int) $value : $value, $values);
}

function queryFilters(array $filters, array $columns, array &$params): string
{
    $clauses = [];
    foreach ($filters as $index => $filter) {
        if (!is_array($filter) || !in_array($filter['column'] ?? null, $columns, true)) throw new InvalidArgumentException('Invalid filter column');
        $column = '`' . $filter['column'] . '`';
        $operator = $filter['operator'] ?? 'eq';
        $value = $filter['value'] ?? null;
        $key = 'f' . $index;
        if (in_array($operator, ['is', 'not'], true)) {
            if ($value !== null) throw new InvalidArgumentException('Only null checks are supported');
            $clauses[] = $column . ($operator === 'not' ? ' IS NOT NULL' : ' IS NULL');
        } elseif ($operator === 'in') {
            if (!is_array($value) || count($value) > 500) throw new InvalidArgumentException('Invalid list filter');
            $names = [];
            foreach ($value as $n => $item) {
                if (!is_scalar($item)) throw new InvalidArgumentException('Invalid filter value');
                $name = $key . '_' . $n;
                $params[$name] = $item;
                $names[] = ':' . $name;
            }
            $clauses[] = $names ? $column . ' IN (' . implode(',', $names) . ')' : '1 = 0';
        } else {
            $operators = ['eq' => '=', 'neq' => '<>', 'lt' => '<', 'gte' => '>='];
            if (!isset($operators[$operator]) || !is_scalar($value)) throw new InvalidArgumentException('Invalid filter');
            $params[$key] = $value;
            $clauses[] = $column . ' ' . $operators[$operator] . ' :' . $key;
        }
    }
    return $clauses ? ' WHERE ' . implode(' AND ', $clauses) : '';
}

function normalizeRows(array $rows): array
{
    foreach ($rows as &$row) {
        foreach (['playing','paid','took_bibs','active','enabled'] as $key) if (isset($row[$key])) $row[$key] = (bool) $row[$key];
    }
    return $rows;
}
