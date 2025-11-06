@echo off
REM Undeploy Demo Micro from Kubernetes
REM This script removes all resources

echo ==========================================
echo Undeploying Demo Micro from Kubernetes
echo ==========================================
echo.

REM Check if kubectl is installed
where kubectl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] kubectl is not installed.
    exit /b 1
)

REM Confirm deletion
set /p CONFIRM="Are you sure you want to delete all resources in demo-micro namespace? (y/n): "
if /i NOT "%CONFIRM%"=="y" (
    echo [INFO] Cancelled.
    exit /b 0
)

echo.
echo [INFO] Starting cleanup...
echo.

REM Delete in reverse order of deployment

echo [INFO] Deleting Ingress...
kubectl delete -f ..\manifests\ingress.yaml --ignore-not-found=true 2>nul

echo [INFO] Deleting API Gateway...
kubectl delete -f ..\..\backend\api-gateway\k8s\ --ignore-not-found=true 2>nul

echo [INFO] Deleting microservices...
kubectl delete -f ..\..\backend\order-service\k8s\deployment.yaml --ignore-not-found=true 2>nul
kubectl delete -f ..\..\backend\order-service\k8s\service.yaml --ignore-not-found=true 2>nul
kubectl delete -f ..\..\backend\inventory-service\k8s\deployment.yaml --ignore-not-found=true 2>nul
kubectl delete -f ..\..\backend\inventory-service\k8s\service.yaml --ignore-not-found=true 2>nul
kubectl delete -f ..\..\backend\notification-service\k8s\deployment.yaml --ignore-not-found=true 2>nul
kubectl delete -f ..\..\backend\notification-service\k8s\service.yaml --ignore-not-found=true 2>nul

echo [INFO] Deleting databases...
kubectl delete -f ..\..\backend\order-service\k8s\database\ --ignore-not-found=true 2>nul
kubectl delete -f ..\..\backend\inventory-service\k8s\database\ --ignore-not-found=true 2>nul
kubectl delete -f ..\..\backend\notification-service\k8s\database\ --ignore-not-found=true 2>nul

echo [INFO] Deleting infrastructure...
kubectl delete -f ..\infrastructure\elk\ --ignore-not-found=true 2>nul
kubectl delete -f ..\infrastructure\kafka\ --ignore-not-found=true 2>nul
kubectl delete -f ..\infrastructure\localstack\ --ignore-not-found=true 2>nul
kubectl delete -f ..\infrastructure\redis\ --ignore-not-found=true 2>nul

echo [INFO] Deleting PVCs...
kubectl delete -f ..\manifests\pvc.yaml --ignore-not-found=true 2>nul

echo [INFO] Deleting ConfigMaps and Secrets...
kubectl delete -f ..\manifests\secrets.yaml --ignore-not-found=true 2>nul

echo.
set /p DELETE_NS="Do you want to delete the entire namespace? (y/n): "
if /i "%DELETE_NS%"=="y" (
    echo [INFO] Deleting namespace...
    kubectl delete namespace demo-micro --ignore-not-found=true
) else (
    echo [INFO] Keeping namespace. You can delete it later with:
    echo        kubectl delete namespace demo-micro
)

echo.
echo [SUCCESS] Cleanup completed!
echo.
echo To verify deletion:
echo   kubectl get all -n demo-micro
echo.
pause

