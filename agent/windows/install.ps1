<#
    .SYNOPSIS
    Installs (or reconfigures) the HD Networks Zixi snapshot agent on a
    Windows server that streams RTMP into Zixi.

    .DESCRIPTION
    Asks for the Zixi Stream ID, a display name, the local RTMP URL to grab
    frames from, the dashboard's base URL and its ZIXI_SNAPSHOT_TOKEN, plus
    (optional) a low-bitrate preview relay URL/token for click-to-watch, and
    (optional) a local MediaMTX relay for ingest-only RTMP targets like a
    Zixi Feeder that won't re-serve their stream for playback, then:
      - installs ffmpeg via winget if it isn't already on PATH,
      - installs MediaMTX if the local relay option was chosen, configured
        to answer on the RTMP URL above and forward on to the real target,
      - writes agent\config.json next to this script,
      - registers scheduled tasks — one running snapshot-loop.ps1, one
        running watch-loop.ps1, and (if enabled) one running the MediaMTX
        relay — all starting at boot and restarting themselves if they ever
        exit. The watch task runs unconditionally; it simply idles doing
        nothing until a relay URL/token are set.

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
$MediaMtxTaskName = "HDNetworksMediaMTXRelay"
$AgentDir = $PSScriptRoot
$ConfigPath = Join-Path $AgentDir "config.json"
$SnapshotLoopScript = Join-Path $AgentDir "snapshot-loop.ps1"
$WatchLoopScript = Join-Path $AgentDir "watch-loop.ps1"
# Pinned rather than "latest" so this script's behavior doesn't change out
# from under a re-run months later. Bump deliberately, verifying the
# Windows amd64 zip asset still exists at the new version's download URL
# first (mediamtx_v<ver>_windows_amd64.zip).
$MediaMtxVersion = "1.21.1"
$MediaMtxDir = Join-Path $AgentDir "mediamtx"
$MediaMtxExe = Join-Path $MediaMtxDir "mediamtx.exe"
$MediaMtxConfig = Join-Path $MediaMtxDir "mediamtx.yml"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Run this from an Administrator PowerShell window (right-click PowerShell > Run as administrator)."
    exit 1
}

if ($Uninstall) {
    foreach ($t in @($SnapshotTaskName, $WatchTaskName, $MediaMtxTaskName)) {
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

# --- Local RTMP relay (optional) ----------------------------------------------
# Some local RTMP targets (a Zixi Feeder box, for one) accept an incoming
# publish but never re-serve that stream for playback — ffmpeg then can't
# grab a snapshot frame from them directly (NetStream.Play.StreamNotFound,
# even though the feed itself is live and being ingested fine). MediaMTX
# sits in front of a target like that: OBS keeps publishing to the exact
# same URL/port above, MediaMTX answers there instead, forwards the feed on
# unmodified (no re-encode) to the target's ingest port, and this agent
# grabs its snapshot frames from MediaMTX rather than the target directly.
$rtmpParsed = $null
try {
    $rtmpUri = [Uri]$rtmpUrl
    $path = $rtmpUri.AbsolutePath.TrimStart('/')
    if ($rtmpUri.Port -gt 0 -and $path) {
        $rtmpParsed = @{ Port = $rtmpUri.Port; Path = $path }
    }
} catch {}

$defaultUseRelay = if ($existing.localRelayEnabled) { "y" } else { "n" }
$useLocalRelayRaw = Read-WithDefault `
    "Does that RTMP URL only accept ingest, with no snapshot playback (e.g. Zixi Feeder)? Set up a local MediaMTX relay for it? (y/N)" `
    $defaultUseRelay
$localRelayEnabled = $useLocalRelayRaw -match "^[Yy]"

if ($localRelayEnabled -and -not $rtmpParsed) {
    Write-Warning "Could not parse a port and path out of '$rtmpUrl' (need both, e.g. rtmp://host:1935/path) — skipping local relay setup. Fix the RTMP URL above and re-run."
    $localRelayEnabled = $false
}

$localRelayForwardUrl = ""
if ($localRelayEnabled) {
    Write-Host "  MediaMTX will listen on port $($rtmpParsed.Port) — the same port OBS already publishes to." -ForegroundColor Cyan
    Write-Host "  Move your ingest target (e.g. Zixi Feeder) off that port first, in its own settings, then give its new address below." -ForegroundColor Cyan
    do {
        $defaultForward = if ($existing.localRelayForwardUrl) { $existing.localRelayForwardUrl } else { "" }
        $localRelayForwardUrl = Read-WithDefault `
            "RTMP URL of the actual ingest target once moved off port $($rtmpParsed.Port) (e.g. rtmp://localhost:1936/$($rtmpParsed.Path))" `
            $defaultForward
        $forwardValid = $localRelayForwardUrl -match "^rtmp://"
        if (-not $forwardValid) {
            Write-Host "  Must start with rtmp://. Try again." -ForegroundColor Yellow
        }
    } while (-not $forwardValid)
}

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

# --- Local RTMP relay (MediaMTX) install + config -----------------------------
if ($localRelayEnabled) {
    if (-not (Test-Path $MediaMtxExe)) {
        Write-Host "Installing MediaMTX v$MediaMtxVersion (local RTMP relay)..."
        New-Item -ItemType Directory -Path $MediaMtxDir -Force | Out-Null
        $mediaMtxZip = Join-Path $MediaMtxDir "mediamtx.zip"
        $mediaMtxZipUrl = "https://github.com/bluenviron/mediamtx/releases/download/v$MediaMtxVersion/mediamtx_v${MediaMtxVersion}_windows_amd64.zip"
        Invoke-WebRequest -Uri $mediaMtxZipUrl -OutFile $mediaMtxZip
        Expand-Archive -Path $mediaMtxZip -DestinationPath $MediaMtxDir -Force
        Remove-Item $mediaMtxZip -Force
    }

    # runOnAvailable fires the instant OBS starts publishing (MediaMTX's own
    # term for "the stream is available to be read"; it SIGINTs the command
    # automatically once the stream stops) — copy (no re-encode, -c copy)
    # the incoming feed straight on to the real ingest target.
    $forwardCmd = "`"$ffmpegPath`" -i rtmp://localhost:$($rtmpParsed.Port)/$($rtmpParsed.Path) -c copy -f flv $localRelayForwardUrl"
    # Single-quoted in the YAML (escaping any literal ' by doubling it, YAML's
    # own rule for single-quoted scalars) rather than left bare: ffmpegPath is
    # wrapped in double quotes for the shell-level parse below, and a value
    # starting with " is itself special to YAML — double-quoted scalars there
    # process backslashes as escapes, which corrupts every backslash in a
    # Windows path (e.g. \P in "C:\Program Files\..." becomes an invalid
    # escape and MediaMTX fails to even parse the config).
    $forwardCmdYaml = $forwardCmd -replace "'", "''"
    @"
rtmpAddress: :$($rtmpParsed.Port)

paths:
  $($rtmpParsed.Path):
    runOnAvailable: '$forwardCmdYaml'
    runOnAvailableRestart: true
"@ | Set-Content -Path $MediaMtxConfig -Encoding utf8
}

# --- Write config ---------------------------------------------------------
$config = [ordered]@{
    streamId              = $streamId
    channelLabel          = $channelLabel
    rtmpUrl               = $rtmpUrl
    dashboardBaseUrl      = $dashboardBaseUrl
    zixiSnapshotToken     = $zixiSnapshotToken
    intervalSeconds       = $intervalSeconds
    relayBaseUrl          = $relayBaseUrl
    relayIngestToken      = $relayIngestToken
    ffmpegPath            = $ffmpegPath
    localRelayEnabled     = $localRelayEnabled
    localRelayForwardUrl  = $localRelayForwardUrl
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

if ($localRelayEnabled) {
    $mediaMtxAction = New-ScheduledTaskAction -Execute $MediaMtxExe -Argument "`"$MediaMtxConfig`""
    if (Get-ScheduledTask -TaskName $MediaMtxTaskName -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $MediaMtxTaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $MediaMtxTaskName -Confirm:$false
    }
    Register-ScheduledTask -TaskName $MediaMtxTaskName -Action $mediaMtxAction -Trigger $trigger `
        -Principal $principal -Settings $settings `
        -Description "Local RTMP relay (MediaMTX) so ffmpeg can grab snapshot frames from an ingest-only target like Zixi Feeder. Installed by agent/windows/install.ps1." | Out-Null
    Start-ScheduledTask -TaskName $MediaMtxTaskName
} elseif (Get-ScheduledTask -TaskName $MediaMtxTaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $MediaMtxTaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $MediaMtxTaskName -Confirm:$false
    Write-Host "Removed the local MediaMTX relay task (no longer marked as needed)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. '$streamId' ($channelLabel) is now pushing snapshots to $dashboardBaseUrl every $intervalSeconds s." -ForegroundColor Green
if ($relayBaseUrl) {
    Write-Host "Click-to-watch is enabled, relaying through $relayBaseUrl." -ForegroundColor Green
} else {
    Write-Host "Click-to-watch is disabled (no relay URL/token set) — re-run this script to enable it." -ForegroundColor Yellow
}
if ($localRelayEnabled) {
    Write-Host "Local MediaMTX relay listening on port $($rtmpParsed.Port), forwarding to $localRelayForwardUrl." -ForegroundColor Green
}
Write-Host "Logs: $(Join-Path $AgentDir 'agent.log') and $(Join-Path $AgentDir 'watch.log')"
Write-Host "To change any setting later, just re-run this script. To remove entirely: .\install.ps1 -Uninstall"
