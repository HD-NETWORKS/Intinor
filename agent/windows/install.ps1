<#
    .SYNOPSIS
    Installs (or reconfigures) the HD Networks Zixi snapshot agent on a
    Windows server that streams RTMP into Zixi.

    .DESCRIPTION
    Asks for the Zixi Stream ID, a display name, the local RTMP URL to grab
    frames from, the dashboard's base URL and its ZIXI_SNAPSHOT_TOKEN, plus
    (optional) a low-bitrate preview relay URL/token for click-to-watch, then:
      - installs ffmpeg via winget if it isn't already on PATH,
      - writes agent\config.json next to this script,
      - registers two scheduled tasks — one running snapshot-loop.ps1, one
        running watch-loop.ps1 — both starting at boot and restarting
        themselves if they ever exit. The watch task runs unconditionally;
        it simply idles doing nothing until a relay URL/token are set.

    Safe to re-run: an existing config.json is loaded and offered back as the
    default for every prompt (press Enter to keep it), so changing the Stream
    ID, channel name, RTMP URL, or relay settings later is just "run this
    again", not a reinstall — both tasks re-read config.json on their own, so
    no task restart is needed either. Requires an elevated (Administrator)
    PowerShell.

    .PARAMETER Uninstall
    Removes both scheduled tasks and deletes config.json (leaves ffmpeg alone).
#>
param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$SnapshotTaskName = "HDNetworksZixiSnapshotAgent"
$WatchTaskName = "HDNetworksZixiWatchAgent"
$AgentDir = $PSScriptRoot
$ConfigPath = Join-Path $AgentDir "config.json"
$SnapshotLoopScript = Join-Path $AgentDir "snapshot-loop.ps1"
$WatchLoopScript = Join-Path $AgentDir "watch-loop.ps1"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Run this from an Administrator PowerShell window (right-click PowerShell > Run as administrator)."
    exit 1
}

if ($Uninstall) {
    foreach ($t in @($SnapshotTaskName, $WatchTaskName)) {
        if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
            Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
            Unregister-ScheduledTask -TaskName $t -Confirm:$false
            Write-Host "Removed scheduled task '$t'."
        }
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

# --- Low-bitrate preview relay (optional — click-to-watch) -------------------
do {
    $defaultRelayUrl = if ($existing.relayBaseUrl) { $existing.relayBaseUrl } else { "" }
    $relayBaseUrl = Read-WithDefault `
        "Low-bitrate preview relay URL (optional, enables click-to-watch — leave blank to skip)" `
        $defaultRelayUrl
    $relayUrlValid = [string]::IsNullOrWhiteSpace($relayBaseUrl) -or $relayBaseUrl -match "^https?://"
    if (-not $relayUrlValid) {
        Write-Host "  Must start with http:// or https://, or be left blank. Try again." -ForegroundColor Yellow
    }
} while (-not $relayUrlValid)

$relayIngestToken = ""
if ($relayBaseUrl) {
    $relayTokenPrompt = "RELAY_INGEST_TOKEN (shared secret for that relay)"
    if ($existing.relayIngestToken) { $relayTokenPrompt += " [keep existing — press Enter]" }
    $secureRelayToken = Read-Host $relayTokenPrompt -AsSecureString
    $relayIngestToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureRelayToken))
    if ([string]::IsNullOrWhiteSpace($relayIngestToken)) {
        if ($existing.relayIngestToken) {
            $relayIngestToken = $existing.relayIngestToken
        } else {
            Write-Warning "No RELAY_INGEST_TOKEN given — click-to-watch stays disabled until you re-run this with one."
            $relayBaseUrl = ""
        }
    }
}

# --- ffmpeg -------------------------------------------------------------------
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "ffmpeg not found on PATH — installing via winget (Gyan.FFmpeg)..."
    # --scope machine: winget defaults to per-user installs, which only land
    # on *your* PATH. The scheduled task below runs as SYSTEM, which never
    # sees a per-user PATH entry — machine scope at least gives future runs
    # a fighting chance, though the real fix is resolving the full path below
    # and never relying on PATH lookup again.
    winget install --id Gyan.FFmpeg -e --scope machine --source winget --accept-package-agreements --accept-source-agreements
    # winget updates PATH in new sessions; refresh this one from the machine
    # environment variable so the rest of this run can find it too.
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
        Write-Warning "ffmpeg still isn't on PATH after install — you may need to close and reopen this PowerShell window, then re-run this script."
    }
}

# Resolve the full path now and bake it into config.json rather than trusting
# "ffmpeg" to resolve on PATH at run time — the scheduled task below runs as
# SYSTEM, a different account whose PATH doesn't include whatever winget just
# added to *this* session's/user's PATH. Without this, the agent looks
# installed and this script looks successful, but the scheduled task fails
# every single run with "the system cannot find the file specified" the
# moment it actually fires as SYSTEM.
$ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
$ffmpegPath = if ($ffmpegCmd) { $ffmpegCmd.Source } else { "ffmpeg" }

# --- Write config ---------------------------------------------------------
$config = [ordered]@{
    streamId          = $streamId
    channelLabel      = $channelLabel
    rtmpUrl           = $rtmpUrl
    dashboardBaseUrl  = $dashboardBaseUrl
    zixiSnapshotToken = $zixiSnapshotToken
    intervalSeconds   = $intervalSeconds
    relayBaseUrl      = $relayBaseUrl
    relayIngestToken  = $relayIngestToken
    ffmpegPath        = $ffmpegPath
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

# --- Scheduled tasks ---------------------------------------------------------
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew

function Register-LoopTask([string]$TaskName, [string]$ScriptPath, [string]$Description) {
    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings -Description $Description | Out-Null
    Start-ScheduledTask -TaskName $TaskName
}

Register-LoopTask $SnapshotTaskName $SnapshotLoopScript `
    "Pushes a Zixi feed snapshot to the HD Networks dashboard every few seconds. Installed by agent/windows/install.ps1."
Register-LoopTask $WatchTaskName $WatchLoopScript `
    "Starts/stops a low-bitrate live encode to the preview relay based on viewer demand. A no-op until a relay URL/token are configured. Installed by agent/windows/install.ps1."

Write-Host ""
Write-Host "Done. '$streamId' ($channelLabel) is now pushing snapshots to $dashboardBaseUrl every $intervalSeconds s." -ForegroundColor Green
if ($relayBaseUrl) {
    Write-Host "Click-to-watch is enabled, relaying through $relayBaseUrl." -ForegroundColor Green
} else {
    Write-Host "Click-to-watch is disabled (no relay URL/token set) — re-run this script to enable it." -ForegroundColor Yellow
}
Write-Host "Logs: $(Join-Path $AgentDir 'agent.log') and $(Join-Path $AgentDir 'watch.log')"
Write-Host "To change any setting later, just re-run this script. To remove entirely: .\install.ps1 -Uninstall"
