# Strip query strings from local /images/ paths in .ts/.tsx files
# Pattern: "/images/FILENAME?..." -> "/images/FILENAME"
# Also handles bg-[url('/images/FILENAME?...')] patterns

$targetFiles = @(
    "app\activities\page.tsx",
    "app\page.tsx",
    "app\tours\toursData.ts",
    "app\services\servicesData.ts",
    "app\components\Destinations.tsx",
    "app\destinations\destinationsData.ts",
    "app\about\page.tsx"
)

$root = "C:\My Projects\chama-travel-web"
$totalReplacements = 0

foreach ($relPath in $targetFiles) {
    $fullPath = Join-Path $root $relPath
    if (-not (Test-Path $fullPath)) {
        Write-Host "SKIP (not found): $relPath"
        continue
    }

    $original = Get-Content $fullPath -Raw
    # Remove query strings from local /images/ paths
    # Matches: /images/ANYTHING?QUERYSTRING  (stops at quote or closing paren)
    $updated = $original -replace '(/images/[^"'')\s?]+)\?[^"'')]*', '$1'

    if ($original -ne $updated) {
        $count = ([regex]::Matches($original, '/images/[^"'')\s?]+\?[^"'')]*')).Count
        Set-Content $fullPath $updated -NoNewline
        Write-Host "FIXED ($count replacements): $relPath"
        $totalReplacements += $count
    } else {
        Write-Host "OK (no changes): $relPath"
    }
}

Write-Host ""
Write-Host "Total query strings stripped: $totalReplacements"
