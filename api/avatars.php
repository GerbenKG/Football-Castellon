<?php
declare(strict_types=1);
require_once __DIR__ . '/auth/session.php';
require_once __DIR__ . '/auth/csrf-lib.php';
$user = requireUser();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = $method === 'POST' ? ($_POST['path'] ?? '') : ($_GET['path'] ?? '');
if (!is_string($path) || !preg_match('~^[a-f0-9-]{36}/avatar\.(jpg|jpeg|png|webp)$~i', $path)) jsonResponse(['error' => 'Invalid avatar path'], 400);
$directory = dirname(__DIR__, 2) . '/football-avatars';
$target = $directory . '/' . $path;
if ($method === 'GET') {
    $stmt = db()->prepare('SELECT email FROM access_profiles WHERE avatar_path = :path AND active = TRUE LIMIT 1');
    $stmt->execute(['path' => $path]);
    if (!$stmt->fetch() || !is_file($target)) jsonResponse(['error' => 'Avatar not found'], 404);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($target);
    if (!in_array($mime, ['image/jpeg','image/png','image/webp'], true)) jsonResponse(['error' => 'Invalid avatar'], 404);
    header('Content-Type: ' . $mime);
    header('Cache-Control: private, max-age=300');
    header('X-Content-Type-Options: nosniff');
    readfile($target);
    exit;
}
if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
requireCsrfToken();
if (explode('/', $path)[0] !== $user['id']) jsonResponse(['error' => 'Permission denied'], 403);
$file = $_FILES['avatar'] ?? null;
if (!$file || $file['error'] !== UPLOAD_ERR_OK || $file['size'] > 5 * 1024 * 1024 || !is_uploaded_file($file['tmp_name'])) jsonResponse(['error' => 'Upload a picture smaller than 5 MB'], 400);
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
$extensions = ['image/jpeg' => ['jpg','jpeg'], 'image/png' => ['png'], 'image/webp' => ['webp']];
if (!isset($extensions[$mime]) || !in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), $extensions[$mime], true) || !getimagesize($file['tmp_name'])) jsonResponse(['error' => 'Use a JPG, PNG or WebP picture'], 400);
$folder = dirname($target);
if (!is_dir($folder) && !mkdir($folder, 0700, true)) jsonResponse(['error' => 'Avatar storage is unavailable'], 500);
if (!move_uploaded_file($file['tmp_name'], $target)) jsonResponse(['error' => 'Unable to save picture'], 500);
chmod($target, 0600);
jsonResponse(['path' => $path]);
