# Auto-fund (if needed) + deploy program + create mint
# Usage (PowerShell):
#   .\scripts\fund-and-deploy.ps1

$ErrorActionPreference = "Stop"
$solBin = "$env:USERPROFILE\.local\share\solana\install\active_release\bin"
$env:Path = "$solBin;C:\Users\Asus\.cargo\bin;" + $env:Path

Set-Location $PSScriptRoot\..

Write-Host "=== Devnet config ===" -ForegroundColor Cyan
solana config set --url https://api.devnet.solana.com | Out-Null
$addr = solana address
$bal = solana balance
Write-Host "Deployer: $addr"
Write-Host "Balance : $bal"

$n = [double](($bal -split " ")[0])
if ($n -lt 2.5) {
  Write-Host "=== Claiming Devnet SOL via faucet ===" -ForegroundColor Cyan
  node scripts/fund-devnet-sol.mjs $addr 5
  $bal = solana balance
  $n = [double](($bal -split " ")[0])
  Write-Host "Balance after fund: $bal"
  if ($n -lt 2.5) {
    Write-Host "Still not enough SOL. Try: npm run solana:fund" -ForegroundColor Yellow
    Write-Host "Or https://faucet.solana.com with GitHub." -ForegroundColor Yellow
    exit 2
  }
}

Write-Host "=== Deploy program ===" -ForegroundColor Cyan
node scripts/deploy-devnet.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== Create mock USDC mint ===" -ForegroundColor Cyan
node scripts/setup-devnet.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "DONE. Restart: npm run dev" -ForegroundColor Green
Write-Host "Connect Phantom (Devnet) and use /app flow."
