param(
  [Parameter(Mandatory = $true)][string]$BuildId,
  [Parameter(Mandatory = $true)][string]$GoogleServicesFile,
  [Parameter(Mandatory = $true)][string]$Message,
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
  $publishArgs = @('run', 'update:preview', '--', '--build-id', $BuildId, '--google-services', $GoogleServicesFile, '--message', $Message)
  if ($CheckOnly) { $publishArgs += '--check-only' }
  $ErrorActionPreference = 'Continue'
  & npm @publishArgs
  $commandExit = $LASTEXITCODE
  if ($commandExit -ne 0) { throw 'Preview update validation/publication failed.' }
} finally { Pop-Location }
