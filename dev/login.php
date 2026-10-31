<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/api/auth/session.php';
if (!isLocalDevelopment()) { http_response_code(404); exit; }
session_name('fc_local_login');
session_start(['cookie_httponly' => true, 'cookie_samesite' => 'Strict', 'cookie_secure' => false]);
$_SESSION['form_token'] ??= bin2hex(random_bytes(32));
$roles = ['super_admin' => 'Super Admin', 'admin' => 'Admin', 'attendance' => 'Attendance', 'finance' => 'Finance', 'viewer' => 'Viewer', 'player' => 'Player'];
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $role = $_POST['role'] ?? '';
    $token = $_POST['token'] ?? '';
    if (!is_string($role) || !isset($roles[$role]) || !is_string($token) || !hash_equals($_SESSION['form_token'], $token)) {
        http_response_code(403); exit('Invalid local test login');
    }
    $stmt = db()->prepare('SELECT id FROM users WHERE email = :email');
    $stmt->execute(['email' => 'local-' . $role . '@example.test']);
    $id = $stmt->fetchColumn();
    if (!$id) throw new RuntimeException('Run the local database setup first');
    destroyApplicationSession();
    setApplicationSession($id);
    session_regenerate_id(true);
    unset($_SESSION['form_token']);
    header('Location: /', true, 303);
    exit;
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Football — Local test sign-in</title>
<body style="font:16px system-ui;background:#f3f6f5;color:#14362b;padding:40px">
<main style="max-width:480px;margin:40px auto;background:white;padding:32px;border-radius:16px">
<h1>Local test sign-in</h1>
<p>This uses sample accounts in your private local database. It does not sign in to Google or connect to Cloud86.</p>
<form method="post">
<input type="hidden" name="token" value="<?= htmlspecialchars($_SESSION['form_token'], ENT_QUOTES, 'UTF-8') ?>">
<label>Test role <select name="role" style="display:block;width:100%;padding:12px;margin:12px 0">
<?php foreach ($roles as $key => $label): ?><option value="<?= $key ?>"><?= $label ?></option><?php endforeach ?>
</select></label>
<button style="padding:12px 20px;background:#10744b;color:white;border:0;border-radius:8px">Enter test app</button>
</form></main></body></html>
