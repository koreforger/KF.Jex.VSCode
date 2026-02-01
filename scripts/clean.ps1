#Requires -Version 7.0
<#
.SYNOPSIS
    Cleans build artifacts for the JEX VS Code extension.
.DESCRIPTION
    Removes all build outputs, node_modules, and test results.
.PARAMETER All
    Also remove node_modules (slower rebuild).
.EXAMPLE
    .\clean.ps1
    .\clean.ps1 -All
#>

[CmdletBinding()]
param(
    [switch]$All
)

$ErrorActionPreference = "Stop"
$startLocation = Get-Location

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $rootDir = Split-Path -Parent $scriptDir
    $jexRootDir = Split-Path -Parent $rootDir
    $vsCodeDir = $rootDir

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Cleaning JEX VS Code Extension" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    $foldersToRemove = @(
        (Join-Path $vsCodeDir "out"),
        (Join-Path $vsCodeDir "server"),
        (Join-Path $vsCodeDir ".vscode-test"),
        (Join-Path $jexRootDir "TestResults"),
        (Join-Path $jexRootDir "artifacts")
    )

    if ($All) {
        $foldersToRemove += (Join-Path $vsCodeDir "node_modules")
    }

    # Clean VS Code extension artifacts
    foreach ($folder in $foldersToRemove) {
        if (Test-Path $folder) {
            Write-Host "Removing $folder..." -ForegroundColor Yellow
            Remove-Item -Recurse -Force $folder
        }
    }

    # Clean .vsix files
    $vsixFiles = Get-ChildItem -Path $vsCodeDir -Filter "*.vsix" -ErrorAction SilentlyContinue
    foreach ($file in $vsixFiles) {
        Write-Host "Removing $($file.Name)..." -ForegroundColor Yellow
        Remove-Item $file.FullName
    }

    # Clean Language Server build artifacts
    $serverDir = Join-Path $jexRootDir "src" "Khaos.JEX.LanguageServer"
    $serverFolders = @(
        (Join-Path $serverDir "bin"),
        (Join-Path $serverDir "obj")
    )

    foreach ($folder in $serverFolders) {
        if (Test-Path $folder) {
            Write-Host "Removing $folder..." -ForegroundColor Yellow
            Remove-Item -Recurse -Force $folder
        }
    }

    # Clean Language Server Test artifacts
    $serverTestDir = Join-Path $jexRootDir "tests" "Khaos.JEX.LanguageServer.Tests"
    $testFolders = @(
        (Join-Path $serverTestDir "bin"),
        (Join-Path $serverTestDir "obj")
    )

    foreach ($folder in $testFolders) {
        if (Test-Path $folder) {
            Write-Host "Removing $folder..." -ForegroundColor Yellow
            Remove-Item -Recurse -Force $folder
        }
    }

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "Clean completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
}
catch {
    Write-Host "`nClean failed: $_" -ForegroundColor Red
    exit 1
}
finally {
    Set-Location $startLocation
}
