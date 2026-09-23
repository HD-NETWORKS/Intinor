<#
    Runs forever: grabs one frame from the local RTMP feed via ffmpeg, POSTs it
    to the dashboard's Zixi snapshot endpoint, waits, repeats. Started by the
    "HDNetworksZixiSnapshotAgent" scheduled task that install.ps1 registers —
    not meant to be run by hand except for testing (see -Once below).

    A single iteration failing (ffmpeg can't grab a frame, the network call
    fails, whatever) must never take the loop down, since a dead agent looks
    identical to a dead stream on the dashboard. Every failure is caught,
    logged, and the loop just tries again next interval.
#>
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "config.json"),
    [switch]$Once
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
function Write-Log([string]$Message) { Write-AgentLog "agent.log" $Message }

function Invoke-SnapshotOnce {
    param($Config)

    $frame = Join-Path $TempDir ("zixi-{0}.jpg" -f $Config.streamId)
    if (Test-Path $frame) { Remove-Item $frame -Force -ErrorAction SilentlyContinue }

    # -y overwrite, single frame, short read/connect timeout so a dead RTMP
    # source fails fast instead of hanging the loop for minutes.
    $ffmpegArgs = @(
        "-y",
        "-rw_timeout", "5000000",
        "-i", $Config.rtmpUrl,
        "-frames:v", "1",
        "-q:v", "5",
        $frame
    )

    # Full path, not the bare "ffmpeg" name: this runs as SYSTEM (via the
    # scheduled task), which doesn't see a per-user PATH entry winget may
    # have added. Falls back to PATH lookup only for a config.json written
    # before install.ps1 started recording ffmpegPath.
    $ffmpegExe = if ($Config.ffmpegPath) { $Config.ffmpegPath } else { "ffmpeg" }
    $proc = Start-Process -FilePath $ffmpegExe -ArgumentList $ffmpegArgs `
        -NoNewWindow -PassThru -RedirectStandardError (Join-Path $TempDir "ffmpeg-zixi-stderr.log")
    if (-not $proc.WaitForExit(15000)) {
        try { $proc.Kill() } catch {}
        throw "ffmpeg timed out grabbing a frame from $($Config.rtmpUrl)"
    }
    if ($proc.ExitCode -ne 0 -or -not (Test-Path $frame) -or (Get-Item $frame).Length -eq 0) {
        throw "ffmpeg did not produce a frame (exit code $($proc.ExitCode)) — is OBS/the RTMP source live?"
    }

    $uri = "$($Config.dashboardBaseUrl.TrimEnd('/'))/api/zixi-snapshot/$($Config.streamId)"
    try {
        Invoke-WebRequest -Uri $uri -Method Post `
            -Headers @{
                "Authorization"    = "Bearer $($Config.zixiSnapshotToken)"
                "X-Channel-Label"  = $Config.channelLabel
            } `
            -ContentType "image/jpeg" `
            -InFile $frame `
            -UseBasicParsing `
            -TimeoutSec 10 | Out-Null
        Write-Log "ok   pushed snapshot for $($Config.streamId)"
    } finally {
        Remove-Item $frame -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path $ConfigPath)) {
    Write-Log "FATAL config not found at $ConfigPath — run install.ps1 first."
    exit 1
}

while ($true) {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    try {
        Invoke-SnapshotOnce -Config $config
    } catch {
        Write-Log "FAIL $($_.Exception.Message)"
    }

    if ($Once) { break }
    Start-Sleep -Seconds ([int]$config.intervalSeconds)
}
