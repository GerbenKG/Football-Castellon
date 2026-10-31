<?php
declare(strict_types=1);

function clubPermissionNames(): array
{
    return ['clubhouse.view','clubhouse.manage','squad.view','dashboard.view','players.view','players.manage','games.view','games.manage','attendance.view','attendance.manage','payments.view','payments.manage','access.manage'];
}

function ensureClubPagePermissions(PDO $pdo): void
{
    // Preserve the clubhouse's existing audience. INSERT IGNORE never overwrites
    // an owner's saved profile choices on subsequent requests.
    $existing = $pdo->query('SELECT role,permission,enabled FROM role_permissions')->fetchAll();
    $roles = ['super_admin'=>[], 'admin'=>[], 'attendance'=>[], 'finance'=>[], 'viewer'=>[], 'player'=>[]];
    foreach ($existing as $row) $roles[$row['role']][$row['permission']] = (bool)$row['enabled'];
    $s = $pdo->prepare('INSERT IGNORE INTO role_permissions (role,permission,enabled) VALUES (?,?,?)');
    foreach ($roles as $role=>$permissions) {
        foreach (['clubhouse.view'=>true,'squad.view'=>true,'clubhouse.manage'=>($role==='super_admin'||($permissions['games.manage']??false))] as $permission=>$enabled) $s->execute([$role,$permission,(int)$enabled]);
    }
}

function validateClubPermissions(mixed $permissions): array
{
    if (!is_array($permissions) || array_is_list($permissions) || array_diff(array_keys($permissions), clubPermissionNames())) throw new InvalidArgumentException('Invalid profile permissions');
    // Every editable capability requires its corresponding read access.
    foreach ($permissions as $value) if (!is_bool($value)) throw new InvalidArgumentException('Permission values must be true or false');
    foreach (['clubhouse.manage'=>'clubhouse.view','games.manage'=>'games.view','players.manage'=>'players.view','attendance.manage'=>'attendance.view','payments.manage'=>'payments.view'] as $edit=>$read) {
        if (($permissions[$edit]??false) && !($permissions[$read]??false)) throw new InvalidArgumentException('Edit permission requires read access');
    }
    if (($permissions['attendance.manage']??false) && !($permissions['games.view']??false)) throw new InvalidArgumentException('Match signup management requires match access');
    if (($permissions['players.manage']??false) && !($permissions['squad.view']??false)) throw new InvalidArgumentException('Managing players requires squad access');
    // Owner powers are a fixed role, never a configurable checkbox.
    if ($permissions['access.manage']??false) throw new InvalidArgumentException('Membership and permissions are managed by Club owners only');
    return $permissions;
}
