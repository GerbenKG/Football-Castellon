<?php
declare(strict_types=1);

// Ratings stay on the server. Randomise equal ratings, then balance size and strength.
function clubBalanceTeams(array $players, int $count, array $captainCounts = []): array
{
    if (!in_array($count, [2,3], true) || count($players) < $count) throw new InvalidArgumentException('Choose two or three teams with at least one player per team');
    shuffle($players);
    usort($players, static fn($a,$b) => (float)($b['skill_level'] ?? 3) <=> (float)($a['skill_level'] ?? 3));
    $teams=array_fill(0,$count,[]);$totals=array_fill(0,$count,0);
    foreach($players as $player){
        $sizes=array_map('count',$teams);$smallest=min($sizes);$candidates=array_keys(array_filter($sizes,static fn($size)=>$size===$smallest));
        usort($candidates,static fn($a,$b)=>$totals[$a]<=>$totals[$b]);$i=$candidates[0];
        $teams[$i][]=$player['id'];$totals[$i]+=(float)($player['skill_level']??3);
    }
    $byId=array_column($players,null,'id');$captains=[];
    foreach($teams as $team){
        $eligible=array_values(array_filter($team,static fn($id)=>!empty($byId[$id]['player_id'])));
        shuffle($eligible);usort($eligible,static fn($a,$b)=>($captainCounts[$byId[$a]['player_id']]??0)<=>($captainCounts[$byId[$b]['player_id']]??0));
        $captains[]=$eligible[0]??null;
    }
    return ['teams'=>$teams,'captains'=>$captains,'team_names'=>array_slice(['Green','Gold','Blue'],0,$count)];
}

function clubLineupDraft(PDO $pdo,string $gameId,int $count): array
{
    $s=$pdo->prepare('SELECT gp.id,gp.player_id,COALESCE(p.skill_level,3) AS skill_level FROM game_players gp LEFT JOIN players p ON p.id=gp.player_id WHERE gp.game_id=? AND gp.playing=1');$s->execute([$gameId]);
    $players=$s->fetchAll();
    $s=$pdo->prepare('SELECT player_id,COUNT(*) AS total FROM team_captain_history WHERE game_id<>? GROUP BY player_id');$s->execute([$gameId]);
    return clubBalanceTeams($players,$count,array_column($s->fetchAll(),'total','player_id'));
}
