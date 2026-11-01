<?php
declare(strict_types=1);
require_once __DIR__ . '/access-lib.php';
require_once __DIR__ . '/bibs-lib.php';

// Additive feature storage: existing club tables and records are never reset.
function ensureClubSchema(PDO $pdo): void
{
    ensureClubPagePermissions($pdo);
    if (!$pdo->query("SHOW COLUMNS FROM game_players LIKE 'team_name'")->fetch()) $pdo->exec('ALTER TABLE game_players ADD COLUMN IF NOT EXISTS team_name VARCHAR(80) NULL');
    $pdo->exec("CREATE TABLE IF NOT EXISTS club_records (
        record_key VARCHAR(150) PRIMARY KEY, kind VARCHAR(32) NOT NULL,
        payload LONGTEXT NOT NULL, actor_id CHAR(36) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_club_kind (kind)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS club_audit (
        id CHAR(36) PRIMARY KEY, actor_id CHAR(36) NOT NULL, actor_name VARCHAR(254) NOT NULL,
        action VARCHAR(100) NOT NULL, details LONGTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function clubRecord(PDO $pdo, string $key): ?array
{
    $s = $pdo->prepare('SELECT payload FROM club_records WHERE record_key = ?');
    $s->execute([$key]);
    $v = $s->fetchColumn();
    return $v === false ? null : json_decode($v, true, 64, JSON_THROW_ON_ERROR);
}

function clubPut(PDO $pdo, string $key, string $kind, array $data, array $user): void
{
    $s = $pdo->prepare('INSERT INTO club_records (record_key,kind,payload,actor_id) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload), actor_id=VALUES(actor_id)');
    $s->execute([$key, $kind, json_encode($data, JSON_THROW_ON_ERROR), $user['id']]);
}

function clubDelete(PDO $pdo, string $key): void
{
    $pdo->prepare('DELETE FROM club_records WHERE record_key = ?')->execute([$key]);
}

function clubAudit(PDO $pdo, array $user, string $action, array $data): void
{
    $pdo->prepare('INSERT INTO club_audit (id,actor_id,actor_name,action,details) VALUES (?,?,?,?,?)')
        ->execute([uuidV4(), $user['id'], $user['display_name'] ?: $user['email'], $action, json_encode($data, JSON_THROW_ON_ERROR)]);
}

function clubRequire(array $user, string $permission): void
{
    if (!hasPermission($user['role'], $permission)) throw new DomainException('You do not have permission to do this');
}

function clubId(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^[a-f0-9-]{36}$/i', $value)) throw new InvalidArgumentException('Select a valid record');
    return $value;
}

function clubText(mixed $value, int $max, bool $required = true): string
{
    if (!is_string($value) || strlen(trim($value)) > $max || ($required && trim($value) === '')) throw new InvalidArgumentException('Please complete the text within the stated limit');
    return trim($value);
}

function clubDateTime(array $game, bool $end = false): DateTimeImmutable
{
    return new DateTimeImmutable($game['game_date'] . ' ' . $game[$end ? 'end_time' : 'start_time'], new DateTimeZone('Europe/Madrid'));
}

function clubLockGame(PDO $pdo, string $id): array
{
    $s = $pdo->prepare('SELECT * FROM games WHERE id = ? FOR UPDATE');
    $s->execute([$id]);
    $g = $s->fetch();
    if (!$g) throw new InvalidArgumentException('Match no longer exists');
    return $g;
}

function clubWaiting(PDO $pdo, string $gameId): array
{
    $s = $pdo->prepare("SELECT record_key,payload,created_at FROM club_records WHERE kind='waiting' AND record_key LIKE ? ORDER BY created_at,record_key");
    $s->execute(['waiting:' . $gameId . ':%']);
    return array_map(static fn($r) => ['key' => $r['record_key']] + json_decode($r['payload'], true), $s->fetchAll());
}

function clubPromote(PDO $pdo, array $game, array $user): void
{
    if (clubDateTime($game) <= new DateTimeImmutable('now')) return;
    $settings = clubRecord($pdo, 'match:' . $game['id']) ?? [];
    $capacity = $settings['capacity'] ?? null;
    $count = $pdo->prepare('SELECT COUNT(*) FROM game_players WHERE game_id=? AND playing=1');
    $count->execute([$game['id']]);
    $places = $capacity === null ? PHP_INT_MAX : max(0, $capacity - (int) $count->fetchColumn());
    foreach (clubWaiting($pdo, $game['id']) as $waiting) {
        if ($places <= 0) break;
        $s = $pdo->prepare('SELECT id,playing FROM game_players WHERE game_id=? AND player_id=?');
        $s->execute([$game['id'], $waiting['player_id']]);
        $row = $s->fetch();
        $active = $pdo->prepare('SELECT id FROM players WHERE id=? AND archived_at IS NULL');
        $active->execute([$waiting['player_id']]);
        if (!$active->fetchColumn()) { clubDelete($pdo, $waiting['key']); continue; }
        if ($row) $pdo->prepare('UPDATE game_players SET playing=1 WHERE id=?')->execute([$row['id']]);
        else $pdo->prepare('INSERT INTO game_players (id,game_id,player_id,playing) VALUES (?,?,?,1)')->execute([uuidV4(), $game['id'], $waiting['player_id']]);
        clubDelete($pdo, $waiting['key']);
        if (!$row || !$row['playing']) $places--;
        clubAudit($pdo, $user, 'Waiting player promoted', ['game_id' => $game['id'], 'player_id' => $waiting['player_id']]);
    }
}

// The parent match lock serializes signups, capacity edits and waiting-list promotion.
function clubSignup(PDO $pdo, array $user, string $id, ?bool $join = null): array
{
    clubRequire($user, 'games.view');
    if (!$user['player_id']) throw new DomainException('Your account must be linked to a player first');
    $game = clubLockGame($pdo, $id);
    if (clubDateTime($game) <= new DateTimeImmutable('now')) throw new InvalidArgumentException('Signups close at kick-off');
    $active = $pdo->prepare('SELECT id FROM players WHERE id=? AND archived_at IS NULL');
    $active->execute([$user['player_id']]);
    if (!$active->fetchColumn()) throw new DomainException('This player is archived');
    $s = $pdo->prepare('SELECT id,playing,took_bibs FROM game_players WHERE game_id=? AND player_id=? FOR UPDATE');
    $s->execute([$id, $user['player_id']]);
    $rows = $s->fetchAll();
    if (count($rows) > 1) throw new InvalidArgumentException('Duplicate signup: ask the board to check this match');
    $row = $rows[0] ?? null;
    $key = 'waiting:' . $id . ':' . $user['player_id'];
    $waiting = clubRecord($pdo, $key);
    $join ??= !($row['playing'] ?? false) && !$waiting;
    if (!$join) {
        if($row&&$row['took_bibs'])clubAssignBibs($pdo,$id);
        if ($row) $pdo->prepare('UPDATE game_players SET playing=0 WHERE id=?')->execute([$row['id']]);
        clubDelete($pdo, $key);
        clubPromote($pdo, $game, $user);
        return ['game_id' => $id, 'playing' => false, 'waiting' => false];
    }
    if ($row && $row['playing']) return ['game_id' => $id, 'playing' => true, 'waiting' => false];
    // Honour the existing queue before admitting another player.
    clubPromote($pdo, $game, $user);
    if ($waiting && !clubRecord($pdo, $key)) return ['game_id' => $id, 'playing' => true, 'waiting' => false];
    $settings = clubRecord($pdo, 'match:' . $id) ?? [];
    $count = $pdo->prepare('SELECT COUNT(*) FROM game_players WHERE game_id=? AND playing=1');
    $count->execute([$id]);
    if (isset($settings['capacity']) && (int) $count->fetchColumn() >= $settings['capacity']) {
        clubPut($pdo, $key, 'waiting', ['game_id' => $id, 'player_id' => $user['player_id']], $user);
        return ['game_id' => $id, 'playing' => false, 'waiting' => true];
    }
    clubDelete($pdo, $key);
    if ($row) $pdo->prepare('UPDATE game_players SET playing=1 WHERE id=?')->execute([$row['id']]);
    else $pdo->prepare('INSERT INTO game_players (id,game_id,player_id,playing) VALUES (?,?,?,1)')->execute([uuidV4(), $id, $user['player_id']]);
    return ['game_id' => $id, 'playing' => true, 'waiting' => false];
}

function clubFinance(PDO $pdo, ?string $seasonId = null): array
{
    if ($seasonId) {
        $s=$pdo->prepare('SELECT * FROM finance_seasons WHERE id=?');$s->execute([$seasonId]);$season=$s->fetch();
        if (!$season) throw new InvalidArgumentException('Season no longer exists');
    } else $season = $pdo->query('SELECT * FROM finance_seasons ORDER BY (CURDATE() BETWEEN starts_on AND ends_on) DESC, starts_on DESC LIMIT 1')->fetch();
    if (!$season) return ['season' => null, 'income' => 0, 'expenses_paid' => 0, 'balance' => 0, 'due' => [], 'expenses' => [], 'tickets'=>[], 'game_payments'=>[]];
    $s = $pdo->prepare('SELECT t.*, p.name FROM finance_season_tickets t JOIN players p ON p.id=t.player_id WHERE season_id=?');
    $s->execute([$season['id']]);
    $tickets = normalizeRows($s->fetchAll());
    $ticketPlayers = array_column($tickets, null, 'player_id');
    $due = []; $income = 0.0;
    foreach ($tickets as $t) {
        if ($t['paid']) $income += (float) $t['amount'];
        else $due[] = ['id' => $t['id'], 'type' => 'season', 'name' => $t['name'], 'amount' => (float) $t['amount'], 'date' => $season['starts_on'], 'label' => $season['name'] . ' season ticket'];
    }
    $s = $pdo->prepare('SELECT gp.id,gp.player_id,gp.paid,g.game_date,COALESCE(p.name,gp.guest_name) AS name FROM game_players gp JOIN games g ON g.id=gp.game_id LEFT JOIN players p ON p.id=gp.player_id WHERE gp.playing=1 AND g.game_date BETWEEN ? AND ?');
    $s->execute([$season['starts_on'], $season['ends_on']]);
    $gamePayments=[];
    foreach ($s->fetchAll() as $r) {
        if (isset($ticketPlayers[$r['player_id'] ?? ''])) continue;
        $amount = (float) $season['pay_per_game_amount'];
        $gamePayments[]=['id'=>$r['id'],'type'=>'game','name'=>$r['name'],'player_id'=>$r['player_id'],'amount'=>$amount,'date'=>$r['game_date'],'label'=>'Match fee','paid'=>(bool)$r['paid']];
        if ($r['paid']) $income += $amount;
        elseif ($r['game_date'] <= (new DateTimeImmutable('now', new DateTimeZone('Europe/Madrid')))->format('Y-m-d')) $due[] = ['id' => $r['id'], 'type' => 'game', 'name' => $r['name'], 'amount' => $amount, 'date' => $r['game_date'], 'label' => 'Match fee'];
    }
    $s = $pdo->prepare('SELECT * FROM finance_expenses WHERE season_id=? ORDER BY due_date');
    $s->execute([$season['id']]);
    $expenses = normalizeRows($s->fetchAll());
    $paidExpenses = array_sum(array_map(static fn($e) => $e['paid'] ? (float) $e['amount'] : 0, $expenses));
    return ['season' => $season, 'income' => round($income, 2), 'expenses_paid' => round($paidExpenses, 2), 'balance' => round($income - $paidExpenses, 2), 'due' => $due, 'expenses' => $expenses,'tickets'=>$tickets,'game_payments'=>$gamePayments];
}

function clubPaymentRow(PDO $pdo, string $type, string $id): array
{
    if ($type === 'season') $sql = 'SELECT id,player_id,paid FROM finance_season_tickets WHERE id=? FOR UPDATE';
    elseif ($type === 'game') $sql = 'SELECT gp.id,gp.player_id,gp.paid FROM game_players gp JOIN games g ON g.id=gp.game_id WHERE gp.id=? AND gp.playing=1 AND NOT EXISTS (SELECT 1 FROM finance_season_tickets t JOIN finance_seasons s ON s.id=t.season_id WHERE t.player_id=gp.player_id AND g.game_date BETWEEN s.starts_on AND s.ends_on) FOR UPDATE';
    else throw new InvalidArgumentException('Invalid payment type');
    $s = $pdo->prepare($sql); $s->execute([$id]);
    $row = $s->fetch();
    if (!$row) throw new InvalidArgumentException('Payment no longer applies; refresh the page');
    return $row;
}

function clubSnapshot(PDO $pdo, array $user, ?string $financeSeason = null): array
{
    $permissions = [];
    foreach (clubPermissionNames() as $p) $permissions[$p] = hasPermission($user['role'], $p);
    $permissions['access.manage'] = $user['role'] === 'super_admin';
    // Deliberately exclude contacts, skills, payment flags and access records from the shared squad.
    $players = $pdo->query('SELECT p.id,p.name,p.archived_at,p.bibs_taken_count,COALESCE(ap.avatar_path,u.avatar_path) AS avatar_path FROM players p LEFT JOIN access_profiles ap ON ap.player_id=p.id AND ap.active=1 LEFT JOIN users u ON u.id=ap.user_id ORDER BY p.name')->fetchAll();
    foreach($players as &$p)$p['bibs_taken_count']=(int)$p['bibs_taken_count'];unset($p);
    $games = $pdo->query('SELECT id,game_date,start_time,end_time,location FROM games ORDER BY game_date,start_time')->fetchAll();
    $rows = normalizeRows($pdo->query('SELECT id,game_id,player_id,guest_name,took_bibs FROM game_players WHERE playing=1')->fetchAll());
    $records = $pdo->query('SELECT record_key,kind,payload,created_at,updated_at FROM club_records ORDER BY created_at DESC')->fetchAll();
    $announcements = []; $matches = []; $votes = []; $waiting = []; $reports = []; $myVotes = []; $cards = [];
    foreach ($records as $record) {
        $v = json_decode($record['payload'], true, 64, JSON_THROW_ON_ERROR);
        if ($record['kind'] === 'announcement') $announcements[] = $v + ['id' => $record['record_key'], 'created_at' => $record['created_at']];
        if ($record['kind'] === 'match') $matches[$v['game_id']] = $v;
        if ($record['kind'] === 'player_card') $cards[$v['player_id']] = $v;
        if ($record['kind'] === 'vote') {
            $gid = $v['game_id']; $pid = $v['player_id'];
            $votes[$gid][$pid] = ($votes[$gid][$pid] ?? 0) + 1;
            if ($record['record_key'] === 'vote:' . $gid . ':' . $user['id']) $myVotes[$gid] = $pid;
        }
        if ($record['kind'] === 'waiting') $waiting[] = ['game_id' => $v['game_id'], 'player_id' => $v['player_id'], 'joined_at' => $record['created_at']];
        if ($record['kind'] === 'payment_report' && ($permissions['payments.view'] || ($v['player_id'] ?? null) === $user['player_id'])) $reports[] = $v + ['key' => $record['record_key']];
    }
    // Recover saved membership from the original match-player records, never infer old teams.
    $knownLineupRows=[];foreach($matches as $match)foreach($match['teams']??[] as $team)foreach($team as $rowId)$knownLineupRows[$rowId]=true;
    $lineupPlayers=array_values(array_filter($pdo->query('SELECT id,game_id,player_id,guest_name,team_name FROM game_players')->fetchAll(),static fn($r)=>$r['team_name']!==null||isset($knownLineupRows[$r['id']])));
    $savedTeams=[];
    foreach($lineupPlayers as $r)if($r['team_name']!==null)$savedTeams[$r['game_id']][$r['team_name']][]=$r['id'];
    foreach($savedTeams as $gid=>$groups){
        $order=$matches[$gid]['team_names']??array_keys($groups);$order=array_values(array_unique(array_merge($order,array_keys($groups))));
        $order=array_values(array_filter($order,static fn($name)=>isset($groups[$name])));
        $matches[$gid]=array_replace($matches[$gid]??['game_id'=>$gid],['team_names'=>$order,'teams'=>array_map(static fn($name)=>$groups[$name],$order)]);
    }
    $captainHistory=$pdo->query('SELECT game_id,team_name,player_id FROM team_captain_history ORDER BY team_name')->fetchAll();
    foreach($captainHistory as $captain)$matches[$captain['game_id']]['recorded_captains'][]=$captain;
    $seasons = $pdo->query('SELECT id,name,starts_on,ends_on FROM finance_seasons ORDER BY starts_on DESC')->fetchAll();
    $myTickets = [];
    if ($user['player_id']) {
        $s = $pdo->prepare('SELECT season_id,paid FROM finance_season_tickets WHERE player_id=?');
        $s->execute([$user['player_id']]); $myTickets = normalizeRows($s->fetchAll());
    }
    $publicUser = array_intersect_key($user, array_flip(['id','email','display_name','role','player_id','avatar_path','phone','contact_email']));
    $memberAccounts=[];
    if($user['role']==='super_admin')foreach($pdo->query('SELECT email,display_name,role,active,player_id FROM access_profiles ORDER BY display_name')->fetchAll() as $member){$member['active']=(bool)$member['active'];$member['preview_key']=previewMemberKey($member['email']);$memberAccounts[]=$member;}
    return ['user' => $publicUser, 'preview' => $user['_preview'] ?? null, 'permissions' => $permissions, 'players' => $players, 'games' => $games, 'signups' => $rows,
        'seasons' => $seasons, 'my_tickets' => $myTickets, 'announcements' => $permissions['clubhouse.view'] ? array_slice($announcements, 0, 30) : [], 'matches' => (object) $matches,
        'votes' => (object) $votes, 'my_votes' => (object) $myVotes, 'player_cards' => (object) $cards, 'waiting' => $waiting, 'payment_reports' => $reports, 'lineup_players'=>$lineupPlayers,
        'bibs_assignments'=>$pdo->query('SELECT id,game_id,player_id FROM game_players WHERE took_bibs=1 AND player_id IS NOT NULL')->fetchAll(),
        'finance' => $permissions['payments.view'] ? clubFinance($pdo,$financeSeason) : null,
        'player_records' => $permissions['players.view'] ? $pdo->query('SELECT id,name,phone,email,archived_at,skill_level FROM players ORDER BY name')->fetchAll() : [],
        'member_accounts' => $memberAccounts,
        'audit' => $permissions['payments.view'] ? $pdo->query('SELECT actor_name,action,details,created_at FROM club_audit ORDER BY created_at DESC,id DESC LIMIT 30')->fetchAll() : [],
        'server_date' => (new DateTimeImmutable('now', new DateTimeZone('Europe/Madrid')))->format('Y-m-d'), 'updated_at' => gmdate('c')];
}
