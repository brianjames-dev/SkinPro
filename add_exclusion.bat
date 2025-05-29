@echo off
setlocal

REM === Set the path to the SkinProData folder ===
set "EXCLUSION_PATH=%USERPROFILE%\Desktop\SkinProData"

REM === Check if the folder exists ===
if not exist "%EXCLUSION_PATH%" (
    echo ❌ Folder not found: %EXCLUSION_PATH%
    pause
    exit /b
)

REM === Add the folder to Defender exclusions ===
powershell -Command "Add-MpPreference -ExclusionPath '%EXCLUSION_PATH%'" >nul 2>&1

REM === Show confirmation ===
echo ✅ Windows Defender exclusion added:
echo %EXCLUSION_PATH%

pause
