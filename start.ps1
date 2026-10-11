$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$client = Join-Path $root 'client'
$siteUrl = 'http://localhost:5173'
$npm = (Get-Command npm -ErrorAction Stop).Source
$powerShell = (Get-Process -Id $PID).Path

function Install-Dependencies([string]$directory) {
	if (Test-Path (Join-Path $directory 'node_modules')) {
		return
	}

	Write-Host "Installing dependencies in $directory..."
	Push-Location $directory
	try {
		& $npm ci
		if ($LASTEXITCODE -ne 0) {
			throw "npm ci failed in $directory"
		}
	}
	finally {
		Pop-Location
	}
}

function Test-Port([int]$port) {
	foreach ($address in [System.Net.Dns]::GetHostAddresses('localhost')) {
		$connection = [System.Net.Sockets.TcpClient]::new($address.AddressFamily)
		try {
			$connection.Connect($address, $port)
			return $true
		}
		catch {
		}
		finally {
			$connection.Dispose()
		}
	}
	return $false
}

function Wait-ForPort([int]$port, [int]$timeoutSeconds = 60) {
	$deadline = (Get-Date).AddSeconds($timeoutSeconds)
	while ((Get-Date) -lt $deadline) {
		if (Test-Port $port) {
			return $true
		}
		Start-Sleep -Milliseconds 500
	}
	return $false
}

if (-not (Test-Path (Join-Path $client 'package.json'))) {
	throw "Frontend package.json not found: $client"
}

foreach ($port in @(3000, 5173)) {
	if (Test-Port $port) {
		throw "Port $port is already in use. Stop the existing process and run start.ps1 again."
	}
}

Install-Dependencies $root
Install-Dependencies $client

Write-Host 'Starting backend at http://localhost:3000...'
Start-Process -FilePath $powerShell `
	-ArgumentList @('-NoExit', '-Command', 'npm run dev') `
	-WorkingDirectory $root

Write-Host 'Starting frontend at http://localhost:5173...'
Start-Process -FilePath $powerShell `
	-ArgumentList @('-NoExit', '-Command', 'npm run dev -- --strictPort') `
	-WorkingDirectory $client

if (-not (Wait-ForPort 3000)) {
	throw 'Backend did not start on port 3000. Check its console for errors.'
}

if (-not (Wait-ForPort 5173)) {
	throw 'Frontend did not start on port 5173. Check its console for errors.'
}

Start-Process $siteUrl
Write-Host "BudgetOS is running at $siteUrl"