param([string]$SecretsDirectory = 'C:\PROJECTS\NEARHIRE-SECRETS')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
# Keyless OpenFreeMap default; no external basemap credentials required.
$env:GOOGLE_SERVICES_JSON = Join-Path $SecretsDirectory 'google-services.json'
$env:EXPO_PUBLIC_DEMO_MODE = 'false'
$env:EXPO_PUBLIC_UI_PREVIEW = 'false'
$env:EXPO_PUBLIC_PAYMENT_TEST_AUTH = 'true'
# Supabase public values are loaded by Expo from the existing ignored mobile .env.
# The test password is deliberately NOT read or exposed by this launcher.
npx expo start --dev-client --lan --port 8094
exit $LASTEXITCODE
