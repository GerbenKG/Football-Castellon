$ErrorActionPreference = 'Stop'
$runtime = Join-Path (Split-Path -Parent $PSScriptRoot) '.local'
$recordPath = Join-Path $runtime 'processes.json'
if (!(Test-Path -LiteralPath $recordPath)) { Write-Output 'No local test processes recorded.'; return }
$records = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
foreach ($record in @($records) | Select-Object -Last 1) {
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if ($process -and $process.Path -eq $record.path -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $record.started) {
        Stop-Process -Id $process.Id
    }
}
foreach ($record in @($records) | Select-Object -First 1) {
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if ($process -and $process.Path -eq $record.path -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $record.started) {
        # mysqladmin shutdown allows the private database to flush its files.
        $admin = Join-Path (Split-Path -Parent $process.Path) 'mysqladmin.exe'
        $config = Join-Path $runtime 'shutdown.cnf'
        $password = [IO.File]::ReadAllText((Join-Path $runtime 'database-password.txt')).Trim()
        [IO.File]::WriteAllText($config, "[client]`nuser=root`npassword=$password`nhost=127.0.0.1`nport=33079`n")
        & $admin "--defaults-file=$config" shutdown
        if ($LASTEXITCODE -ne 0) { throw 'Could not gracefully stop the private database.' }
    }
}
Write-Output 'Local test app stopped. Sample data is preserved.'
