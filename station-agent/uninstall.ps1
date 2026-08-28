#Requires -RunAsAdministrator
[CmdletBinding()]
param(
  [switch]$RemoveConfiguration
)

$ErrorActionPreference = 'Stop'
$TaskName = 'Captain 97 Station Agent'
$InstallDirectory = Join-Path $env:ProgramData 'Captain97\StationAgent'

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

if ($RemoveConfiguration) {
  Remove-Item $InstallDirectory -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host 'The task, program, logs, and local credentials were removed.'
} else {
  Remove-Item (Join-Path $InstallDirectory 'station-agent.mjs') -Force -ErrorAction SilentlyContinue
  Write-Host 'The task and program were removed. Local configuration and logs were preserved.'
}
