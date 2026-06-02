@echo off
docker compose down
if %errorlevel% neq 0 exit /b %errorlevel%
echo App stopped.
