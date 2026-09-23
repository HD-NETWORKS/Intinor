<#
    Runs forever alongside snapshot-loop.ps1, on its own scheduled task:
    polls the preview relay's "is anyone watching this stream?" endpoint,
    and starts/stops a low-bitrate (~600kbps) ffmpeg encode of the same
    local RTMP source accordingly — see README §Phase 24.

    A no-op when relayBaseUrl/relayIngestToken aren't set in config.json
    (install.ps1's two watch-specific prompts are optional): this loop just
    idles, snapshots keep working exactly as before. Isolated from
    snapshot-loop.ps1 on purpose — a stuck encode must never stop
    snapshots, and vice versa, so they run as two independent tasks rather
    than one script doing both jobs.
#>
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "config.json"),
    [int]$PollIntervalSeconds = 5,
    [int]$MaxIterations = 0  # 0 = run forever; used by tests to bound the loop.
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
function Write-Log([string]$Message) { Write-AgentLog "watch.log" $Message }

function Start-WatchEncode {
    param($Config, [string]$RelayBase)

    $streamId = $Config.streamId
    $ingestBase = "$($RelayBase.TrimEnd('/'))/ingest/$streamId"

    # Low-bitrate copy of the same local RTMP source the snapshot loop
    # reads: 360p, ~600kbps video capped at 700kbps, a forced keyframe every
    # 2s so HLS segment boundaries always land on one (independent of the
    # source's own GOP structure). ffmpeg's HLS muxer PUTs the playlist and
    # each segment straight to the relay over plain HTTP — no separate
    # upload step, no raw TCP tunnel needed anywhere.
    $ffmpegArgs = @(
        "-y",
        "-rw_timeout", "5000000",
        "-i", $Config.rtmpUrl,
        "-vf", "scale=-2:360",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-profile:v", "main",
        "-b:v", "600k",
        "-maxrate", "700k",
        "-bufsize", "1200k",
        "-force_key_frames", "expr:gte(t,n_forced*2)",
        "-c:a", "aac",
        "-b:a", "64k",
        "-f", "hls",
        "-hls_time", "2",
        "-hls_list_size", "3",
        "-hls_flags", "delete_segments+append_list",
        "-hls_segment_type", "mpegts",
        "-method", "PUT",
        "-headers", "Authorization: Bearer $($Config.relayIngestToken)`r`n",
        "-hls_segment_filename", "$ingestBase/seg_%d.ts",
        "$ingestBase/index.m3u8"
    )

    # Full path, not the bare "ffmpeg" name — see the matching comment in
    # snapshot-loop.ps1: this runs as SYSTEM via the scheduled task, which
    # doesn't see a per-user PATH entry winget may have added.
    $ffmpegExe = if ($Config.ffmpegPath) { $Config.ffmpegPath } else { "ffmpeg" }
    return Start-Process -FilePath $ffmpegExe -ArgumentList $ffmpegArgs `
        -NoNewWindow -PassThru -RedirectStandardError (Join-Path $TempDir "ffmpeg-zixi-watch-stderr.log")
}

function Stop-WatchEncode($Proc) {
    if ($Proc -and -not $Proc.HasExited) {
        try { $Proc.Kill() } catch {}
    }
}

if (-not (Test-Path $ConfigPath)) {
    Write-Log "FATAL config not found at $ConfigPath — run install.ps1 first."
    exit 1
}

$encodeProc = $null
$iteration = 0

try {
    while ($true) {
        $iteration++
        $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
        $relayBase = $config.relayBaseUrl
        $relayToken = $config.relayIngestToken

        try {
            if ([string]::IsNullOrWhiteSpace($relayBase) -or [string]::IsNullOrWhiteSpace($relayToken)) {
                if ($encodeProc) {
                    Stop-WatchEncode $encodeProc
                    $encodeProc = $null
                    Write-Log "watch relay not configured — stopped encode"
                }
            } else {
                $wanted = $false
                try {
                    $wantedUri = "$($relayBase.TrimEnd('/'))/viewers/$($config.streamId)/wanted"
                    $resp = Invoke-RestMethod -Uri $wantedUri -Method Get -TimeoutSec 5
                    $wanted = [bool]$resp.wanted
                } catch {
                    Write-Log "FAIL checking viewer demand: $($_.Exception.Message)"
                }

                $running = $encodeProc -and -not $encodeProc.HasExited
                if ($wanted -and -not $running) {
                    $encodeProc = Start-WatchEncode -Config $config -RelayBase $relayBase
                    Write-Log "ok   started low-bitrate encode for $($config.streamId)"
                } elseif (-not $wanted -and $running) {
                    Stop-WatchEncode $encodeProc
                    $encodeProc = $null
                    Write-Log "ok   stopped low-bitrate encode for $($config.streamId) (no viewers)"
                } elseif ($wanted -and $encodeProc -and $encodeProc.HasExited) {
                    Write-Log "FAIL encode exited unexpectedly (code $($encodeProc.ExitCode)) — will retry"
                    $encodeProc = $null
                }
            }
        } catch {
            Write-Log "FAIL $($_.Exception.Message)"
        }

        if ($MaxIterations -gt 0 -and $iteration -ge $MaxIterations) { break }
        Start-Sleep -Seconds $PollIntervalSeconds
    }
} finally {
    Stop-WatchEncode $encodeProc
}
