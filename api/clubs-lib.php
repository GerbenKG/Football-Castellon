<?php
declare(strict_types=1);

function clubCountries(): array
{
    return ['Albania','Andorra','Armenia','Austria','Azerbaijan','Belarus','Belgium','Bosnia and Herzegovina','Bulgaria','Croatia','Cyprus','Czech Republic','Denmark','England','Estonia','Faroe Islands','Finland','France','Georgia','Germany','Gibraltar','Greece','Hungary','Iceland','Ireland','Israel','Italy','Kazakhstan','Kosovo','Latvia','Liechtenstein','Lithuania','Luxembourg','Malta','Moldova','Monaco','Montenegro','Netherlands','North Macedonia','Northern Ireland','Norway','Poland','Portugal','Romania','Russia','San Marino','Scotland','Serbia','Slovakia','Slovenia','Spain','Sweden','Switzerland','Turkey','Ukraine','United Kingdom','Wales'];
}
function clubCountry(string $country): string
{
    return ['The Netherlands'=>'Netherlands','Republic of Ireland'=>'Ireland','Czechia'=>'Czech Republic','Macedonia'=>'North Macedonia','Türkiye'=>'Turkey'][$country]??$country;
}
function clubBadgeDirectory(): string
{
    return isLocalDevelopment()?dirname(__DIR__).'/.local/club-badges':dirname(__DIR__,2).'/football-club-badges';
}
function clubBadgeFolder(): string
{
    $dir=clubBadgeDirectory();if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('Club badge storage is unavailable');return $dir;
}
function clubCacheWrite(string $name,array $data): void
{
    $path=clubBadgeFolder().'/'.$name;file_put_contents($path,json_encode($data,JSON_THROW_ON_ERROR),LOCK_EX);chmod($path,0600);
}
function clubCacheRead(string $name): ?array
{
    $path=clubBadgeDirectory().'/'.$name;if(!is_file($path))return null;$data=json_decode((string)file_get_contents($path),true);return is_array($data)?$data:null;
}
function clubFetch(string $url,int $limit): string
{
    if(!function_exists('curl_init'))throw new RuntimeException('Club search is unavailable. You can still add your club and upload its badge.');
    $c=curl_init($url);$body='';
    curl_setopt_array($c,[CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>12,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_USERAGENT=>'FC-Castellon-Club/1.0',CURLOPT_WRITEFUNCTION=>static function($handle,$chunk)use(&$body,$limit){if(strlen($body)+strlen($chunk)>$limit)return 0;$body.=$chunk;return strlen($chunk);}]);
    $ok=curl_exec($c);$status=curl_getinfo($c,CURLINFO_RESPONSE_CODE);curl_close($c);
    if($ok===false||$status!==200)throw new RuntimeException('Club search is temporarily unavailable. Try again later, or add your club with its badge.');return $body;
}
function clubProviderTeam(array $team): ?array
{
    $country=clubCountry((string)($team['strCountry']??''));$id=(string)($team['idTeam']??'');$badge=(string)($team['strBadge']??'');$name=trim((string)($team['strTeam']??''));
    if(($team['strSport']??'')!=='Soccer'||!in_array($country,clubCountries(),true)||!preg_match('/^\d{1,10}$/',$id)||$name===''||strlen($name)>160)return null;
    if(!preg_match('~^https://(?:r2\.|www\.)thesportsdb\.com/images/media/team/badge/[a-zA-Z0-9_-]+\.(?:png|jpg|jpeg|webp)$~D',$badge))return null;
    return ['id'=>'sportsdb-'.$id,'name'=>$name,'country'=>$country,'badge_id'=>substr(hash('sha256','sportsdb:'.$id),0,32),'source'=>'TheSportsDB','image_url'=>$badge];
}
function clubSaveBadge(string $id,string $bytes): void
{
    $info=@getimagesizefromstring($bytes);if(!$info||!in_array($info['mime'],['image/jpeg','image/png','image/webp'],true)||$info[0]>4096||$info[1]>4096)throw new InvalidArgumentException('Use a JPG, PNG or WebP badge up to 4096 × 4096 pixels.');
    $path=clubBadgeFolder().'/'.$id.'.image';file_put_contents($path,$bytes,LOCK_EX);chmod($path,0600);
}
function clubPublicChoice(array $club): array
{
    return array_intersect_key($club,array_flip(['id','name','country','badge_id','source']));
}
function clubSearch(string $query): array
{
    $key='search-'.hash('sha256',strtolower($query)).'.json';$cached=clubCacheRead($key);
    if($cached&&($cached['time']??0)>time()-86400)return $cached['clubs'];
    $data=json_decode(clubFetch('https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t='.rawurlencode($query),2*1024*1024),true,64,JSON_THROW_ON_ERROR);$results=[];
    foreach($data['teams']??[] as $team){$club=clubProviderTeam($team);if(!$club)continue;
        if(!is_file(clubBadgeDirectory().'/'.$club['badge_id'].'.image'))clubSaveBadge($club['badge_id'],clubFetch($club['image_url'].'/small',2*1024*1024));
        clubCacheWrite($club['id'].'.json',clubPublicChoice($club));$results[]=clubPublicChoice($club);
    }
    clubCacheWrite($key,['time'=>time(),'clubs'=>$results]);return $results;
}
function clubChosenFavorite(mixed $id,array $user): ?array
{
    if($id===null)return null;
    if(!is_string($id)||!preg_match('/^(?:sportsdb-\d{1,10}|custom-[a-f0-9]{32})$/D',$id))throw new InvalidArgumentException('Choose a club from the search results or upload its badge.');
    $club=clubCacheRead($id.'.json');if(!$club||!in_array($club['country']??'',clubCountries(),true)||!is_file(clubBadgeDirectory().'/'.($club['badge_id']??'').'.image'))throw new InvalidArgumentException('Search for your club again or upload its badge.');
    if(isset($club['owner'])&&$club['owner']!==$user['id'])throw new DomainException('Choose a club from your own search or upload.');
    return clubPublicChoice($club);
}
