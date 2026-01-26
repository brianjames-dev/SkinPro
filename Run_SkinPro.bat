@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

cd /d "%~dp0src"

set "URL="
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format \"HH:mm:ss\""' ) do set "NOW=%%T"
set "SPIN_BASE=[%NOW%]"
set "SPIN_TEXT=Starting SkinPro web application..."
echo Starting SkinPro web application...
title SkinPro

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

if exist ".devserver.log" del ".devserver.log" >nul 2>&1
start "" /b cmd /c "npm run dev > .devserver.log 2>&1"
powershell -NoProfile -Command "Get-Content -Path '.devserver.log' -Wait -Encoding UTF8"

:open_browser
start "" "%URL%"
goto end

:end
