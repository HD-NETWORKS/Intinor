<#
    Shared helpers, dot-sourced by both snapshot-loop.ps1 and watch-loop.ps1.
    Not meant to be run directly.
#>

$TempDir = if ($env:TEMP) { $env:TEMP } else { [System.IO.Path]::GetTempPath() }

function Write-AgentLog([string]$LogName, [string]$Message) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    $logPath = Join-Path $PSScriptRoot $LogName
    Add-Content -Path $logPath -Value $line
    # Keep the log from growing forever; a few MB of history is plenty.
    if ((Test-Path $logPath) -and (Get-Item $logPath).Length -gt 5MB) {
        $tail = Get-Content $logPath -Tail 2000
        Set-Content -Path $logPath -Value $tail
    }
}
