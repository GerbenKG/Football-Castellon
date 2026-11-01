<?php
declare(strict_types=1);
require __DIR__.'/../api/arcade-lib.php';
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
$f=['status'=>'final','home_score'=>2,'away_score'=>1];
check(arcadeScore(['home'=>2,'away'=>1],$f)===3,'Exact score must earn three points');
check(arcadeScore(['home'=>1,'away'=>0],$f)===1,'Correct home win must earn one');
check(arcadeScore(['home'=>1,'away'=>2],$f)===0,'Wrong result must earn zero');
check(arcadeScore(['home'=>0,'away'=>0],['status'=>'final','home_score'=>2,'away_score'=>2])===1,'Correct draw must earn one');
check(arcadeScore(['home'=>0,'away'=>3],['status'=>'final','home_score'=>1,'away_score'=>2])===1,'Correct away win must earn one');
check(arcadeScore(['home'=>2,'away'=>1],array_replace($f,['status'=>'void']))===0,'Voided fixtures earn zero');
check(arcadeScore(['home'=>2,'away'=>1],array_replace($f,['status'=>'scheduled']))===0,'Unfinalised fixtures earn zero');
foreach(arcadeQuestions() as $q){check(count($q[1])===4,'Four quiz options');check(isset($q[1][$q[2]]),'Valid correct answer');check(count(array_unique($q[1]))===4,'Unique quiz choices');}
check(arcadeQuizScore([0,1,2,3,4],[0,1,2,0,2])===5,'Quiz scoring uses server answer keys');
echo "PASS exact scores, home/draw/away outcomes, voids, unfinalised matches and quiz scoring\n";
