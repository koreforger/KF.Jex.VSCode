#Requires -Version 7.0
<#
.SYNOPSIS
    Packages the JEX VS Code extension as a .vsix file.
.DESCRIPTION
    Builds the extension and creates a .vsix package ready for
    installation or publishing.
.PARAMETER Version
    Version to use for the package. If not specified, uses version from package.json.
.EXAMPLE
    .\pack.ps1
    .\pack.ps1 -Version "1.0.0"
#>

[CmdletBinding()]
param(
    [string]$Version
)

$ErrorActionPreference = "Stop"
$startLocation = Get-Location

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $rootDir = Split-Path -Parent $scriptDir
    $vsCodeDir = $rootDir
    $artifactsDir = Join-Path (Split-Path -Parent $rootDir) "artifacts" "vsix"

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Packaging JEX VS Code Extension" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    Set-Location $vsCodeDir

    # Build first
    Write-Host "`n[1/3] Building extension..." -ForegroundColor Yellow
    & (Join-Path $scriptDir "build.ps1") -Configuration Release
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }

    # Update version if specified
    if ($Version) {
        Write-Host "`n[2/3] Updating version to $Version..." -ForegroundColor Yellow
        $packageJsonPath = Join-Path $vsCodeDir "package.json"
        $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        $packageJson.version = $Version
        $packageJson | ConvertTo-Json -Depth 10 | Set-Content $packageJsonPath -NoNewline
    } else {
        $packageJson = Get-Content (Join-Path $vsCodeDir "package.json") -Raw | ConvertFrom-Json
        $Version = $packageJson.version
        Write-Host "`n[2/3] Using version from package.json: $Version" -ForegroundColor Yellow
    }

    # Ensure artifacts directory exists
    if (-not (Test-Path $artifactsDir)) {
        New-Item -ItemType Directory -Path $artifactsDir | Out-Null
    }

    # Install vsce if needed
    Write-Host "`n[3/3] Creating VSIX package..." -ForegroundColor Yellow
    $vsceInstalled = npm list -g @vscode/vsce 2>$null
    if (-not $vsceInstalled) {
        Write-Host "Installing @vscode/vsce globally..." -ForegroundColor Gray
        npm install -g @vscode/vsce
    }

    # Package
    $outputPath = Join-Path $artifactsDir "khaos-jex-$Version.vsix"
    npx @vscode/vsce package --out $outputPath
    if ($LASTEXITCODE -ne 0) { throw "Packaging failed" }

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "Package created successfully!" -ForegroundColor Green
    Write-Host "Output: $outputPath" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nTo install:" -ForegroundColor Cyan
    Write-Host "  code --install-extension `"$outputPath`"" -ForegroundColor White
}
catch {
    Write-Host "`nPackaging failed: $_" -ForegroundColor Red
    exit 1
}
finally {
    Set-Location $startLocation
}
