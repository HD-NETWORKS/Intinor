<#
    .SYNOPSIS
    Installs (or reconfigures) the HD Networks Zixi snapshot agent on a
    Windows server that streams RTMP into Zixi.

    .DESCRIPTION
    Asks for the Zixi Stream ID, a display name, the local RTMP URL to grab
    frames from, the dashboard's base URL and its ZIXI_SNAPSHOT_TOKEN, then:
      - installs ffmpeg via winget if it isn't already on PATH,
      - writes agent\config.json next to this script,
      - registers a scheduled task that runs snapshot-loop.ps1 forever,
        starting at boot and restarting itself if it ever exits.

    Safe to re-run: an existing config.json is loaded and offered back as the
    default for every prompt (press Enter to keep it), so changing the Stream
    ID, channel name, or RTMP URL later is just "run this again", not a
    reinstall. Requires an elevated (Administrator) PowerShell.

    .PARAMETER Uninstall
    Removes the scheduled task and deletes config.json (leaves ffmpeg alone).
#>
param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$TaskName = "HDNetworksZixiSnapshotAgent"
$AgentDir = $PSScriptRoot
$ConfigPath = Join-Path $AgentDir "config.json"
$LoopScript = Join-Path $AgentDir "snapshot-loop.ps1"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Run this from an Administrator PowerShell window (right-click PowerShell > Run as administrator)."
    exit 1
}

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed scheduled task '$TaskName'."
    }
    if (Test-Path $ConfigPath) {
        Remove-Item $ConfigPath -Force
        Write-Host "Removed $ConfigPath."
    }
    Write-Host "Uninstalled. ffmpeg and this folder's scripts were left in place."
    exit 0
}

function Read-WithDefault([string]$Prompt, [string]$Default) {
    $suffix = if ($Default) { " [$Default]" } else { "" }
    $answer = Read-Host "$Prompt$suffix"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    return $answer
}

$existing = $null
if (Test-Path $ConfigPath) {
    $existing = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    Write-Host "Existing configuration found — press Enter on any prompt to keep the current value."
    Write-Host ""
}

# --- Stream ID ---------------------------------------------------------------
$streamIdRe = "^[A-Za-z0-9_-]{1,64}$"
do {
    $streamId = Read-WithDefault "Zixi Stream ID (e.g. HDNK3)" $existing.streamId
    if ($streamId -notmatch $streamIdRe) {
        Write-Host "  Stream ID must be 1-64 letters, digits, '-' or '_'. Try again." -ForegroundColor Yellow
        $streamId = $null
    }
} while (-not $streamId)

# --- Channel / display label --------------------------------------------------
$defaultLabel = if ($existing.channelLabel) { $existing.channelLabel } else { $streamId }
$channelLabel = Read-WithDefault "Channel name to show on the dashboard" $defaultLabel

# --- RTMP source ---------------------------------------------------------------
$defaultRtmp = if ($existing.rtmpUrl) { $existing.rtmpUrl } else { "rtmp://localhost:1935/$streamId" }
$rtmpUrl = Read-WithDefault "RTMP URL to grab frames from (OBS's local output; port 1935 by default)" $defaultRtmp

# --- Dashboard --------------------------------------------------------------
do {
    $dashboardBaseUrl = Read-WithDefault "Dashboard base URL (e.g. https://intinor.example.com)" $existing.dashboardBaseUrl
    if ($dashboardBaseUrl -notmatch "^https?://") {
        Write-Host "  Must start with http:// or https://. Try again." -ForegroundColor Yellow
        $dashboardBaseUrl = $null
    }
} while (-not $dashboardBaseUrl)

# --- Token --------------------------------------------------------------------
$tokenPrompt = "ZIXI_SNAPSHOT_TOKEN (shared secret set on the dashboard's Vercel project)"
if ($existing.zixiSnapshotToken) { $tokenPrompt += " [keep existing — press Enter]" }
$secureToken = Read-Host $tokenPrompt -AsSecureString
$zixiSnapshotToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken))
if ([string]::IsNullOrWhiteSpace($zixiSnapshotToken)) {
    if (-not $existing.zixiSnapshotToken) {
        Write-Error "A ZIXI_SNAPSHOT_TOKEN is required on first install."
        exit 1
    }
    $zixiSnapshotToken = $existing.zixiSnapshotToken
}

# --- Interval -------------------------------------------------------------
$defaultInterval = if ($existing.intervalSeconds) { $existing.intervalSeconds } else { 5 }
do {
    $intervalRaw = Read-WithDefault "Snapshot interval in seconds" $defaultInterval
    $intervalSeconds = 0
    if (-not [int]::TryParse($intervalRaw, [ref]$intervalSeconds) -or $intervalSeconds -lt 1) {
        Write-Host "  Must be a whole number of seconds, at least 1." -ForegroundColor Yellow
        $intervalSeconds = 0
    }
} while ($intervalSeconds -eq 0)

# --- ffmpeg -------------------------------------------------------------------
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "ffmpeg not found on PATH — installing via winget (Gyan.FFmpeg)..."
    winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements
    # winget updates PATH in new sessions; refresh this one from the machine
    # environment variable so the rest of this run can find it too.
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
        Write-Warning "ffmpeg still isn't on PATH after install — you may need to close and reopen this PowerShell window, then re-run this script."
    }
}

# --- Write config ---------------------------------------------------------
$config = [ordered]@{
    streamId          = $streamId
    channelLabel      = $channelLabel
    rtmpUrl           = $rtmpUrl
    dashboardBaseUrl  = $dashboardBaseUrl
    zixiSnapshotToken = $zixiSnapshotToken
    intervalSeconds   = $intervalSeconds
}
$config | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding utf8

# config.json holds a bearer secret in plain text — there's no compiled
# service host here to lean on DPAPI/SYSTEM-scoped encryption, so the
# practical guard is filesystem ACLs: only Administrators and SYSTEM (the
# scheduled task's own run-as account) can read this folder at all.
try {
    # Well-known SIDs (SYSTEM, Administrators) rather than the localized group
    # names, so this also works on non-English Windows installs.
    icacls $AgentDir /inheritance:r | Out-Null
    icacls $AgentDir /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
} catch {
    Write-Warning "Could not lock down permissions on $AgentDir — do it manually if this server is shared."
}

# --- Scheduled task ---------------------------------------------------------
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LoopScript`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings `
    -Description "Pushes a Zixi feed snapshot to the HD Networks dashboard every few seconds. Installed by agent/windows/install.ps1." | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "Done. '$streamId' ($channelLabel) is now pushing snapshots to $dashboardBaseUrl every $intervalSeconds s." -ForegroundColor Green
Write-Host "Logs: $(Join-Path $AgentDir 'agent.log')"
Write-Host "To change any setting later, just re-run this script. To remove entirely: .\install.ps1 -Uninstall"
