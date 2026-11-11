<?php
declare(strict_types=1);
require_once __DIR__ . '/auth/session.php';
require_once __DIR__ . '/auth/csrf-lib.php';
require_once __DIR__ . '/query-lib.php';
require_once __DIR__ . '/club-lib.php';
require_once __DIR__ . '/lineup-lib.php';
require_once __DIR__ . '/clubs-lib.php';
$user = requireUser();
$pdo = db();
try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET','POST'], true)) jsonResponse(['error' => 'Method not allowed'], 405);
    if ($method === 'POST') requireCsrfToken();
    ensureClubSchema($pdo);
    if ($method === 'GET') jsonResponse(clubSnapshot($pdo, $user, isset($_GET['finance_season']) ? clubId($_GET['finance_season']) : null));
    $body = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($body)) throw new InvalidArgumentException('Invalid request');
    $action = $body['action'] ?? '';
    $pdo->beginTransaction();
    $result = ['ok' => true];
    switch ($action) {
        case 'game_vote':
            if (!$user['player_id']) throw new DomainException('Your account must be linked to a player profile before you can vote');
            $source = clubText($body['club_name'] ?? null, 160);
            $choice = $body['choice'] ?? '';
            if (!in_array($choice, ['like','dislike'], true)) throw new InvalidArgumentException('Choose like or dislike');
            $sourceKey = strtolower(trim(preg_replace('/\\s+/', ' ', $source)));
            $allowedClubs = ['tottenham hotspur'=>true,'west ham united'=>true];
            foreach ($pdo->query("SELECT payload FROM club_records WHERE kind='favorite_club'")->fetchAll(PDO::FETCH_COLUMN) as $favoritePayload) {
                $favorite = json_decode($favoritePayload, true);
                if (is_array($favorite) && is_string($favorite['club']['name'] ?? null)) $allowedClubs[strtolower($favorite['club']['name'])] = true;
            }
            if (!isset($allowedClubs[$sourceKey])) throw new InvalidArgumentException('This club is not available in the game');
            $playerQuery = $pdo->prepare('SELECT name FROM players WHERE id=? AND archived_at IS NULL');
            $playerQuery->execute([$user['player_id']]);
            $playerName = $playerQuery->fetchColumn();
            if (!is_string($playerName) || $playerName === '') throw new DomainException('Your active player profile could not be found');
            $voteKey = 'game_vote:' . bin2hex(random_bytes(16));
            $effective = $choice === 'dislike'
                ? [['club'=>'West Ham United','choice'=>'dislike']]
                : (strcasecmp($source, 'West Ham United') === 0
                    ? [['club'=>'Tottenham Hotspur','choice'=>'like'],['club'=>'West Ham United','choice'=>'dislike']]
                    : [['club'=>$source,'choice'=>'like']]);
            clubPut($pdo, $voteKey, 'game_vote', ['player_id'=>$user['player_id'],'player_name'=>$playerName,'source_club'=>$source,'choice'=>$choice,'effective_votes'=>$effective,'voted_at'=>gmdate('c')], $user);
            clubAudit($pdo, $user, 'Play a Game vote', ['source_club'=>$source,'choice'=>$choice,'effective_votes'=>$effective]);
            $result['effective_votes'] = $effective;
            $result['message'] = 'Your vote has been counted.';
            break;
        case 'favorite_club':
            $choice=clubChosenFavorite($body['club_id']??null,$user);
            $key='favorite:'.hash('sha256',strtolower($user['email']));
            if($choice===null)clubDelete($pdo,$key);else clubPut($pdo,$key,'favorite_club',['club'=>$choice],$user);
            break;
        case 'bibs_auto':
            clubRequire($user,'attendance.manage');
            $id=clubId($body['game_id']??null);clubLockGame($pdo,$id);
            $result=clubAssignBibs($pdo,$id,null,true);
            if(!$result['unchanged'])clubAudit($pdo,$user,'Bibs duty assigned',['game_id'=>$id,'player_id'=>$result['player_id'],'automatic'=>true]);
            break;
        case 'lineup_draft':
            clubRequire($user,'games.manage');
            $id=clubId($body['game_id']??null);clubLockGame($pdo,$id);
            if(!is_int($body['team_count']??null))throw new InvalidArgumentException('Choose two or three teams');
            $result=clubLineupDraft($pdo,$id,$body['team_count']);
            break;
        case 'squad_add':
        case 'squad_remove':
        case 'squad_guest':
            clubRequire($user,'attendance.manage');
            $id=clubId($body['game_id']??null);$game=clubLockGame($pdo,$id);
            if ($action==='squad_remove') {
                $rowId=clubId($body['id']??null);
                $s=$pdo->prepare('SELECT * FROM game_players WHERE id=? AND game_id=? FOR UPDATE');$s->execute([$rowId,$id]);$row=$s->fetch();
                if (!$row) throw new InvalidArgumentException('Squad member no longer exists');
                  if($row['took_bibs']&&clubDateTime($game)>new DateTimeImmutable('now'))clubAssignBibs($pdo,$id);
                $pdo->prepare('UPDATE game_players SET playing=0 WHERE id=?')->execute([$rowId]);
                if ($row['player_id']) { clubDelete($pdo,'waiting:'.$id.':'.$row['player_id']); clubDelete($pdo,'declined:'.$id.':'.$row['player_id']); }
                clubPromote($pdo,$game,$user);
            } elseif ($action==='squad_add') {
                $pid=clubId($body['player_id']??null);
                if (clubDateTime($game)>new DateTimeImmutable('now')) $result=clubSignup($pdo,array_replace($user,['player_id'=>$pid]),$id,true);
                else {
                    $s=$pdo->prepare('SELECT id FROM players WHERE id=? AND archived_at IS NULL');$s->execute([$pid]);if(!$s->fetchColumn())throw new InvalidArgumentException('Select an active player');
                    $s=$pdo->prepare('SELECT id FROM game_players WHERE game_id=? AND player_id=? FOR UPDATE');$s->execute([$id,$pid]);$existing=$s->fetchColumn();
                    if($existing) {
                        $pdo->prepare('UPDATE game_players SET playing=1 WHERE id=?')->execute([$existing]);
                        clubDelete($pdo,'declined:'.$id.':'.$pid);
                    } else {
                        $pdo->prepare('INSERT INTO game_players (id,game_id,player_id,playing) VALUES (?,?,?,1)')->execute([uuidV4(),$id,$pid]);
                    }
                }
            } else {
                $settings=clubRecord($pdo,'match:'.$id)??[];
                $s=$pdo->prepare('SELECT COUNT(*) FROM game_players WHERE game_id=? AND playing=1');$s->execute([$id]);
                if(clubDateTime($game)>new DateTimeImmutable('now')&&isset($settings['capacity'])&&(int)$s->fetchColumn()>=$settings['capacity'])throw new InvalidArgumentException('The match is full. Increase capacity before adding a guest.');
                $pdo->prepare('INSERT INTO game_players (id,game_id,guest_name,playing) VALUES (?,?,?,1)')->execute([uuidV4(),$id,clubText($body['name']??null,160)]);
            }
            clubAudit($pdo,$user,'Match squad updated',['game_id'=>$id,'change'=>$action]);
            break;
        case 'signup':
            if (!is_bool($body['join'] ?? null)) throw new InvalidArgumentException('Choose join or leave');
            $result = clubSignup($pdo, $user, clubId($body['game_id'] ?? null), $body['join']);
            break;
        case 'announcement':
            clubRequire($user, 'clubhouse.manage');
            $id = 'announcement:' . uuidV4();
            clubPut($pdo, $id, 'announcement', ['title' => clubText($body['title'] ?? null, 100), 'body' => clubText($body['body'] ?? null, 2000), 'author' => $user['display_name'] ?: 'Club board'], $user);
            clubAudit($pdo, $user, 'Announcement published', ['title' => $body['title']]);
            break;
        case 'remove_announcement':
            clubRequire($user, 'clubhouse.manage');
            $id = 'announcement:' . clubId($body['id'] ?? null);
            clubDelete($pdo, $id);
            clubAudit($pdo, $user, 'Announcement removed', ['id' => $id]);
            break;
        case 'match_settings':
        case 'result':
        case 'lineup':
            clubRequire($user, 'games.manage');
            $id = clubId($body['game_id'] ?? null);
            $game = clubLockGame($pdo, $id);
            $data = clubRecord($pdo, 'match:' . $id) ?? ['game_id' => $id];
            if ($action === 'match_settings') {
                $capacity = $body['capacity'] ?? null;
                if ($capacity !== null && (!is_int($capacity) || $capacity < 2 || $capacity > 100)) throw new InvalidArgumentException('Capacity must be between 2 and 100, or empty');
                $data['capacity'] = $capacity;
                $data['notes'] = clubText($body['notes'] ?? '', 1500, false);
            } elseif ($action === 'result') {
                  if(count($data['teams']??[])===3)throw new InvalidArgumentException('A single final score is only available for two-team matches');
                if (clubDateTime($game, true) > new DateTimeImmutable('now')) throw new InvalidArgumentException('Record the result after full time');
                foreach (['score_a','score_b'] as $key) {
                    if (!is_int($body[$key] ?? null) || $body[$key] < 0 || $body[$key] > 99) throw new InvalidArgumentException('Enter a score from 0 to 99');
                    $data[$key] = $body[$key];
                }
                $data['report'] = clubText($body['report'] ?? '', 2000, false);
                $goals = $body['goals'] ?? [];
                if (!is_array($goals) || count($goals) > 100) throw new InvalidArgumentException('Invalid goalscorers');
                $s = $pdo->prepare('SELECT player_id FROM game_players WHERE game_id=? AND playing=1 AND player_id IS NOT NULL');
                $s->execute([$id]); $eligible = $s->fetchAll(PDO::FETCH_COLUMN);
                foreach ($goals as $pid => $count) if (!in_array($pid, $eligible, true) || !is_int($count) || $count < 0 || $count > 99) throw new InvalidArgumentException('Goals must belong to players who played');
                if (array_sum($goals) > $data['score_a'] + $data['score_b']) throw new InvalidArgumentException('Recorded goals exceed the final score');
                $data['goals'] = $goals;
            } else {
                $teams = $body['teams'] ?? null;
                if (!is_array($teams) || !in_array(count($teams),[2,3],true) || !array_is_list($teams)) throw new InvalidArgumentException('Publish two or three teams');
                $s = $pdo->prepare('SELECT id FROM game_players WHERE game_id=? AND playing=1'); $s->execute([$id]);
                $eligible = $s->fetchAll(PDO::FETCH_COLUMN);
                $all = [];
                foreach ($teams as $team) {
                    if (!is_array($team) || !array_is_list($team) || !$team) throw new InvalidArgumentException('Every team needs at least one player');
                    foreach ($team as $pid) { clubId($pid); $all[] = $pid; }
                }
                if (count($all) !== count(array_unique($all)) || array_diff($all, $eligible) || array_diff($eligible, $all) || !$teams[0] || !$teams[1]) throw new InvalidArgumentException('Assign every current participant to exactly one team');
                $data['teams'] = $teams;
                $names=array_slice(['A','B','C'],0,count($teams));
                $captains=$body['captains']??array_fill(0,count($teams),null);
                if(!is_array($captains)||!array_is_list($captains)||count($captains)!==count($teams))throw new InvalidArgumentException('Choose a captain for each team');
                $s=$pdo->prepare('SELECT id,player_id FROM game_players WHERE game_id=? AND playing=1');$s->execute([$id]);$playersById=array_column($s->fetchAll(),null,'id');
                foreach($captains as $i=>$captain)if($captain!==null&&(!is_string($captain)||!in_array($captain,$teams[$i],true)||empty($playersById[$captain]['player_id'])))throw new InvalidArgumentException('Captains must be club players in their own team');
                $pdo->prepare('UPDATE game_players SET team_name=NULL WHERE game_id=?')->execute([$id]);
                $update=$pdo->prepare('UPDATE game_players SET team_name=? WHERE id=? AND game_id=?');
                foreach($teams as $i=>$team)foreach($team as $rowId)$update->execute([$names[$i],$rowId,$id]);
                $pdo->prepare('DELETE FROM team_captain_history WHERE game_id=?')->execute([$id]);
                $saveCaptain=$pdo->prepare('INSERT INTO team_captain_history (id,game_id,team_name,player_id) VALUES (?,?,?,?)');
                foreach($captains as $i=>$captain)if($captain!==null)$saveCaptain->execute([uuidV4(),$id,'Team '.$names[$i],$playersById[$captain]['player_id']]);
                $data['team_names']=$names;$data['captains']=$captains;
            }
            clubPut($pdo, 'match:' . $id, 'match', $data, $user);
            if ($action === 'match_settings') clubPromote($pdo, $game, $user);
            clubAudit($pdo, $user, ['result'=>'Result recorded','lineup'=>'Teams published','match_settings'=>'Match details updated'][$action], ['game_id'=>$id]);
            break;
        case 'delete_fixture':
            clubRequire($user, 'games.manage');
            $id = clubId($body['game_id'] ?? null);
            $game = clubLockGame($pdo, $id);
            if (clubDateTime($game) <= new DateTimeImmutable('now')) throw new InvalidArgumentException('Only upcoming matches can be deleted');
            $paid = $pdo->prepare('SELECT COUNT(*) FROM game_players WHERE game_id=? AND paid=1');
            $paid->execute([$id]);
            $recordedPayments = $pdo->prepare('SELECT COUNT(*) FROM payments WHERE game_id=? AND paid=1');
            $recordedPayments->execute([$id]);
            if ((int)$paid->fetchColumn() > 0 || (int)$recordedPayments->fetchColumn() > 0) throw new InvalidArgumentException('This match has recorded payments. Resolve or refund those payments before deleting the fixture.');
            $playerRows = $pdo->prepare('SELECT id FROM game_players WHERE game_id=?');
            $playerRows->execute([$id]);
            $playerIds = $playerRows->fetchAll(PDO::FETCH_COLUMN);
            foreach ($playerIds as $playerRowId) clubDelete($pdo, 'payment:game:' . $playerRowId);
            $pdo->prepare('DELETE FROM payments WHERE game_id=?')->execute([$id]);
            foreach (['waiting:', 'declined:', 'vote:'] as $prefix) {
                $s = $pdo->prepare('DELETE FROM club_records WHERE record_key LIKE ?');
                $s->execute([$prefix . $id . ':%']);
            }
            clubDelete($pdo, 'match:' . $id);
            $pdo->prepare('DELETE FROM games WHERE id=?')->execute([$id]);
            clubAudit($pdo, $user, 'Upcoming match deleted', ['game_id'=>$id,'date'=>$game['game_date'],'location'=>$game['location']]);
            break;
        case 'fixture':
            clubRequire($user, 'games.manage');
            $id = isset($body['id']) ? clubId($body['id']) : uuidV4();
            $date = $body['date'] ?? '';
            $parsed = is_string($date) ? DateTimeImmutable::createFromFormat('!Y-m-d', $date) : false;
            $start = $body['start'] ?? ''; $end = $body['end'] ?? '';
            if (!$parsed || $parsed->format('Y-m-d') !== $date || !is_string($start) || !is_string($end) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $start) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $end) || $end <= $start) throw new InvalidArgumentException('Enter a valid date and an end time after kick-off');
            $location = clubText($body['location'] ?? null, 255);
            if (isset($body['id'])) {
                clubLockGame($pdo, $id);
                $pdo->prepare('UPDATE games SET game_date=?,start_time=?,end_time=?,location=? WHERE id=?')->execute([$date,$start,$end,$location,$id]);
            } else $pdo->prepare('INSERT INTO games (id,game_date,start_time,end_time,location) VALUES (?,?,?,?,?)')->execute([$id,$date,$start,$end,$location]);
            clubAudit($pdo,$user,'Fixture saved',['game_id'=>$id,'date'=>$date]);
            $result['id'] = $id;
            break;
        case 'vote':
            clubRequire($user, 'games.view');
            $id = clubId($body['game_id'] ?? null);
            $pid = clubId($body['player_id'] ?? null);
            $game = clubLockGame($pdo, $id);
            $data = clubRecord($pdo, 'match:' . $id);
            if (clubDateTime($game, true) > new DateTimeImmutable('now') || !isset($data['score_a'])) throw new InvalidArgumentException('Voting opens after the result is recorded');
            if ($pid === $user['player_id']) throw new InvalidArgumentException('Choose a teammate');
            $s = $pdo->prepare('SELECT player_id FROM game_players WHERE game_id=? AND playing=1 AND player_id IS NOT NULL');
            $s->execute([$id]); $eligible = $s->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array($pid, $eligible, true) || !in_array($user['player_id'], $eligible, true)) throw new DomainException('Only match participants can vote for a teammate who played');
            clubPut($pdo, 'vote:' . $id . ':' . $user['id'], 'vote', ['game_id'=>$id,'player_id'=>$pid], $user);
            break;
        case 'player_birthday':
            if (!$user['player_id']) throw new DomainException('Ask the board to link your player profile');
            $month = $body['month'] ?? null;
            $day = $body['day'] ?? null;
            $hasMonth = $month !== null && $month !== '';
            $hasDay = $day !== null && $day !== '';
            if (!$hasMonth && !$hasDay) { $month = null; $day = null; }
            elseif (!$hasMonth || !$hasDay || !is_int($month) || $month < 1 || $month > 12 || !is_int($day) || !checkdate($month, $day, 2000)) throw new InvalidArgumentException('Choose a valid birthday day and month.');
            $s = $pdo->prepare('UPDATE players SET birthday_month=?,birthday_day=? WHERE id=? AND archived_at IS NULL');
            $s->execute([$month,$day,$user['player_id']]);
            if ($s->rowCount() === 0) { $s=$pdo->prepare('SELECT id FROM players WHERE id=? AND archived_at IS NULL'); $s->execute([$user['player_id']]); if (!$s->fetchColumn()) throw new DomainException('Your active player profile could not be found.'); }
            clubAudit($pdo,$user,'Birthday details updated',['player_id'=>$user['player_id'],'birthday_set'=>$month!==null]);
            break;
        case 'player_card':
            if (!$user['player_id']) throw new DomainException('Ask the board to link your player profile');
            $position = clubText($body['position'] ?? '', 30, false);
            if (!in_array($position, ['', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Anywhere'], true)) throw new InvalidArgumentException('Select a position');
            $number = $body['number'] ?? null;
            if ($number !== null && (!is_int($number) || $number < 1 || $number > 99)) throw new InvalidArgumentException('Shirt number must be from 1 to 99');
            clubPut($pdo, 'player:' . $user['player_id'], 'player_card', ['player_id'=>$user['player_id'],'position'=>$position,'number'=>$number], $user);
            break;
        case 'report_payment':
            $id = clubId($body['id'] ?? null); $type = $body['type'] ?? '';
            $row = clubPaymentRow($pdo, $type, $id);
            if (!$user['player_id'] || $row['player_id'] !== $user['player_id']) throw new DomainException('You can only report your own payments');
            if ($row['paid']) throw new InvalidArgumentException('This payment has already been confirmed');
            clubPut($pdo, 'payment:' . $type . ':' . $id, 'payment_report', ['id'=>$id,'type'=>$type,'player_id'=>$user['player_id'],'status'=>'pending','reported_at'=>gmdate('c')], $user);
            clubAudit($pdo, $user, 'Transfer reported', ['id'=>$id,'type'=>$type]);
            break;
        case 'confirm_payment':
            clubRequire($user, 'payments.manage');
            $id = clubId($body['id'] ?? null); $type = $body['type'] ?? '';
            clubPaymentRow($pdo, $type, $id);
            if ($type === 'game') $pdo->prepare('UPDATE game_players SET paid=1 WHERE id=?')->execute([$id]);
            else $pdo->prepare('UPDATE finance_season_tickets SET paid=1,paid_on=CURDATE() WHERE id=?')->execute([$id]);
            clubDelete($pdo, 'payment:' . $type . ':' . $id);
            clubAudit($pdo, $user, 'Payment confirmed', ['id'=>$id,'type'=>$type]);
            break;
        case 'expense':
            clubRequire($user, 'payments.manage');
            $season = clubId($body['season_id'] ?? null);
            $s = $pdo->prepare('SELECT id FROM finance_seasons WHERE id=?'); $s->execute([$season]);
            if (!$s->fetchColumn()) throw new InvalidArgumentException('Season not found');
            $date = $body['date'] ?? '';
            $parsed = is_string($date) ? DateTimeImmutable::createFromFormat('!Y-m-d', $date) : false;
            if (!$parsed || $parsed->format('Y-m-d') !== $date) throw new InvalidArgumentException('Enter a valid expense date');
            $amount = $body['amount'] ?? null;
            if (!is_numeric($amount) || !is_finite((float)$amount) || (float)$amount <= 0 || (float)$amount > 999999.99) throw new InvalidArgumentException('Enter an amount between 0.01 and 999999.99');
            $description = clubText($body['description'] ?? null, 255);
            $category = clubText($body['category'] ?? 'Other', 100);
            $id = uuidV4();
            $pdo->prepare('INSERT INTO finance_expenses (id,season_id,due_date,description,category,amount,paid) VALUES (?,?,?,?,?,?,0)')->execute([$id,$season,$date,$description,$category,round((float)$amount,2)]);
            clubAudit($pdo,$user,'Expense recorded',['id'=>$id,'description'=>$description,'amount'=>round((float)$amount,2)]);
            break;
        case 'pay_expense':
            clubRequire($user, 'payments.manage');
            $id = clubId($body['id'] ?? null);
            $s = $pdo->prepare('SELECT id FROM finance_expenses WHERE id=? FOR UPDATE'); $s->execute([$id]);
            if (!$s->fetchColumn()) throw new InvalidArgumentException('Expense not found');
            $pdo->prepare('UPDATE finance_expenses SET paid=1,paid_on=CURDATE() WHERE id=?')->execute([$id]);
            clubAudit($pdo,$user,'Expense paid',['id'=>$id]);
            break;
        default: throw new InvalidArgumentException('Unknown club action');
    }
    $pdo->commit();
    jsonResponse($result);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if (!$e instanceof DomainException && !$e instanceof InvalidArgumentException) error_log('Club API: ' . $e->getMessage());
    jsonResponse(['error' => $e instanceof DomainException || $e instanceof InvalidArgumentException ? $e->getMessage() : 'Unable to save club changes. Please refresh and try again.'], $e instanceof DomainException ? 403 : ($e instanceof InvalidArgumentException ? 422 : 500));
}
