<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';

$user = requireUser();
$pdo = db();

$permissionsStmt = $pdo->prepare(
    'SELECT permission, enabled
     FROM role_permissions
     WHERE role = :role
     ORDER BY permission'
);
$permissionsStmt->execute(['role' => $user['role']]);
$permissions = [];
foreach ($permissionsStmt->fetchAll() as $row) {
    $permissions[$row['permission']] = (bool) $row['enabled'];
}

$profile = [
    'email' => $user['email'],
    'user_id' => $user['id'],
    'display_name' => $user['display_name'],
    'role' => $user['role'],
    'active' => true,
    'player_id' => $user['player_id'],
    'phone' => $user['phone'],
    'contact_email' => $user['contact_email'],
    'avatar_path' => $user['avatar_path'],
];

$members = [];
$rolePermissions = [];

if ($user['role'] === 'super_admin') {
    $members = $pdo->query(
        'SELECT email, user_id, display_name, role, active, player_id,
                phone, contact_email, avatar_path
         FROM access_profiles
         ORDER BY email'
    )->fetchAll();

    $rolePermissions = $pdo->query(
        'SELECT role, permission, enabled
         FROM role_permissions
         ORDER BY role, permission'
    )->fetchAll();

    foreach ($rolePermissions as &$row) {
        $row['enabled'] = (bool) $row['enabled'];
    }
    unset($row);
}

jsonResponse([
    'allowed' => true,
    'profile' => $profile,
    'permissions' => $permissions,
    'members' => $members,
    'rolePermissions' => $rolePermissions,
]);
