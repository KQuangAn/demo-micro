@echo off
REM Deploy Demo Micro to Kubernetes
REM Updated for reorganized structure

echo ==========================================
echo Deploying Demo Micro to Kubernetes
echo ==========================================
echo.

REM Check if kubectl is installed
where kubectl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] kubectl is not installed.
    exit /b 1
)

REM Check if minikube is available and running
where minikube >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    minikube status >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [INFO] Starting minikube...
        minikube start
    )
)

REM Navigate to project root
cd ..\..

echo.
echo [INFO] Step 1: Creating namespace...
kubectl apply -f k8s\manifests\namespace.yaml
echo [SUCCESS] Namespace created

echo.
echo [INFO] Step 2: Creating secrets...
kubectl apply -f k8s\manifests\secrets.yaml
echo [SUCCESS] Secrets created

echo.
echo [INFO] Step 3: Creating PVCs...
kubectl apply -f k8s\manifests\pvc.yaml
echo [SUCCESS] PVCs created

echo.
echo [INFO] Step 4: Deploying shared infrastructure...

echo [INFO]   Deploying Redis...
kubectl apply -f k8s\infrastructure\redis\
echo [SUCCESS] Redis deployed

echo [INFO]   Deploying LocalStack...
kubectl apply -f k8s\infrastructure\localstack\
echo [SUCCESS] LocalStack deployed

REM Ask about Kafka
set /p DEPLOY_KAFKA="Do you want to deploy Kafka stack? (y/n): "
if /i "%DEPLOY_KAFKA%"=="y" (
    echo [INFO]   Deploying Kafka stack...
    kubectl apply -f k8s\infrastructure\kafka\kafka-stack.yaml
    echo [SUCCESS] Kafka stack deployed
)

REM Ask about ELK
set /p DEPLOY_ELK="Do you want to deploy ELK stack? (y/n): "
if /i "%DEPLOY_ELK%"=="y" (
    echo [INFO]   Deploying ELK stack...
    echo [INFO]     Creating Logstash ConfigMap...
    kubectl apply -f k8s\infrastructure\elk\logstash-configmap.yaml
    echo [INFO]     Deploying Elasticsearch, Logstash, and Kibana...
    kubectl apply -f k8s\infrastructure\elk\elk-stack.yaml
    echo [SUCCESS] ELK stack deployed - Kafka integration enabled
)

echo.
echo [INFO] Step 5: Deploying databases...

echo [INFO]   Deploying Order database...
kubectl apply -f backend\order-service\k8s\database\
echo [SUCCESS] Order database deployed

echo [INFO]   Deploying Inventory database...
kubectl apply -f backend\inventory-service\k8s\database\
echo [SUCCESS] Inventory database deployed

echo [INFO]   Deploying Notification database...
kubectl apply -f backend\notification-service\k8s\database\
echo [SUCCESS] Notification database deployed

echo.
echo [INFO] Step 6: Deploying microservices...

echo [INFO]   Deploying Order Service...
kubectl apply -f backend\order-service\k8s\configmap.yaml 2>nul
kubectl apply -f backend\order-service\k8s\service.yaml
kubectl apply -f backend\order-service\k8s\deployment.yaml
echo [SUCCESS] Order Service deployed

echo [INFO]   Deploying Inventory Service...
kubectl apply -f backend\inventory-service\k8s\configmap.yaml 2>nul
kubectl apply -f backend\inventory-service\k8s\service.yaml
kubectl apply -f backend\inventory-service\k8s\deployment.yaml
echo [SUCCESS] Inventory Service deployed

echo [INFO]   Deploying Notification Service...
kubectl apply -f backend\notification-service\k8s\configmap.yaml 2>nul
kubectl apply -f backend\notification-service\k8s\service.yaml
kubectl apply -f backend\notification-service\k8s\deployment.yaml
echo [SUCCESS] Notification Service deployed

echo [INFO]   Deploying API Gateway...
kubectl apply -f backend\api-gateway\k8s\configmap.yaml 2>nul
kubectl apply -f backend\api-gateway\k8s\service.yaml
kubectl apply -f backend\api-gateway\k8s\deployment.yaml
echo [SUCCESS] API Gateway deployed

echo.
echo [INFO] Step 7: Deploying Ingress (if exists)...
if exist "k8s\manifests\ingress.yaml" (
    set /p DEPLOY_INGRESS="Do you want to deploy Ingress? (y/n): "
    if /i "!DEPLOY_INGRESS!"=="y" (
        where minikube >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo [INFO] Enabling Ingress addon for minikube...
            minikube addons enable ingress
        )
        kubectl apply -f k8s\manifests\ingress.yaml
        echo [SUCCESS] Ingress deployed
    )
)

echo.
echo ==========================================
echo [SUCCESS] Deployment Completed!
echo ==========================================
echo.

echo Current pod status:
kubectl get pods -n demo-micro

echo.
echo ==========================================
echo Service URLs:
echo ==========================================
echo   API Gateway: http://localhost:30080
if defined DEPLOY_KAFKA if /i "%DEPLOY_KAFKA%"=="y" echo   Kafdrop (Kafka UI): http://localhost:30900
if defined DEPLOY_ELK if /i "%DEPLOY_ELK%"=="y" echo   Kibana: http://localhost:30561

echo.
echo ==========================================
echo Next Steps:
echo ==========================================
echo 1. Wait for all pods to be Running (1/1)
echo    Check: kubectl get pods -n demo-micro
echo.
echo 2. Port forward API Gateway:
echo    kubectl port-forward service/api-gateway 8080:8080 -n demo-micro
echo.
echo 3. Test the API:
echo    curl http://localhost:8080/health
echo.
echo 4. Import Postman collection:
echo    Demo-Micro-API.postman_collection.json
echo.
pause
