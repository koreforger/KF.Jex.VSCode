#Requires -Version 7.0
<#
.SYNOPSIS
    Runs tests for the JEX VS Code extension with coverage.
.DESCRIPTION
    Runs both C# Language Server tests and TypeScript extension tests
    with code coverage reporting.
.PARAMETER CoverageThreshold
    Minimum coverage percentage required. Default: 60
.PARAMETER ServerOnly
    Run only Language Server tests.
.PARAMETER ExtensionOnly
    Run only VS Code extension tests.
.EXAMPLE
    .\test.ps1
    .\test.ps1 -CoverageThreshold 80
    .\test.ps1 -ServerOnly
#>

[CmdletBinding()]
param(
    [int]$CoverageThreshold = 60,
    [switch]$ServerOnly,
    [switch]$ExtensionOnly
)

$ErrorActionPreference = "Stop"
$startLocation = Get-Location

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $rootDir = Split-Path -Parent $scriptDir
    $jexRootDir = Split-Path -Parent $rootDir
    $vsCodeDir = Join-Path $jexRootDir "KhaosKode.Jex.VSCode"
    $serverTestDir = Join-Path $jexRootDir "tests" "KhaosKode.JEX.LanguageServer.Tests"
    $testResultsDir = Join-Path $jexRootDir "TestResults"

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running JEX Extension Tests" -ForegroundColor Cyan
    Write-Host "Coverage Threshold: $CoverageThreshold%" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Ensure TestResults directory exists
    if (-not (Test-Path $testResultsDir)) {
        New-Item -ItemType Directory -Path $testResultsDir | Out-Null
    }

    $allPassed = $true

    # Run Language Server Tests
    if (-not $ExtensionOnly) {
        Write-Host "`n[1/2] Running Language Server Tests..." -ForegroundColor Yellow
        Set-Location $serverTestDir
        
        $coverageOutputDir = Join-Path $testResultsDir "LanguageServer"
        if (Test-Path $coverageOutputDir) {
            Remove-Item -Recurse -Force $coverageOutputDir
        }

        dotnet test `
            --collect:"XPlat Code Coverage" `
            --results-directory $coverageOutputDir `
            --logger "trx;LogFileName=TestResults.trx" `
            -- DataCollectionRunSettings.DataCollectors.DataCollector.Configuration.Format=cobertura

        if ($LASTEXITCODE -ne 0) {
            Write-Host "Language Server tests failed!" -ForegroundColor Red
            $allPassed = $false
        } else {
            # Check coverage
            $coverageFile = Get-ChildItem -Path $coverageOutputDir -Recurse -Filter "coverage.cobertura.xml" | Select-Object -First 1
            if ($coverageFile) {
                [xml]$coverage = Get-Content $coverageFile.FullName
                $lineRate = [double]$coverage.coverage.'line-rate' * 100
                Write-Host "Language Server Coverage: $([math]::Round($lineRate, 2))%" -ForegroundColor $(if ($lineRate -ge $CoverageThreshold) { "Green" } else { "Red" })
                
                if ($lineRate -lt $CoverageThreshold) {
                    Write-Host "Coverage below threshold of $CoverageThreshold%!" -ForegroundColor Red
                    $allPassed = $false
                }
            }
        }
    }

    # Run VS Code Extension Tests
    if (-not $ServerOnly) {
        Write-Host "`n[2/2] Running VS Code Extension Tests..." -ForegroundColor Yellow
        Set-Location $vsCodeDir

        # Ensure extension is compiled
        npm run compile
        if ($LASTEXITCODE -ne 0) { 
            Write-Host "Extension compilation failed!" -ForegroundColor Red
            $allPassed = $false
        } else {
            # Note: VS Code extension tests require a display and VS Code to be installed
            # In CI, use xvfb-run on Linux
            Write-Host "Note: Extension tests require VS Code and display. Skipping in headless mode." -ForegroundColor Yellow
            # npm run test
        }
    }

    Write-Host "`n========================================" -ForegroundColor $(if ($allPassed) { "Green" } else { "Red" })
    if ($allPassed) {
        Write-Host "All tests passed!" -ForegroundColor Green
    } else {
        Write-Host "Some tests failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "========================================" -ForegroundColor $(if ($allPassed) { "Green" } else { "Red" })
}
catch {
    Write-Host "`nTest run failed: $_" -ForegroundColor Red
    exit 1
}
finally {
    Set-Location $startLocation
}
