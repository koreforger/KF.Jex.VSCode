#Requires -Version 7.0
<#
.SYNOPSIS
    Builds the JEX VS Code extension, Language Server, and CLI.
.DESCRIPTION
    Compiles TypeScript, builds the C# Language Server and CLI, and prepares 
    the extension for packaging.
.PARAMETER Configuration
    Build configuration (Debug or Release). Default: Release
.EXAMPLE
    .\build.ps1
    .\build.ps1 -Configuration Debug
#>

[CmdletBinding()]
param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$startLocation = Get-Location

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $rootDir = Split-Path -Parent $scriptDir
    $vsCodeDir = $rootDir
    $workspaceRoot = Split-Path -Parent $rootDir
    $serverProjectDir = Join-Path $workspaceRoot "Khaos.JEX.LanguageServer" "src" "Khaos.JEX.LanguageServer"
    $cliProjectDir = Join-Path $workspaceRoot "Khaos.JEX.Cli" "src" "Khaos.JEX.Cli"

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Building JEX VS Code Extension" -ForegroundColor Cyan
    Write-Host "Configuration: $Configuration" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Build Language Server
    Write-Host "`n[1/6] Building Language Server..." -ForegroundColor Yellow
    Set-Location $serverProjectDir
    dotnet build -c $Configuration
    if ($LASTEXITCODE -ne 0) { throw "Language Server build failed" }

    # Publish Language Server for bundling
    Write-Host "`n[2/6] Publishing Language Server..." -ForegroundColor Yellow
    $publishDir = Join-Path $vsCodeDir "server"
    if (Test-Path $publishDir) {
        Remove-Item -Recurse -Force $publishDir
    }
    dotnet publish -c $Configuration -o $publishDir --self-contained false
    if ($LASTEXITCODE -ne 0) { throw "Language Server publish failed" }

    # Build CLI
    Write-Host "`n[3/6] Building CLI..." -ForegroundColor Yellow
    Set-Location $cliProjectDir
    dotnet build -c $Configuration
    if ($LASTEXITCODE -ne 0) { throw "CLI build failed" }

    # Publish CLI for bundling
    Write-Host "`n[4/6] Publishing CLI..." -ForegroundColor Yellow
    $cliPublishDir = Join-Path $vsCodeDir "cli"
    if (Test-Path $cliPublishDir) {
        Remove-Item -Recurse -Force $cliPublishDir
    }
    dotnet publish -c $Configuration -o $cliPublishDir --self-contained false
    if ($LASTEXITCODE -ne 0) { throw "CLI publish failed" }

    # Install npm dependencies
    Write-Host "`n[5/6] Installing npm dependencies..." -ForegroundColor Yellow
    Set-Location $vsCodeDir
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

    # Build TypeScript
    Write-Host "`n[6/6] Compiling TypeScript..." -ForegroundColor Yellow
    npm run compile
    if ($LASTEXITCODE -ne 0) { throw "TypeScript compilation failed" }

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
}
catch {
    Write-Host "`nBuild failed: $_" -ForegroundColor Red
    exit 1
}
finally {
    Set-Location $startLocation
}
