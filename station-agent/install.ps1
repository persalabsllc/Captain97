#Requires -RunAsAdministrator
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$TaskName = 'Captain 97 Station Agent'
$InstallDirectory = Join-Path $env:ProgramData 'Captain97\StationAgent'
$AgentPath = Join-Path $InstallDirectory 'station-agent.mjs'
$ConfigPath = Join-Path $InstallDirectory 'config.json'

Write-Host 'Captain 97 read-only Nautel station-agent installer' -ForegroundColor Cyan

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  $standardNode = Join-Path $env:ProgramFiles 'nodejs\node.exe'
  if (Test-Path $standardNode) {
    $nodePath = $standardNode
  } else {
    throw 'Node.js 22 LTS is required. Install it first, then run this installer again.'
  }
} else {
  $nodePath = $nodeCommand.Source
}

$nodeMajor = [int]((& $nodePath --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) {
  throw "Node.js 22 or newer is required. Found $(& $nodePath --version)."
}

$snmpCommunitySecure = Read-Host 'Paste the Nautel Read Community' -AsSecureString
$snmpCommunity = ([System.Net.NetworkCredential]::new('', $snmpCommunitySecure)).Password
if ([string]::IsNullOrWhiteSpace($snmpCommunity) -or $snmpCommunity.Length -lt 8) {
  throw 'The Nautel Read Community must contain at least 8 characters.'
}

$ingestTokenSecure = Read-Host 'Paste the MONITORING_INGEST_TOKEN from Vercel' -AsSecureString
$ingestToken = ([System.Net.NetworkCredential]::new('', $ingestTokenSecure)).Password
if ([string]::IsNullOrWhiteSpace($ingestToken) -or $ingestToken.Length -lt 32) {
  throw 'MONITORING_INGEST_TOKEN must contain at least 32 characters.'
}

New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'station-agent.mjs') $AgentPath -Force

$config = [ordered]@{
  transmitterHost = '192.168.1.11'
  snmpPort = 161
  snmpCommunity = $snmpCommunity
  snmpTimeoutMs = 2000
  pollIntervalSeconds = 10
  ingestUrl = 'https://www.captain97.com/api/monitoring/ingest'
  ingestToken = $ingestToken
  rds = [ordered]@{
    enabled = $true
    port = 7005
    timeoutMs = 2000
  }
  logPath = (Join-Path $InstallDirectory 'station-agent.log')
}
$json = $config | ConvertTo-Json -Depth 4
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ConfigPath, $json, $utf8WithoutBom)

& icacls.exe $InstallDirectory /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null

Write-Host 'Testing read-only SNMP access before installing the task...' -ForegroundColor Yellow
& $nodePath $AgentPath --config $ConfigPath --once --dry-run
if ($LASTEXITCODE -ne 0) {
  throw 'The Nautel read-only test failed. No scheduled task was installed.'
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$AgentPath`" --config `"$ConfigPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RestartCount 20 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Read-only Nautel VS300 telemetry uploader for Captain 97.' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Host 'Captain 97 Station Agent is installed and running.' -ForegroundColor Green
Write-Host "Log: $(Join-Path $InstallDirectory 'station-agent.log')"
