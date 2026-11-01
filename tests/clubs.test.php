<?php
declare(strict_types=1);require __DIR__.'/../api/clubs-lib.php';
function verify(bool $ok,string $name):void{if(!$ok)throw new RuntimeException($name);echo 'PASS '.$name.PHP_EOL;}
$team=['idTeam'=>'133772','strTeam'=>'Ajax','strCountry'=>'The Netherlands','strSport'=>'Soccer','strBadge'=>'https://r2.thesportsdb.com/images/media/team/badge/zg9tii1755495289.png'];
$c=clubProviderTeam($team);verify($c['name']==='Ajax'&&$c['country']==='Netherlands','European club metadata and country aliases');
verify(clubProviderTeam(array_replace($team,['strSport'=>'Basketball']))===null,'Other sports are excluded');
verify(clubProviderTeam(array_replace($team,['strCountry'=>'United States']))===null,'Non-European clubs are excluded');
foreach(['http://127.0.0.1/x.png','https://example.com/logo.png','https://r2.thesportsdb.com/../../secret.png','https://r2.thesportsdb.com/images/media/team/badge/x.svg'] as $url)verify(clubProviderTeam(array_replace($team,['strBadge'=>$url]))===null,'Untrusted badge URL rejected');
verify(!isset(clubPublicChoice($c)['image_url']),'Private provider details stay out of profile data');
