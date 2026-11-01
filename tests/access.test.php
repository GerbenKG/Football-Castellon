<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/access-lib.php';
$base = array_fill_keys(clubPermissionNames(), false);
if (validateClubPermissions($base) !== $base) throw new RuntimeException('Readless profile should keep own-account access');
echo "PASS: complete false profile is valid\n";
foreach ([['payments.manage'=>true],['players.manage'=>true,'players.view'=>true],['clubhouse.manage'=>true],['attendance.manage'=>true,'attendance.view'=>true],['access.manage'=>true],['unknown'=>true],['games.view'=>'true']] as $change) {
    try { validateClubPermissions(array_replace($base,$change)); throw new RuntimeException('Invalid access accepted'); }
    catch (InvalidArgumentException $e) { echo "PASS: invalid or elevated profile rejected\n"; }
}
$read = array_replace($base,['payments.view'=>true]);
if (validateClubPermissions($read)['payments.manage']) throw new RuntimeException('Read must not imply edit');
echo "PASS: finance read permission remains read only\n";
