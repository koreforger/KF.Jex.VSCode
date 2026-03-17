#Requires -Version 7.0
<#
.SYNOPSIS
    Installs the JEX VS Code extension.
.DESCRIPTION
    Builds the extension if needed and installs it into VS Code.
.PARAMETER NoBuild
    Skip building and use existing .vsix file.
.PARAMETER Force
    Uninstall existing version before installing.
.EXAMPLE
    .\install.ps1
    .\install.ps1 -NoBuild
    .\install.ps1 -Force
#>

[CmdletBinding()]
param(
    [switch]$NoBuild,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$workspaceRoot = Split-Path -Parent $rootDir
$artifactsDir = Join-Path $workspaceRoot "artifacts" "vsix"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installing JEX VS Code Extension" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Find existing vsix or build new one
$vsixFile = Get-ChildItem -Path $artifactsDir -Filter "khaos-jex-*.vsix" -ErrorAction SilentlyContinue | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 1

if (-not $NoBuild -or -not $vsixFile) {
    Write-Host "`n[1/2] Building extension..." -ForegroundColor Yellow
    & (Join-Path $scriptDir "pack.ps1")
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
    
    $vsixFile = Get-ChildItem -Path $artifactsDir -Filter "khaos-jex-*.vsix" | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 1
}

if (-not $vsixFile) {
    throw "No .vsix file found. Run pack.ps1 first."
}

Write-Host "`n[2/2] Installing extension..." -ForegroundColor Yellow
Write-Host "  File: $($vsixFile.Name)" -ForegroundColor Gray

if ($Force) {
    Write-Host "  Uninstalling existing version..." -ForegroundColor Gray
    code --uninstall-extension KhaosKode.khaos-jex 2>$null
}

code --install-extension $vsixFile.FullName
if ($LASTEXITCODE -ne 0) { throw "Installation failed" }

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Extension installed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nReload VS Code window to activate:" -ForegroundColor Cyan
Write-Host "  Ctrl+Shift+P -> 'Reload Window'" -ForegroundColor White
Write-Host "`nOr open a .jex file to test." -ForegroundColor Cyan
