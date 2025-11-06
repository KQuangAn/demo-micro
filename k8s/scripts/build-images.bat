@echo off
REM Build Docker Images for Kubernetes Deployment
REM This script is for Windows users

echo ==========================================
echo Building Docker Images for Kubernetes
echo ==========================================

REM Check if Docker is installed
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop first.
    exit /b 1
)

REM Check if Docker is running
docker ps >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop.
    exit /b 1
)

echo [INFO] Docker is running...

REM If using minikube, use minikube's Docker daemon
where minikube >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Minikube detected. Checking if it's running...
    minikube status >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [INFO] Using minikube's Docker daemon...
        @FOR /f "tokens=*" %%i IN ('minikube docker-env --shell cmd') DO @%%i
    )
)

REM Build API Gateway
echo.
echo [INFO] Building API Gateway image...
docker build -t api-gateway:latest ..\backend\api-gateway
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build API Gateway image
    exit /b 1
)
echo [SUCCESS] API Gateway image built successfully

REM Build Order Service
echo.
echo [INFO] Building Order Service image...
docker build -t order-service:latest ..\backend\order-service
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build Order Service image
    exit /b 1
)
echo [SUCCESS] Order Service image built successfully

REM Build Inventory Service
echo.
echo [INFO] Building Inventory Service image...
docker build -t inventory-service:latest ..\backend\inventory-service
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build Inventory Service image
    exit /b 1
)
echo [SUCCESS] Inventory Service image built successfully

REM Build Notification Service
echo.
echo [INFO] Building Notification Service image...
docker build -t notification-service:latest ..\backend\notification-service
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build Notification Service image
    exit /b 1
)
echo [SUCCESS] Notification Service image built successfully

REM Optional: Build Frontend
if exist "..\frontend" (
    set /p BUILD_FRONTEND="Do you want to build the Frontend image? (y/n): "
    if /i "%BUILD_FRONTEND%"=="y" (
        echo.
        echo [INFO] Building Frontend image...
        docker build -t frontend:latest ..\frontend
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] Failed to build Frontend image
        ) else (
            echo [SUCCESS] Frontend image built successfully
        )
    )
)

echo.
echo [SUCCESS] All images built successfully!
echo.
echo Built images:
docker images | findstr /R "api-gateway.*latest order-service.*latest inventory-service.*latest notification-service.*latest"

echo.
echo ==========================================
echo Build Complete!
echo ==========================================
echo.
echo Next steps:
echo   1. Deploy to Kubernetes: deploy.bat
echo   2. Check status: kubectl get pods -n demo-micro
echo.
