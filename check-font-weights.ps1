# check-font-weights.ps1
# Run from project root (the "dennyangelow" folder), same place as before.
# Shows how many times each of the 7 DM Sans font-weight values is used,
# and exactly which file/line - so you know which ones are safe to remove
# from the weight: [...] array in app/layout.tsx.

$weights = @('100','200','300','400','500','600','700','800','900')

$files = Get-ChildItem -Path .\app,.\components -Recurse `
    -Include *.tsx,*.ts,*.css,*.html

Write-Host ""
Write-Host "=== Font-weight usage per value ===" -ForegroundColor Cyan
Write-Host ""

foreach ($w in $weights) {
    $pattern = "font-weight:\s*$w\b"
    $found = $files | Select-String -Pattern $pattern

    if ($found.Count -eq 0) {
        Write-Host ("  {0}  ->  0 matches   (UNUSED - safe to remove from layout.tsx)" -f $w) -ForegroundColor Green
    } else {
        Write-Host ("  {0}  ->  {1} matches:" -f $w, $found.Count) -ForegroundColor Yellow
        foreach ($m in $found) {
            Write-Host ("      {0}:{1}" -f $m.Path, $m.LineNumber) -ForegroundColor DarkGray
        }
    }
    Write-Host ""
}

Write-Host "=== Done. Compare the GREEN lines with the weight: [...] array in app/layout.tsx ==="
