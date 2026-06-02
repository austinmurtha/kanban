@echo off
docker compose up --build -d
if %errorlevel% neq 0 exit /b %errorlevel%
echo App started at http://localhost:8000
