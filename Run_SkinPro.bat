@echo off
setlocal
cd /d "%~dp0src"

start "" cmd /c "npm run dev"

set "URL=http://localhost:3000"
set "READY=0"

:wait_loop
if %READY%==1 goto open_browser
powershell -NoProfile -Command ^
  "try { $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri '%URL%'; exit 0 } catch { exit 1 }"
if %ERRORLEVEL%==0 set READY=1
timeout /t 1 >nul
goto wait_loop

:open_browser
start "" "%URL%"
