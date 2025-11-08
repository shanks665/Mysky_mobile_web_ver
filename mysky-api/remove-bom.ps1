# Remove BOM from all Java files
$javaFiles = Get-ChildItem -Path "src" -Filter "*.java" -Recurse

Write-Host "Found $($javaFiles.Count) Java files"

foreach ($file in $javaFiles) {
    Write-Host "Processing: $($file.FullName)"
    
    # Read content as bytes
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    
    # Write back without BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
}

Write-Host "BOM removal complete!"
