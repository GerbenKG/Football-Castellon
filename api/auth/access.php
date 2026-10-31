<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/csrf-lib.php';
require_once dirname(__DIR__) . '/club-lib.php';

$user = requireUser();
$pdo = db();
ensureClubSchema($pdo);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
if ($method === 'POST') {
    requireCsrfToken();
    if ($user['role'] !== 'super_admin') jsonResponse(['error' => 'Permission denied'], 403);
    $body = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($body)) jsonResponse(['error' => 'Invalid request body'], 400);
    $action = $body['action'] ?? '';
    $roles = ['super_admin', 'admin', 'attendance', 'finance', 'viewer', 'player'];
    $permissionsAllowed = clubPermissionNames();
    if (!in_array($action, ['admin_upsert_access', 'admin_delete_access', 'admin_update_permission','admin_set_role_permissions'], true)) jsonResponse(['error' => 'Unsupported access action'], 400);
    try {
        $pdo->beginTransaction();
        if ($action === 'admin_set_role_permissions') {
            $role = $body['role'] ?? '';
            if (!in_array($role, $roles, true) || $role === 'super_admin') throw new InvalidArgumentException('The Club owner profile is fixed');
            $permissions = validateClubPermissions($body['permissions'] ?? null);
            if (count($permissions) !== count($permissionsAllowed)) throw new InvalidArgumentException('Send the complete profile before saving');
            $stmt = $pdo->prepare('INSERT INTO role_permissions (role,permission,enabled) VALUES (?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled)');
            foreach ($permissions as $permission=>$enabled) $stmt->execute([$role,$permission,(int)$enabled]);
            clubAudit($pdo,$user,'Profile permissions updated',['role'=>$role,'permissions'=>$permissions]);
        } elseif ($action === 'admin_update_permission') {
            $role = $body['p_role'] ?? '';
            $permission = $body['p_permission'] ?? '';
            $enabled = $body['p_enabled'] ?? null;
            if (!in_array($role, $roles, true) || $role === 'super_admin' || !in_array($permission, $permissionsAllowed, true) || !is_bool($enabled)) throw new InvalidArgumentException('Invalid permission');
            $stmt = $pdo->prepare('INSERT INTO role_permissions (role, permission, enabled) VALUES (:role, :permission, :enabled) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)');
            $stmt->execute(['role' => $role, 'permission' => $permission, 'enabled' => (int) $enabled]);
            clubAudit($pdo,$user,'Profile permission updated',['role'=>$role,'permission'=>$permission,'enabled'=>$enabled]);
        } else {
            $email = $body['p_email'] ?? null;
            if (!is_string($email) || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) throw new InvalidArgumentException('Invalid email');
            $email = strtolower(trim($email));
            $stmt = $pdo->prepare('SELECT user_id, player_id FROM access_profiles WHERE email = :email FOR UPDATE');
            $stmt->execute(['email' => $email]);
            $existing = $stmt->fetch();
            if ($action === 'admin_delete_access') {
                if ($email === strtolower($user['email'])) throw new InvalidArgumentException('You cannot remove your own access');
                $pdo->prepare('DELETE FROM access_profiles WHERE email = :email')->execute(['email' => $email]);
            } else {
                $role = $body['p_role'] ?? '';
                $active = $body['p_active'] ?? null;
                $playerId = $body['p_player_id'] ?? ($existing['player_id'] ?? null);
                if (!in_array($role, $roles, true) || !is_bool($active) || !is_string($playerId)) throw new InvalidArgumentException('Select a valid role and player');
                if ($email === strtolower($user['email']) && ($role !== 'super_admin' || !$active)) throw new InvalidArgumentException('You cannot disable or demote your own access');
                $stmt = $pdo->prepare('SELECT name FROM players WHERE id = :id');
                $stmt->execute(['id' => $playerId]);
                $name = $stmt->fetchColumn();
                if ($name === false) throw new InvalidArgumentException('Player not found');
                // Reject player collisions; never update another member through a unique key.
                $check = $pdo->prepare('SELECT email FROM access_profiles WHERE player_id = :id AND email <> :email');
                $check->execute(['id' => $playerId, 'email' => $email]);
                if ($check->fetch()) throw new InvalidArgumentException('Player is already linked to another member');
                if ($existing) {
                    $stmt = $pdo->prepare('UPDATE access_profiles SET display_name = :name, role = :role, active = :active, player_id = :player_id WHERE email = :email');
                } else {
                    $stmt = $pdo->prepare('INSERT INTO access_profiles (email, display_name, role, active, player_id) VALUES (:email, :name, :role, :active, :player_id)');
                }
                $stmt->execute(['email' => $email, 'name' => $name, 'role' => $role, 'active' => (int) $active, 'player_id' => $playerId]);
            }
            if ($existing && $existing['user_id'] && $existing['user_id'] !== $user['id']) {
                $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')->execute(['id' => $existing['user_id']]);
            }
            clubAudit($pdo,$user,$action==='admin_delete_access'?'Member access removed':'Member access saved',['email'=>$email,'role'=>$role??null,'active'=>$active??null,'player_id'=>$playerId??null]);
        }
        $pdo->commit();
        jsonResponse(['ok' => true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(['error' => $e instanceof InvalidArgumentException ? $e->getMessage() : 'Unable to update access'], 400);
    }
}

if (($_GET['action'] ?? '') === 'admin_list_players_for_linking') {
    if ($user['role'] !== 'super_admin') jsonResponse(['error' => 'Permission denied'], 403);
    jsonResponse($pdo->query('SELECT id, name FROM players ORDER BY name')->fetchAll());
}

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

if ($user['role'] === 'super_admin') {
    foreach (clubPermissionNames() as $permission) $permissions[$permission] = true;
}
$permissions['access.manage'] = $user['role'] === 'super_admin';

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

    foreach ($members as &$member) $member['active'] = (bool) $member['active'];
    unset($member);

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
