<?php
declare(strict_types=1);

// Caller owns the transaction and locks the parent game before entering this function.
function clubAssignBibs(PDO $pdo,string $gameId,?string $rowId=null,bool $automatic=false): array
{
    $s=$pdo->prepare('SELECT id,player_id,playing,took_bibs FROM game_players WHERE game_id=? ORDER BY id FOR UPDATE');$s->execute([$gameId]);$rows=$s->fetchAll();
    $ids=array_values(array_unique(array_filter(array_column($rows,'player_id'))));sort($ids);$counts=[];$players=[];
    if($ids){$s=$pdo->prepare('SELECT id,name,archived_at,bibs_taken_count FROM players WHERE id IN ('.implode(',',array_fill(0,count($ids),'?')).') ORDER BY id FOR UPDATE');$s->execute($ids);$players=array_column($s->fetchAll(),null,'id');foreach($players as $pid=>$p)$counts[$pid]=(int)$p['bibs_taken_count'];}
    foreach($rows as &$r){$p=$players[$r['player_id']]??[];$r['name']=$p['name']??null;$r['archived_at']=$p['archived_at']??null;}unset($r);
    $eligible=array_values(array_filter($rows,static fn($r)=>$r['playing']&&$r['player_id']&&$r['name']!==null&&$r['archived_at']===null));
    $old=array_values(array_filter($rows,static fn($r)=>$r['took_bibs']&&$r['player_id']));
    if($automatic){
        if(!$eligible)throw new InvalidArgumentException('Sign up at least one active club player before assigning the bibs. Guests are not eligible.');
        $effective=$counts;foreach($old as $r)$effective[$r['player_id']]=max(0,($effective[$r['player_id']]??0)-1);
        $lowest=min(array_map(static fn($r)=>$effective[$r['player_id']]??0,$eligible));
        if(count($old)===1&&in_array($old[0]['id'],array_column($eligible,'id'),true)&&($effective[$old[0]['player_id']]??0)===$lowest)return ['id'=>$old[0]['id'],'player_id'=>$old[0]['player_id'],'name'=>$old[0]['name'],'unchanged'=>true];
        $candidates=array_values(array_filter($eligible,static fn($r)=>($effective[$r['player_id']]??0)===$lowest));
        $rowId=$candidates[random_int(0,count($candidates)-1)]['id'];
    }
    $selected=null;
    if($rowId!==null){foreach($eligible as $r)if($r['id']===$rowId)$selected=$r;if(!$selected)throw new InvalidArgumentException('Choose an active club player who is playing in this match.');}
    if(count($old)===1&&$selected&&$old[0]['id']===$selected['id'])return ['id'=>$selected['id'],'player_id'=>$selected['player_id'],'name'=>$selected['name'],'unchanged'=>true];
    $pdo->prepare('UPDATE game_players SET took_bibs=0 WHERE game_id=?')->execute([$gameId]);
    if($selected)$pdo->prepare('UPDATE game_players SET took_bibs=1 WHERE id=? AND game_id=?')->execute([$selected['id'],$gameId]);
    $changes=[];foreach($old as $r)$changes[$r['player_id']]=($changes[$r['player_id']]??0)-1;
    if($selected)$changes[$selected['player_id']]=($changes[$selected['player_id']]??0)+1;
    // Use the locked baseline: existing database triggers must not double-count a turn.
    $update=$pdo->prepare('UPDATE players SET bibs_taken_count=? WHERE id=?');
    foreach($changes as $pid=>$delta)$update->execute([max(0,($counts[$pid]??0)+$delta),$pid]);
    return ['id'=>$selected['id']??null,'player_id'=>$selected['player_id']??null,'name'=>$selected['name']??null,'unchanged'=>false];
}
