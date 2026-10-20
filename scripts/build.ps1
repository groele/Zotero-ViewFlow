param([string]$OutputPath)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'manifest.json') | ConvertFrom-Json
if (-not $OutputPath) { $OutputPath = Join-Path $projectRoot ('dist\Zotero-ViewFlow-' + $manifest.version + '.xpi') }
$runtimeFiles = @('manifest.json','bootstrap.js','prefs.js','prefs.xhtml','settings.css','style.css','view.svg','zoteropreview.js','zoteropreview_prefs.js','LICENSE')
$entries = @($runtimeFiles | ForEach-Object {
    [PSCustomObject]@{ Source = Join-Path $projectRoot $_; Name = $_ }
})
$entries += @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'locale') -Recurse -File | Sort-Object FullName | ForEach-Object {
    [PSCustomObject]@{ Source = $_.FullName; Name = [IO.Path]::GetRelativePath($projectRoot, $_.FullName).Replace('\','/') }
})
foreach ($entry in $entries) { if (-not (Test-Path -LiteralPath $entry.Source -PathType Leaf)) { throw "Missing runtime file: $($entry.Name)" } }
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Path (Split-Path -Parent $resolvedOutput) -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
$stream = [IO.File]::Open($resolvedOutput, [IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($entry in $entries) {
        $zipEntry = $archive.CreateEntry($entry.Name, [IO.Compression.CompressionLevel]::Optimal)
        $zipEntry.LastWriteTime = [DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
        $inputStream = [IO.File]::OpenRead($entry.Source)
        $outputStream = $zipEntry.Open()
        try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose(); $outputStream.Dispose() }
    }
} finally { $archive.Dispose(); $stream.Dispose() }
$check = [IO.Compression.ZipFile]::OpenRead($resolvedOutput)
try {
    if ($check.Entries.Count -ne $entries.Count) { throw 'Unexpected files in XPI' }
    foreach ($entry in $entries) {
        $zipEntry = $check.GetEntry($entry.Name)
        if (-not $zipEntry) { throw "Missing archive entry: $($entry.Name)" }
        $entryStream = $zipEntry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $actualHash = [Convert]::ToHexString($sha.ComputeHash($entryStream)) }
        finally { $sha.Dispose(); $entryStream.Dispose() }
        $sourceHash = (Get-FileHash -LiteralPath $entry.Source -Algorithm SHA256).Hash
        if ($actualHash -ne $sourceHash) { throw "XPI source mismatch: $($entry.Name)" }
    }
} finally { $check.Dispose() }
$hash = (Get-FileHash -LiteralPath $resolvedOutput -Algorithm SHA256).Hash
$feedPath = Join-Path $projectRoot 'zotero-viewflow-updates.json'
$feed = Get-Content -LiteralPath $feedPath -Raw | ConvertFrom-Json
$update = $feed.addons.($manifest.applications.zotero.id).updates[0]
if ($update.version -ne $manifest.version) { throw 'Update feed version does not match manifest' }
$update | Add-Member -NotePropertyName update_hash -NotePropertyValue ('sha256:' + $hash.ToLowerInvariant()) -Force
$feedText = ($feed | ConvertTo-Json -Depth 12).Replace("`r`n", "`n") + "`n"
[IO.File]::WriteAllText($feedPath, $feedText, [Text.UTF8Encoding]::new($false))
[PSCustomObject]@{ Path = $resolvedOutput; Bytes = (Get-Item -LiteralPath $resolvedOutput).Length; SHA256 = $hash; RuntimeFiles = $entries.Count } | Format-List
