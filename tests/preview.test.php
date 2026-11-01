<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/auth/preview-lib.php';
class PreviewReply extends RuntimeException {}
function jsonResponse(array $data,int $status=200): never {throw new PreviewReply($data['error']??'', $status);}
class PreviewStatement extends PDOStatement {
    public function __construct(private array|false $row) {}
    public function execute(?array $params=null): bool {return true;}
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $cursorOrientation=PDO::FETCH_ORI_NEXT,int $cursorOffset=0): mixed {return $this->row;}
}
class PreviewPDO extends PDO {
    public int $queries=0;
    public function __construct(public array|false $row=false) {}
    public function prepare(string $sql,array $options=[]): PDOStatement|false {$this->queries++;if(!str_starts_with($sql,'SELECT '))throw new RuntimeException('Preview must not write data');return new PreviewStatement($this->row);}
}
$owner=['id'=>'owner','role'=>'super_admin','email'=>'owner@example.test'];
$pdo=new PreviewPDO();$_SERVER=[];$_GET=[];
if(previewUser($pdo,$owner)!==$owner||$pdo->queries)throw new RuntimeException('Normal owner context changed');
echo "PASS: ordinary owner context is preserved\n";
$_SERVER['HTTP_X_FC_PREVIEW']=previewMemberKey('member@example.test');
foreach (['POST','PUT','PATCH','DELETE','OPTIONS'] as $method) {$_SERVER['REQUEST_METHOD']=$method;try{rejectPreviewMutation();throw new RuntimeException('Preview mutation accepted');}catch(PreviewReply $e){if($e->getCode()!==403)throw $e;}}
echo "PASS: all preview mutations rejected\n";
$_SERVER['REQUEST_METHOD']='GET';
foreach (['google.php','google-callback.php','logout.php'] as $endpoint) {
    $_SERVER['REQUEST_URI']='/api/auth/'.$endpoint;
    try {rejectPreviewMutation();throw new RuntimeException('Preview changed authentication');}catch(PreviewReply $e){if($e->getCode()!==403)throw $e;}
}
unset($_SERVER['REQUEST_URI']);
echo "PASS: preview cannot start authentication or replace the owner session\n";
try {previewUser($pdo,['role'=>'player']);throw new RuntimeException('Non-owner preview accepted');}catch(PreviewReply $e){if($e->getCode()!==403||$pdo->queries)throw $e;}
echo "PASS: non-owner cannot resolve another member\n";
$_SERVER['HTTP_X_FC_PREVIEW']='invalid';
try {previewUser($pdo,$owner);throw new RuntimeException('Invalid key accepted');}catch(PreviewReply $e){if($e->getCode()!==400)throw $e;}
$_SERVER['HTTP_X_FC_PREVIEW']=previewMemberKey('member@example.test');
try {previewUser($pdo,$owner);throw new RuntimeException('Missing member accepted');}catch(PreviewReply $e){if($e->getCode()!==404)throw $e;}
echo "PASS: invalid, missing or disabled preview is rejected\n";
$pdo->row=['email'=>'member@example.test','user_id'=>null,'role'=>'player','player_id'=>'player-id','phone'=>null,'contact_email'=>null,'avatar_path'=>null,'display_name'=>'Invited player','player_name'=>'Invited player'];
$target=previewUser($pdo,$owner);
if($target['role']!=='player'||$target['player_id']!=='player-id'||$target['_preview']['read_only']!==true||!str_starts_with($target['id'],'preview:'))throw new RuntimeException('Wrong member view');
if($owner['id']!=='owner')throw new RuntimeException('Owner identity was replaced');
echo "PASS: invited member can be previewed without creating an account or session\n";
