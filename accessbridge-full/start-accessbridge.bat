@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 goto failed
)
echo Starting AccessBridge frontend and backend...
echo Local JSON storage is used by default. MySQL is optional.
call npm run dev
if errorlevel 1 goto failed
goto end
:failed
echo.
echo Startup failed. Check Node.js, npm, and whether ports 5000 or 5173 are already in use.
pause
:end
endlocal
