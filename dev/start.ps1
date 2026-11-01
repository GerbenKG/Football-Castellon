param(
    [string]$PhpPath = '',
    [string]$DatabaseBin = 'C:\xampp\mysql\bin'
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $project '.local'
$databasePort = 33079
$webPort = 3001
function Test-LocalPort([int]$Port) {
    $client = New-Object Net.Sockets.TcpClient
    try { $client.Connect('127.0.0.1', $Port); return $true }
    catch { return $false }
    finally { $client.Dispose() }
}
if (Test-LocalPort $webPort) { throw 'Port 3001 is already in use. If the local app is running, open http://localhost:3001/ or run dev/stop.ps1 first.' }
if (Test-LocalPort $databasePort) { throw 'Port 33079 is already in use. Run dev/stop.ps1 if an earlier local test is running.' }
if (!$PhpPath) { $PhpPath = (Get-Command php -ErrorAction Stop).Source }
$initializer = Join-Path $DatabaseBin 'mysql_install_db.exe'
$server = Join-Path $DatabaseBin 'mysqld.exe'
if (!(Test-Path -LiteralPath $initializer) -or !(Test-Path -LiteralPath $server)) { throw 'MariaDB tools were not found. Pass -DatabaseBin with the folder containing mysql_install_db.exe and mysqld.exe.' }
$phpOptions = @()
& $PhpPath -r "exit(extension_loaded('pdo_mysql') ? 0 : 1);"
if ($LASTEXITCODE -ne 0) { $phpOptions = @('-d', 'extension=pdo_mysql') }
& $PhpPath @phpOptions -r "exit(extension_loaded('pdo_mysql') ? 0 : 1);"
if ($LASTEXITCODE -ne 0) { throw 'This PHP installation needs the pdo_mysql extension.' }
& $PhpPath -r "exit(extension_loaded('fileinfo') ? 0 : 1);"
if ($LASTEXITCODE -ne 0) { $phpOptions += @('-d', 'extension=fileinfo') }
& $PhpPath @phpOptions -r "exit(extension_loaded('fileinfo') ? 0 : 1);"
if ($LASTEXITCODE -ne 0) { throw 'This PHP installation needs the fileinfo extension for profile pictures.' }
& $PhpPath -r "exit(extension_loaded('curl') ? 0 : 1);"
if ($LASTEXITCODE -ne 0) { $phpOptions += @('-d', 'extension=curl') }
& $PhpPath @phpOptions -r "exit(extension_loaded('curl') ? 0 : 1);"
if ($LASTEXITCODE -ne 0) { throw 'This PHP installation needs the curl extension for football club search.' }
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$passwordFile = Join-Path $runtime 'database-password.txt'
if (!(Test-Path -LiteralPath $passwordFile)) {
    [IO.File]::WriteAllText($passwordFile, [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N'))
}
$password = [IO.File]::ReadAllText($passwordFile).Trim()
if ($password -notmatch '^[a-f0-9]{64}$') { throw 'Invalid local password file; restore your .local folder backup.' }
$databaseDir = Join-Path $runtime 'mariadb'
if (!(Test-Path -LiteralPath (Join-Path $databaseDir 'mysql'))) {
    Write-Output 'Creating your private local sample database...'
    & $initializer "--datadir=$databaseDir" "--password=$password" "--port=$databasePort" --silent
    if ($LASTEXITCODE -ne 0) { throw 'Local database initialization failed.' }
}
$configPath = Join-Path $runtime 'db-config.php'
$config = "<?php return ['host'=>'127.0.0.1','port'=>33079,'database'=>'football_castellon_dev','username'=>'root','password'=>'$password'];"
[IO.File]::WriteAllText($configPath, $config, (New-Object Text.UTF8Encoding($false)))
$databaseProcess = $null
$phpProcess = $null
try {
    $baseDir = Split-Path -Parent $DatabaseBin
    $dbArguments = @('--no-defaults', "--basedir=`"$baseDir`"", "--datadir=`"$databaseDir`"", "--port=$databasePort", '--bind-address=127.0.0.1', '--skip-name-resolve', '--innodb-buffer-pool-size=64M', '--console')
    $databaseProcess = Start-Process -FilePath $server -ArgumentList $dbArguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'database.stdout.log') -RedirectStandardError (Join-Path $runtime 'database.stderr.log')
    for ($attempt=0; $attempt -lt 40; $attempt++) {
        if ($databaseProcess.HasExited) { throw 'Local MariaDB stopped. Check .local/database.stderr.log.' }
        if (Test-LocalPort $databasePort) { break }
        Start-Sleep -Milliseconds 250
    }
    if (!(Test-LocalPort $databasePort)) { throw 'Local MariaDB did not become ready.' }
    & $PhpPath @phpOptions (Join-Path $PSScriptRoot 'setup.php') $configPath
    if ($LASTEXITCODE -ne 0) { throw 'Sample database setup failed.' }
    $oldDev = $env:FOOTBALL_LOCAL_DEV
    $env:FOOTBALL_LOCAL_DEV = '1'
    try {
        $arguments = @($phpOptions) + @('-S', '127.0.0.1:3001', '-t', "`"$project`"", "`"$(Join-Path $PSScriptRoot 'router.php')`"")
        $phpProcess = Start-Process -FilePath $PhpPath -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'php.stdout.log') -RedirectStandardError (Join-Path $runtime 'php.stderr.log')
    } finally { $env:FOOTBALL_LOCAL_DEV = $oldDev }
    for ($attempt=0; $attempt -lt 40; $attempt++) {
        if ($phpProcess.HasExited) { throw 'Local PHP stopped. Check .local/php.stderr.log.' }
        if (Test-LocalPort $webPort) { break }
        Start-Sleep -Milliseconds 250
    }
    if (!(Test-LocalPort $webPort)) { throw 'Local PHP did not become ready.' }
    $processes = @($databaseProcess, $phpProcess) | ForEach-Object { @{ id=$_.Id; path=$_.Path; started=$_.StartTime.ToUniversalTime().Ticks.ToString() } }
    [IO.File]::WriteAllText((Join-Path $runtime 'processes.json'), (ConvertTo-Json -InputObject @($processes)), (New-Object Text.UTF8Encoding($false)))
    Write-Output 'Ready: http://localhost:3001/'
    Write-Output 'Click Continue with Google to choose a LOCAL test role. No Google or Cloud86 access is used.'
    Write-Output 'Sample changes are kept between starts. Stop with: .\dev\stop.ps1'
} catch {
    if ($phpProcess -and !$phpProcess.HasExited) { $phpProcess.Kill() }
    if ($databaseProcess -and !$databaseProcess.HasExited) { $databaseProcess.Kill() }
    throw
}
