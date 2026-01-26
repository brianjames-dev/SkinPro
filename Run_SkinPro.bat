@echo off
setlocal
cd /d "%~dp0src"

set "URL="
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format \"HH:mm:ss\""' ) do set "NOW=%%T"
echo [%NOW%] Starting SkinPro web application...

rem If a dev server is already running, just open it.
for /l %%P in (3000,1,3010) do (
  powershell -NoProfile -Command ^
    "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri 'http://localhost:%%P' | Out-Null; exit 0 } catch { exit 1 }"
  if not errorlevel 1 (
    set "URL=http://localhost:%%P"
    goto open_browser
  )
)

rem Otherwise start a new dev server in this terminal.
start "" /b powershell -NoProfile -Command ^
  "$maxWait=120; $elapsed=0; while ($elapsed -lt $maxWait) { " ^
  "  foreach ($p in 3000..3010) { " ^
  "    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri ('http://localhost:' + $p) | Out-Null; Start-Process ('http://localhost:' + $p); exit 0 } catch {} " ^
  "  } " ^
  "  Start-Sleep -Seconds 1; $elapsed++ " ^
  "} " ^
  "Write-Host 'Timed out waiting for the dev server. Check this window for errors.'"

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format \"HH:mm:ss\""' ) do set "NOW=%%T"
echo [%NOW%] Launching npm run dev...
call npm run dev

:open_browser
start "" "%URL%"
goto end

:end
