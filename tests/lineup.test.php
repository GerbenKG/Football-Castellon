<?php
declare(strict_types=1);
require __DIR__.'/../api/lineup-lib.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);echo 'PASS '.$message.PHP_EOL;}
$players=[];for($i=0;$i<17;$i++)$players[]=['id'=>'row'.$i,'player_id'=>'player'.$i,'skill_level'=>1+$i%5];
foreach([2,3] as $count){$draft=clubBalanceTeams($players,$count);$all=array_merge(...$draft['teams']);$sizes=array_map('count',$draft['teams']);check(count($all)===17&&count(array_unique($all))===17&&max($sizes)-min($sizes)<=1,"$count teams include every player once with balanced sizes");foreach($draft['captains'] as $i=>$captain)check(in_array($captain,$draft['teams'][$i],true),'Captain belongs to their own team');}
$equal=[['id'=>'a','player_id'=>'a','skill_level'=>3],['id'=>'b','player_id'=>'b','skill_level'=>3],['id'=>'c','player_id'=>'c','skill_level'=>3],['id'=>'d','player_id'=>'d','skill_level'=>3]];
$draft=clubBalanceTeams($equal,2,['a'=>99,'b'=>99,'c'=>0,'d'=>0]);foreach($draft['teams'] as $i=>$team){$least=min(array_map(fn($id)=>in_array($id,['a','b'])?99:0,$team));check((in_array($draft['captains'][$i],['a','b'])?99:0)===$least,'Captain selection prioritises fewer past turns');}
try{clubBalanceTeams($equal,4);throw new RuntimeException('Unsupported count accepted');}catch(InvalidArgumentException $e){echo 'PASS unsupported team count rejected'.PHP_EOL;}
