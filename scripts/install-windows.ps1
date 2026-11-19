# pnpm install for Windows machines where pnpm intermittently fails to create its links with
# "EPERM: operation not permitted, symlink '<target>' -> '<link>'" (seen on the dev laptop with
# pnpm 10 and 12; Windows itself creates the same link fine). Runs the install; on that error it
# creates the named link as a directory junction and tries again, up to 10 times.
#
#   powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
param([string[]] $PnpmArgs = @('install', '--frozen-lockfile'), [int] $MaxTries = 10)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
# The project's own pnpm once installed; on a fresh checkout (a CI workspace), the pinned version via npx.
$pinned = (Get-Content package.json -Raw | ConvertFrom-Json).devDependencies.pnpm
$pnpm = if (Test-Path 'node_modules\.bin\pnpm.cmd') { 'node_modules\.bin\pnpm.cmd' } else { "npx --yes pnpm@$pinned" }

for ($try = 1; $try -le $MaxTries; $try++) {
  $output = & cmd /c "$pnpm $($PnpmArgs -join ' ') 2>&1"
  if ($LASTEXITCODE -eq 0) {
    Write-Host "pnpm $($PnpmArgs -join ' ') succeeded (attempt $try)."
    exit 0
  }
  $line = $output | Where-Object { $_ -match "EPERM.*symlink '([^']+)' -> '([^']+)'" } | Select-Object -First 1
  if (-not $line) {
    $output | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }
    Write-Error "pnpm failed for a reason other than the link error; see the output above."
  }
  # pnpm reports symlink 'target' -> 'link'
  $null = $line -match "symlink '([^']+)' -> '([^']+)'"
  $target, $link = $Matches[1], $Matches[2]
  Write-Host "Attempt ${try}: pnpm could not link $link; creating the junction and retrying."
  if (Test-Path -LiteralPath $link) {
    # rmdir removes a junction itself, never what it points to, and refuses a real non-empty folder.
    & cmd /c "rmdir `"$link`"" 2>$null
    if (Test-Path -LiteralPath $link) { Write-Error "$link exists and is not an empty folder or a link; not touching it." }
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $link -Parent) | Out-Null
  & cmd /c "mklink /J `"$link`" `"$target`"" | Out-Null
}
Write-Error "Still failing after $MaxTries attempts."
