param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'dist'), [switch]$UpdateFeed)
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$destination = Join-Path $OutputDirectory ('Zotero-ViewFlow-' + $manifest.version + '.xpi')
& (Join-Path $PSScriptRoot 'scripts\build.ps1') -OutputPath $destination -UpdateFeed:$UpdateFeed
