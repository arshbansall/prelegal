# Build and start Prelegal in Docker on Windows (http://localhost:8000).
$ErrorActionPreference = "Stop"

$Name = "prelegal"
$Image = "prelegal"
$Port = 8000
$Url = "http://localhost:$Port"

Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "Building the Prelegal image..."
docker build -t $Image .
if ($LASTEXITCODE -ne 0) { throw "docker build failed." }

# Replace any running container. The database lives inside the container,
# so every start begins with a fresh one.
# (Scoped "Continue": Windows PowerShell 5.1 treats redirected stderr as an error under "Stop".)
& { $ErrorActionPreference = "Continue"; docker rm -f $Name 2>$null | Out-Null }

$runArgs = @("run", "-d", "--name", $Name, "-p", "${Port}:8000")
if (Test-Path ".env") {
    $runArgs += @("--env-file", ".env")
} else {
    Write-Host "Note: no .env file found in the project root; starting without it."
}
docker @runArgs $Image | Out-Null
if ($LASTEXITCODE -ne 0) { throw "docker run failed." }

Write-Host -NoNewline "Waiting for Prelegal to start"
for ($i = 0; $i -lt 30; $i++) {
    try {
        Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
        Write-Host ""
        Write-Host "Prelegal is running at $Url"
        exit 0
    } catch {
        Write-Host -NoNewline "."
        Start-Sleep -Seconds 1
    }
}

Write-Host ""
Write-Error "Prelegal did not become healthy within 30 seconds. Check: docker logs $Name"
exit 1
