param(
  [Parameter(Mandatory = $true)][string]$BuildId,
  [Parameter(Mandatory = $true)][string]$GoogleServicesFile,
  [Parameter(Mandatory = $true)][string]$Message
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $GoogleServicesFile -PathType Leaf)) {
  throw 'Supply the external Preview Firebase Android configuration file.'
}
$names = @('APP_VARIANT','GOOGLE_SERVICES_JSON','EXPO_PUBLIC_DEMO_MODE','EXPO_PUBLIC_UI_PREVIEW','EXPO_PUBLIC_PAYMENT_TEST_AUTH')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
Push-Location (Join-Path $PSScriptRoot '../apps/mobile')
try {
  $env:APP_VARIANT = 'preview'
  $env:GOOGLE_SERVICES_JSON = (Resolve-Path -LiteralPath $GoogleServicesFile).Path
  $env:EXPO_PUBLIC_DEMO_MODE = 'false'
  $env:EXPO_PUBLIC_UI_PREVIEW = 'false'
  $env:EXPO_PUBLIC_PAYMENT_TEST_AUTH = 'false'
  $buildRaw = & npx eas-cli build:view $BuildId --json 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Cannot verify target build.' }
  $build = ($buildRaw -join "`n") | ConvertFrom-Json
  if ($build.status -ne 'FINISHED' -or $build.appIdentifier -ne 'app.nearhire.mobile.preview' -or $build.updateChannel.name -ne 'preview') {
    throw 'Target must be a finished NearHire Preview APK on the preview channel.'
  }
  $fingerprintRaw = & npx eas-cli fingerprint:generate --build-profile preview --platform android --json --non-interactive 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Cannot verify native compatibility.' }
  $fingerprint = ($fingerprintRaw -join "`n") | ConvertFrom-Json
  if ($fingerprint.hash -ne $build.runtime.version) {
    throw 'Native fingerprint differs from the APK. Do not publish or override runtime; inspect native changes.'
  }
  & npx eas-cli update --channel preview --platform android --environment preview --message $Message --non-interactive
  if ($LASTEXITCODE -ne 0) { throw 'Preview update failed.' }
} finally {
  Pop-Location
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
