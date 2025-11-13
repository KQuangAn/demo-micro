@echo off
REM Setup script for DynamoDB LocalStack project (Windows)
REM This script will set up everything you need to get started

echo ==================================================
echo   DynamoDB LocalStack - Setup Script
echo ==================================================

REM Check if Docker is running
echo.
echo Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo X Docker is not running. Please start Docker and try again.
    exit /b 1
)
echo √ Docker is running

REM Check if Go is installed
echo.
echo Checking Go...
go version >nul 2>&1
if errorlevel 1 (
    echo X Go is not installed. Please install Go 1.21 or higher.
    exit /b 1
)
for /f "tokens=*" %%i in ('go version') do set GO_VERSION=%%i
echo √ %GO_VERSION% found

REM Start LocalStack
echo.
echo Starting LocalStack...
docker-compose up -d

REM Wait for LocalStack to be ready
echo Waiting for LocalStack to be ready...
timeout /t 5 /nobreak >nul

:check_localstack
curl -s http://localhost:4566/_localstack/health >nul 2>&1
if errorlevel 1 (
    echo Waiting...
    timeout /t 2 /nobreak >nul
    goto check_localstack
)
echo √ LocalStack is ready

REM Install Go dependencies
echo.
echo Installing Go dependencies...
go mod download
echo √ Dependencies installed

REM Create the DynamoDB table
echo.
echo Creating DynamoDB table...
go run cmd\create_table\main.go

echo.
echo ==================================================
echo   Setup Complete!
echo ==================================================
echo.
echo Next steps:
echo   1. Run examples:         go run cmd\app\main.go
echo   2. Try advanced queries: go run cmd\queries\main.go
echo   3. View logs:            docker-compose logs -f
echo   4. Stop LocalStack:      docker-compose down
echo.
echo Happy coding! 🚀
pause
