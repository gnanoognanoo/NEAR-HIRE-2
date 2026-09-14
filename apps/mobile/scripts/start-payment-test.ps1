param([string]$SecretsDirectory = 'C:\PROJECTS\NEARHIRE-SECRETS')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$mapFile = Join-Path $SecretsDirectory 'maptiler-client.env'
$match = [regex]::Match([IO.File]::ReadAllText($mapFile), '(?m)^MAPTILER_API_KEY\s*=\s*([^\r\n]+)')
if (-not $match.Success) { throw 'External MapTiler development configuration is missing.' }
$mapClientKey = $match.Groups[1].Value.Trim().Trim('"').Trim("'")
$env:EXPO_PUBLIC_MAP_STYLE_URL = 'https://api.maptiler.com/maps/streets-v4/style.json?key=' + [Uri]::EscapeDataString($mapClientKey)
$env:GOOGLE_SERVICES_JSON = Join-Path $SecretsDirectory 'google-services.json'
$env:EXPO_PUBLIC_DEMO_MODE = 'false'
$env:EXPO_PUBLIC_UI_PREVIEW = 'false'
$env:EXPO_PUBLIC_PAYMENT_TEST_AUTH = 'true'
# Supabase public values are loaded by Expo from the existing ignored mobile .env.
# The test password is deliberately NOT read or exposed by this launcher.
npx expo start --dev-client --lan --port 8094
exit $LASTEXITCODE
