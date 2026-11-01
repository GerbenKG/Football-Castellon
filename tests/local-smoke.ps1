$ErrorActionPreference='Stop'
$base='http://localhost:3001'
foreach ($role in @('super_admin','admin','attendance','finance','viewer','player')) {
    $page=Invoke-WebRequest "$base/api/auth/google.php" -NoProxy -SessionVariable localTest
    $token=[regex]::Match($page.Content,'name="token" value="([^"]+)"').Groups[1].Value
    if (!$token) { throw 'Local sign-in form missing' }
    $login=Invoke-WebRequest "$base/api/auth/google.php" -NoProxy -WebSession $localTest -Method Post -Body @{role=$role;token=$token}
    $me=Invoke-RestMethod "$base/api/auth/me.php" -NoProxy -WebSession $localTest
    if (!$me.authenticated -or $me.user.role -ne $role) { throw "Login failed for $role" }
    Write-Output "PASS: local $role sign-in"
    $csrf=Invoke-RestMethod "$base/api/auth/csrf.php" -NoProxy -WebSession $localTest
    $headers=@{'X-CSRF-Token'=$csrf.csrf_token}
    if ($role -eq 'super_admin') {
        $health=Invoke-RestMethod "$base/api/health.php" -NoProxy
        if ($health.database -ne 'connected') { throw 'Database not connected' }
        $query=[uri]::EscapeDataString('[{"column":"id","operator":"eq","value":"00000000-0000-4000-8000-000000000001"}]')
        $players=Invoke-RestMethod "$base/api/data.php?table=players&filters=$query" -NoProxy -WebSession $localTest
        $original=$players.data[0].phone
        foreach ($phone in @('local-test-change',$original)) {
            $body=@{action='update';data=@{phone=$phone};filters=@(@{column='id';operator='eq';value='00000000-0000-4000-8000-000000000001'})} | ConvertTo-Json -Depth 5 -Compress
            $null=Invoke-RestMethod "$base/api/data.php?table=players" -NoProxy -WebSession $localTest -Method Post -ContentType 'application/json' -Headers $headers -Body $body
            $updated=Invoke-RestMethod "$base/api/data.php?table=players&filters=$query" -NoProxy -WebSession $localTest
            if ($updated.data[0].phone -ne $phone) { throw 'Roster write did not persist' }
        }
        Write-Output 'PASS: actual MariaDB roster update and restore'
    }
    if ($role -eq 'finance') {
        $query=[uri]::EscapeDataString('[{"column":"id","operator":"eq","value":"40000000-0000-4000-8000-000000000001"}]')
        $row=Invoke-RestMethod "$base/api/data.php?table=game_players&filters=$query" -NoProxy -WebSession $localTest
        $original=[bool]$row.data[0].paid
        foreach ($paid in @(!$original,$original)) {
            $body=@{action='update';data=@{paid=$paid};filters=@(@{column='id';operator='eq';value='40000000-0000-4000-8000-000000000001'})} | ConvertTo-Json -Depth 5 -Compress
            $null=Invoke-RestMethod "$base/api/data.php?table=game_players" -NoProxy -WebSession $localTest -Method Post -ContentType 'application/json' -Headers $headers -Body $body
            $updated=Invoke-RestMethod "$base/api/data.php?table=game_players&filters=$query" -NoProxy -WebSession $localTest
            if ($updated.data[0].paid -ne $paid) { throw 'Payment write failed' }
        }
        Write-Output 'PASS: finance-only payment update and restore'
    }
    if ($role -in @('attendance','viewer')) {
        $body=@{action='update';data=@{paid=$true};filters=@(@{column='id';operator='eq';value='40000000-0000-4000-8000-000000000001'})} | ConvertTo-Json -Depth 5 -Compress
        $denied=Invoke-WebRequest "$base/api/data.php?table=game_players" -NoProxy -WebSession $localTest -Method Post -ContentType 'application/json' -Headers $headers -Body $body -SkipHttpErrorCheck
        if ([int]$denied.StatusCode -ne 403) { throw 'Unauthorized payment write allowed' }
        Write-Output "PASS: $role cannot change payments"
    }
    if ($role -eq 'player') {
        $games=Invoke-RestMethod "$base/api/auth/player-games.php" -NoProxy -WebSession $localTest
        $game=$games | Where-Object { $_.game_date -ge (Get-Date -Format 'yyyy-MM-dd') } | Select-Object -First 1
        $first=Invoke-RestMethod "$base/api/auth/game-signup.php" -NoProxy -WebSession $localTest -Method Post -ContentType 'application/json' -Headers $headers -Body (@{game_id=$game.id}|ConvertTo-Json)
        if ($first.playing -eq $game.playing) { throw 'Signup did not toggle' }
        $second=Invoke-RestMethod "$base/api/auth/game-signup.php" -NoProxy -WebSession $localTest -Method Post -ContentType 'application/json' -Headers $headers -Body (@{game_id=$game.id}|ConvertTo-Json)
        if ($second.playing -ne $game.playing) { throw 'Signup did not restore' }
        Write-Output 'PASS: member signup and withdrawal'
    }
}
foreach ($private in @('/.local/db-config.php','/.git/HEAD','/dev/login.php','/dev/schema.sql')) {
    $reply=Invoke-WebRequest "$base$private" -NoProxy -SkipHttpErrorCheck
    if ([int]$reply.StatusCode -ne 404) { throw "Private path exposed: $private" }
}
$badHost=Invoke-WebRequest "$base/" -NoProxy -Headers @{Host='example.test'} -SkipHttpErrorCheck
if ([int]$badHost.StatusCode -ne 404) { throw 'Non-local host header accepted' }
Write-Output 'PASS: private files and non-local host headers blocked'
