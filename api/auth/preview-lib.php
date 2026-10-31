<?php
declare(strict_types=1);

function previewMemberKey(string $email): string
{
    return hash('sha256', strtolower(trim($email)));
}

function previewRequested(): bool
{
    return isset($_SERVER['HTTP_X_FC_PREVIEW']) || array_key_exists('view_as', $_GET);
}

function rejectPreviewMutation(): void
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    $authenticationChange = preg_match('~/auth/(google|google-callback|logout)\.php$~', $path);
    if (previewRequested() && ($authenticationChange || !in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET','HEAD'], true))) {
        jsonResponse(['error'=>'Member preview is read-only. Exit preview to make changes.'],403);
    }
}

function previewUser(PDO $pdo, array $owner): array
{
    if (!previewRequested()) return $owner;
    if ($owner['role'] !== 'super_admin') jsonResponse(['error'=>'Only a Club owner can view as another member'],403);
    $key = $_SERVER['HTTP_X_FC_PREVIEW'] ?? ($_GET['view_as'] ?? null);
    if (!is_string($key) || !preg_match('/^[a-f0-9]{64}$/', $key)) jsonResponse(['error'=>'Invalid member preview'],400);
    if (isset($_SERVER['HTTP_X_FC_PREVIEW'],$_GET['view_as']) && $_GET['view_as'] !== $key) jsonResponse(['error'=>'Conflicting member preview'],400);
    $s = $pdo->prepare('SELECT ap.email,ap.user_id,ap.role,ap.player_id,ap.phone,ap.contact_email,ap.avatar_path,
        COALESCE(u.display_name,ap.display_name,p.name) AS display_name,p.name AS player_name
        FROM access_profiles ap LEFT JOIN users u ON u.id=ap.user_id LEFT JOIN players p ON p.id=ap.player_id
        WHERE SHA2(LOWER(ap.email),256)=? AND ap.active=1 LIMIT 1');
    $s->execute([$key]);
    $target = $s->fetch();
    if (!$target) jsonResponse(['error'=>'This member is disabled or no longer available'],404);
    $target['id'] = $target['user_id'] ?: 'preview:' . $key;
    $target['active'] = true;
    $target['_preview'] = ['member_key'=>$key,'name'=>$target['player_name'] ?: $target['display_name'] ?: 'Club member','role'=>$target['role'],'read_only'=>true];
    unset($target['user_id'],$target['player_name']);
    return $target;
}
