@echo off
REM Deploy Demo Micro to Kubernetes
REM This script is for Windows users

echo ==========================================
echo Deploying Demo Micro to Kubernetes
echo ==========================================

REM Check if kubectl is installed
where kubectl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] kubectl is not installed. Please install kubectl first.
    exit /b 1
)

echo [INFO] kubectl is installed

REM Check if minikube is available and running
where minikube >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    minikube status >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [INFO] Starting minikube...
        minikube start
    )
)

echo.
echo [INFO] Creating namespace...
kubectl apply -f namespace.yaml

echo.
echo [INFO] Creating secrets...
kubectl apply -f secrets.yaml

echo.
echo [INFO] Creating ConfigMaps...
kubectl apply -f configmap.yaml

echo.
echo [INFO] Creating PersistentVolumeClaims...
kubectl apply -f pvc.yaml

echo.
echo [INFO] Deploying databases (StatefulSets)...
kubectl apply -f order-db-statefulset.yaml
kubectl apply -f inventory-db-statefulset.yaml
kubectl apply -f mongodb-statefulset.yaml
kubectl apply -f redis-statefulset.yaml

echo.
echo [INFO] Waiting for databases to be ready...
timeout /t 30 /nobreak >nul

echo.
echo [INFO] Deploying LocalStack...
kubectl apply -f localstack-deployment.yaml

echo.
echo [INFO] Waiting for LocalStack to be ready...
timeout /t 20 /nobreak >nul

echo.
echo [INFO] Deploying microservices...
kubectl apply -f order-service-deployment.yaml
kubectl apply -f inventory-service-deployment.yaml
kubectl apply -f notification-service-deployment.yaml

echo.
echo [INFO] Waiting for microservices to be ready...
timeout /t 30 /nobreak >nul

echo.
echo [INFO] Deploying API Gateway...
kubectl apply -f api-gateway-deployment.yaml

echo.
set /p DEPLOY_ELK="Do you want to deploy ELK stack (Elasticsearch, Logstash, Kibana)? (y/n): "
if /i "%DEPLOY_ELK%"=="y" (
    echo [INFO] Deploying ELK stack...
    kubectl apply -f elk-stack.yaml
)

echo.
set /p DEPLOY_INGRESS="Do you want to deploy Ingress controller? (y/n): "
if /i "%DEPLOY_INGRESS%"=="y" (
    where minikube >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [INFO] Enabling Ingress addon (minikube)...
        minikube addons enable ingress
    )
    echo [INFO] Deploying Ingress rules...
    kubectl apply -f ingress.yaml
)

echo.
echo [SUCCESS] Deployment completed!

echo.
echo ==========================================
echo Deployment Summary
echo ==========================================
kubectl get all -n demo-micro

echo.
echo ==========================================
echo Access Information
echo ==========================================
echo API Gateway (NodePort): http://localhost:30080
echo Kibana (NodePort): http://localhost:30561
echo.
echo To access services via Ingress, add these entries to C:\Windows\System32\drivers\etc\hosts:
echo   ^<MINIKUBE_IP^> api.demo-micro.local
echo   ^<MINIKUBE_IP^> kibana.demo-micro.local
echo.
where minikube >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Minikube IP:
    minikube ip
)
echo.
echo To view logs: kubectl logs -f ^<pod-name^> -n demo-micro
echo To get pods: kubectl get pods -n demo-micro
echo.
pause
