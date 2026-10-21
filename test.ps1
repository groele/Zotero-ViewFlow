param([string]$PackagePath)
$ErrorActionPreference = 'Stop'
foreach ($file in @('bootstrap.js','zoteropreview.js','zoteropreview_prefs.js')) {
    node --check (Join-Path $PSScriptRoot $file)
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $file" }
}
$previousPackage = $env:VIEWFLOW_XPI_PATH
try {
    if ($PackagePath) { $env:VIEWFLOW_XPI_PATH = (Resolve-Path -LiteralPath $PackagePath).Path }
    $testFiles = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'tests') -Filter '*.test.cjs' | Sort-Object Name | Select-Object -ExpandProperty FullName)
    node --test @testFiles
    if ($LASTEXITCODE -ne 0) { throw 'ViewFlow regressions or installer validation failed' }
} finally { $env:VIEWFLOW_XPI_PATH = $previousPackage }
Write-Host 'Runtime regressions, syntax, installer payload and update metadata checks passed. The update feed was not modified.'
