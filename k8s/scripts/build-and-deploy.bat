@echo off
REM All-in-One: Build Docker Images and Deploy to Kubernetes
REM This script builds all images using Minikube Docker daemon then deploys everything

echo ==========================================
echo Build and Deploy - Demo Micro
echo ==========================================
echo.

REM Check if kubectl is available
where kubectl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] kubectl is not installed.
    exit /b 1
)

REM Check if minikube is available and running
where minikube >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    REM Try PowerShell path
    powershell -Command "Get-Command minikube -ErrorAction SilentlyContinue" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] minikube command not found in PATH.
        echo [INFO] Checking if Kubernetes cluster is accessible...
        kubectl cluster-info >nul 2>&1
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] Cannot connect to Kubernetes cluster.
            echo [INFO] Please ensure Minikube is running.
            echo [INFO] Try: minikube start
            exit /b 1
        )
        echo [INFO] Kubernetes cluster is accessible. Continuing...
        set MINIKUBE_AVAILABLE=0
    ) else (
        echo [INFO] Found minikube via PowerShell
        set MINIKUBE_AVAILABLE=1
    )
) else (
    minikube status >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [INFO] Starting minikube...
        minikube start
    )
    set MINIKUBE_AVAILABLE=1
)

echo [INFO] Using Minikube's Docker daemon...
echo [INFO] Setting up Minikube Docker environment...

REM Create temporary batch file with Minikube Docker environment
REM Only try if minikube command is available
if "%MINIKUBE_AVAILABLE%"=="1" (
    REM Try minikube command first
    where minikube >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        minikube docker-env --shell cmd > %TEMP%\minikube-docker-env.bat 2>nul
        if %ERRORLEVEL% EQU 0 (
            call %TEMP%\minikube-docker-env.bat
            del %TEMP%\minikube-docker-env.bat
        ) else (
            echo [WARNING] Could not get Minikube Docker environment. Trying PowerShell...
            powershell -Command "minikube docker-env --shell cmd" > %TEMP%\minikube-docker-env.bat 2>nul
            if exist %TEMP%\minikube-docker-env.bat (
                call %TEMP%\minikube-docker-env.bat
                del %TEMP%\minikube-docker-env.bat
            ) else (
                echo [ERROR] Could not set up Minikube Docker environment.
                echo [INFO] Please ensure Minikube is running and minikube command is accessible.
                exit /b 1
            )
        )
    ) else (
        REM Try PowerShell
        powershell -Command "minikube docker-env --shell cmd" > %TEMP%\minikube-docker-env.bat 2>nul
        if exist %TEMP%\minikube-docker-env.bat (
            call %TEMP%\minikube-docker-env.bat
            del %TEMP%\minikube-docker-env.bat
        ) else (
            echo [ERROR] Could not set up Minikube Docker environment.
            echo [INFO] Please run: minikube docker-env
            exit /b 1
        )
    )
) else (
    echo [WARNING] Minikube command not available in current session.
    echo [INFO] Attempting to use PowerShell to get Docker environment...
    powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command minikube docker-env --shell cmd' -Wait -NoNewWindow" > %TEMP%\minikube-docker-env.bat 2>nul
    if not exist %TEMP%\minikube-docker-env.bat (
        echo [ERROR] Cannot set up Minikube Docker environment automatically.
        echo.
        echo [SOLUTION] Please run this script from PowerShell/CMD as Administrator.
        echo.
        echo [ALTERNATIVE] Or manually set Docker environment:
        echo   1. Open PowerShell as Administrator
        echo   2. Run: minikube docker-env --shell cmd
        echo   3. Copy the output commands
        echo   4. Run them in your current terminal
        echo   5. Then run this script again
        echo.
        exit /b 1
    )
    call %TEMP%\minikube-docker-env.bat
    del %TEMP%\minikube-docker-env.bat
)

REM Verify we're using Minikube Docker
docker info | findstr /C:"Name" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Connected to Minikube Docker daemon
) else (
    echo [WARNING] Could not verify Minikube Docker connection
    echo [INFO] Continuing anyway...
)

echo.
echo ==========================================
echo STEP 1: Building Docker Images
echo ==========================================
echo.

REM Navigate to project root
cd ..\..

REM Build API Gateway
echo [INFO] Building API Gateway...
docker build -t api-gateway:latest backend\api-gateway
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build API Gateway
    exit /b 1
)
echo [SUCCESS] API Gateway built

REM Build Order Service
echo.
echo [INFO] Building Order Service...
docker build -t order-service:latest backend\order-service
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build Order Service
    exit /b 1
)
echo [SUCCESS] Order Service built

REM Build Inventory Service
echo.
echo [INFO] Building Inventory Service...
docker build -t inventory-service:latest backend\inventory-service
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build Inventory Service
    exit /b 1
)
echo [SUCCESS] Inventory Service built

REM Build Notification Service
echo.
echo [INFO] Building Notification Service...
docker build -t notification-service:latest backend\notification-service
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build Notification Service
    exit /b 1
)
echo [SUCCESS] Notification Service built

echo.
echo [SUCCESS] All images built successfully in Minikube!
echo.

REM Verify images exist
echo [INFO] Verifying images in Minikube Docker:
docker images | findstr /R "api-gateway.*latest order-service.*latest inventory-service.*latest notification-service.*latest"
echo.

REM ====================
REM STEP 2: DEPLOY TO K8S
REM ====================
echo ==========================================
echo STEP 2: Deploying to Kubernetes
echo ==========================================
echo.

cd k8s\scripts

REM Run deploy script
call deploy.bat

echo.
echo ==========================================
echo Build and Deploy Complete!
echo ==========================================
echo.

REM Show pod status
echo Current pod status:
kubectl get pods -n demo-micro

echo.
echo ==========================================
echo Next Steps:
echo ==========================================
echo 1. Wait for all pods to be Running (1/1)
echo    Check status: kubectl get pods -n demo-micro -w
echo.
echo 2. Port forward API Gateway:
echo    kubectl port-forward service/api-gateway 8080:8080 -n demo-micro
echo.
echo 3. Test the API:
echo    curl http://localhost:8080/health
echo.
echo 4. Import Postman collection:
echo    File: Demo-Micro-API.postman_collection.json
echo.
pause

