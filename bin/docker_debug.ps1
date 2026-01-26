$logPath = "C:\Users\Kevin\Github\kndym.github.io\.cursor\debug.log"

function Write-DebugLog {
  param(
    [string]$hypothesisId,
    [string]$location,
    [string]$message,
    [hashtable]$data
  )
  $payload = @{
    sessionId   = "debug-session"
    runId       = "pre-fix"
    hypothesisId = $hypothesisId
    location    = $location
    message     = $message
    data        = $data
    timestamp   = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  }
  $json = $payload | ConvertTo-Json -Compress
  Add-Content -Path $logPath -Value $json
}

function Run-Command {
  param(
    [string]$command,
    [string[]]$args
  )
  try {
    $output = & $command @args 2>&1
    $exitCode = $LASTEXITCODE
    return @{
      exitCode = $exitCode
      output = ($output | Select-Object -First 1)
    }
  } catch {
    return @{
      exitCode = 1
      output = $_.Exception.Message
    }
  }
}

$dockerDesktopProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
$dockerService = Get-Service "com.docker.service" -ErrorAction SilentlyContinue
$pipeExists = Test-Path "\\.\pipe\dockerDesktopLinuxEngine"

#region agent log
Write-DebugLog -hypothesisId "A" -location "bin/docker_debug.ps1:43" -message "Docker Desktop runtime status" -data @{
  processRunning = [bool]$dockerDesktopProcess
  serviceStatus = if ($dockerService) { $dockerService.Status.ToString() } else { "missing" }
  enginePipeExists = $pipeExists
}
#endregion

$contextResult = Run-Command -command "docker" -args @("context", "show")
#region agent log
Write-DebugLog -hypothesisId "D" -location "bin/docker_debug.ps1:52" -message "Docker context" -data @{
  exitCode = $contextResult.exitCode
  output = $contextResult.output
}
#endregion

$versionResult = Run-Command -command "docker" -args @("version")
#region agent log
Write-DebugLog -hypothesisId "B" -location "bin/docker_debug.ps1:60" -message "Docker version check" -data @{
  exitCode = $versionResult.exitCode
  output = $versionResult.output
}
#endregion

$infoResult = Run-Command -command "docker" -args @("info")
#region agent log
Write-DebugLog -hypothesisId "B" -location "bin/docker_debug.ps1:68" -message "Docker info check" -data @{
  exitCode = $infoResult.exitCode
  output = $infoResult.output
}
#endregion

$pullResult = Run-Command -command "docker" -args @("compose", "pull")
#region agent log
Write-DebugLog -hypothesisId "C" -location "bin/docker_debug.ps1:76" -message "Compose pull result" -data @{
  exitCode = $pullResult.exitCode
  output = $pullResult.output
}
#endregion

$upResult = Run-Command -command "docker" -args @("compose", "up", "--no-start")
#region agent log
Write-DebugLog -hypothesisId "C" -location "bin/docker_debug.ps1:84" -message "Compose up (no-start) result" -data @{
  exitCode = $upResult.exitCode
  output = $upResult.output
}
#endregion
