<?php
declare(strict_types=1);

function presenceHost(): string
{
    if(isLocalDevelopment())return 'local';
    $host=strtolower(preg_replace('/:\d+$/','',$_SERVER['HTTP_HOST']??''));
    if(!in_array($host,['dev.castellon.futbol','castellon.futbol'],true))throw new RuntimeException('Invalid presence host');
    return $host;
}
function ensurePresenceSchema(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS club_presence (
        host VARCHAR(100) NOT NULL, user_id CHAR(36) NOT NULL, online_key CHAR(32) NOT NULL,
        last_seen_at DATETIME NOT NULL, PRIMARY KEY(host,user_id), KEY idx_presence_seen(last_seen_at),
        CONSTRAINT fk_club_presence_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS club_presence_tabs (
        host VARCHAR(100) NOT NULL, user_id CHAR(36) NOT NULL, client_id CHAR(32) NOT NULL,
        last_seen_at DATETIME NOT NULL, PRIMARY KEY(host,user_id,client_id), KEY idx_presence_tab_seen(last_seen_at),
        CONSTRAINT fk_club_presence_tab_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function presenceMembers(PDO $pdo): array
{
    $s=$pdo->prepare("SELECT cp.user_id AS id,cp.online_key,ap.player_id,
        COALESCE(NULLIF(p.name,''),NULLIF(ap.display_name,''),NULLIF(u.display_name,''),'Club member') AS display_name,
        COALESCE(ap.avatar_path,u.avatar_path) AS avatar_path
        FROM club_presence cp JOIN users u ON u.id=cp.user_id
        JOIN access_profiles ap ON ap.user_id=u.id AND ap.active=1
        LEFT JOIN players p ON p.id=ap.player_id
        WHERE cp.host=? AND EXISTS(SELECT 1 FROM club_presence_tabs pt
            WHERE pt.host=cp.host AND pt.user_id=cp.user_id AND pt.last_seen_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 45 SECOND))
        ORDER BY display_name,cp.user_id");
    $s->execute([presenceHost()]);return $s->fetchAll();
}
function presenceHeartbeat(PDO $pdo,string $userId,string $clientId): array
{
    $host=presenceHost();$pdo->beginTransaction();
    try{
        // Acquire one user lock so simultaneous tabs share a single online spell.
        $pdo->prepare('INSERT INTO club_presence(host,user_id,online_key,last_seen_at) VALUES (?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)')->execute([$host,$userId,bin2hex(random_bytes(16))]);
        $s=$pdo->prepare('SELECT 1 FROM club_presence_tabs WHERE host=? AND user_id=? AND last_seen_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 45 SECOND) LIMIT 1');$s->execute([$host,$userId]);
        if(!$s->fetchColumn())$pdo->prepare('UPDATE club_presence SET online_key=? WHERE host=? AND user_id=?')->execute([bin2hex(random_bytes(16)),$host,$userId]);
        $pdo->prepare('INSERT INTO club_presence_tabs(host,user_id,client_id,last_seen_at) VALUES (?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE last_seen_at=UTC_TIMESTAMP()')->execute([$host,$userId,$clientId]);
        $pdo->prepare('UPDATE club_presence SET last_seen_at=UTC_TIMESTAMP() WHERE host=? AND user_id=?')->execute([$host,$userId]);
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    $pdo->exec('DELETE FROM club_presence_tabs WHERE last_seen_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 MINUTE)');
    $pdo->exec('DELETE FROM club_presence WHERE last_seen_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY)');
    return presenceMembers($pdo);
}
function presenceLeave(PDO $pdo,string $userId,string $clientId): void
{
    $pdo->prepare('DELETE FROM club_presence_tabs WHERE host=? AND user_id=? AND client_id=?')->execute([presenceHost(),$userId,$clientId]);
}
