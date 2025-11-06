#!/bin/bash

# K8s Structure Verification Script
# Verifies that all files are in the correct locations after reorganization

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
K8S_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$K8S_DIR")"

echo ""
echo "================================================"
echo "  K8s Structure Verification"
echo "================================================"
echo ""

# Counter for errors
ERRORS=0
WARNINGS=0

# Function to check file
check_file() {
    local file=$1
    local desc=$2
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $desc"
    else
        echo -e "${RED}✗${NC} $desc - NOT FOUND: $file"
        ((ERRORS++))
    fi
}

# Function to check directory
check_dir() {
    local dir=$1
    local desc=$2
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $desc"
    else
        echo -e "${RED}✗${NC} $desc - NOT FOUND: $dir"
        ((ERRORS++))
    fi
}

echo "=== Checking k8s Directory Structure ==="
echo ""

# Check main directories
check_dir "$K8S_DIR/manifests" "manifests/ directory"
check_dir "$K8S_DIR/scripts" "scripts/ directory"
check_dir "$K8S_DIR/docs" "docs/ directory"
check_dir "$K8S_DIR/config" "config/ directory"
check_dir "$K8S_DIR/infrastructure" "infrastructure/ directory"

echo ""
echo "=== Checking Manifest Files ==="
echo ""

check_file "$K8S_DIR/manifests/namespace.yaml" "namespace.yaml"
check_file "$K8S_DIR/manifests/secrets.yaml" "secrets.yaml"
check_file "$K8S_DIR/manifests/pvc.yaml" "pvc.yaml"
check_file "$K8S_DIR/manifests/ingress.yaml" "ingress.yaml"

echo ""
echo "=== Checking Script Files ==="
echo ""

check_file "$K8S_DIR/scripts/deploy.sh" "deploy.sh"
check_file "$K8S_DIR/scripts/undeploy.sh" "undeploy.sh"
check_file "$K8S_DIR/scripts/build-images.sh" "build-images.sh"
check_file "$K8S_DIR/scripts/health-check.sh" "health-check.sh"

echo ""
echo "=== Checking Documentation Files ==="
echo ""

check_file "$K8S_DIR/docs/README.md" "README.md"
check_file "$K8S_DIR/docs/STRUCTURE.md" "STRUCTURE.md"
check_file "$K8S_DIR/docs/QUICKSTART.md" "QUICKSTART.md"

echo ""
echo "=== Checking Config Files ==="
echo ""

if [ -f "$K8S_DIR/config/kustomization.yaml" ]; then
    echo -e "${GREEN}✓${NC} kustomization.yaml"
else
    echo -e "${YELLOW}⚠${NC} kustomization.yaml - Optional file not found"
    ((WARNINGS++))
fi

if [ -f "$K8S_DIR/config/skaffold.yaml" ]; then
    echo -e "${GREEN}✓${NC} skaffold.yaml"
else
    echo -e "${YELLOW}⚠${NC} skaffold.yaml - Optional file not found"
    ((WARNINGS++))
fi

if [ -f "$K8S_DIR/config/Makefile" ]; then
    echo -e "${GREEN}✓${NC} Makefile"
else
    echo -e "${YELLOW}⚠${NC} Makefile - Optional file not found"
    ((WARNINGS++))
fi

echo ""
echo "=== Checking Infrastructure Components ==="
echo ""

check_dir "$K8S_DIR/infrastructure/redis" "redis/ directory"
check_dir "$K8S_DIR/infrastructure/kafka" "kafka/ directory"
check_dir "$K8S_DIR/infrastructure/elk" "elk/ directory"
check_dir "$K8S_DIR/infrastructure/localstack" "localstack/ directory"

check_file "$K8S_DIR/infrastructure/redis/statefulset.yaml" "redis/statefulset.yaml"
check_file "$K8S_DIR/infrastructure/kafka/kafka-stack.yaml" "kafka/kafka-stack.yaml"
check_file "$K8S_DIR/infrastructure/elk/elk-stack.yaml" "elk/elk-stack.yaml"

echo ""
echo "=== Checking Service K8s Directories ==="
echo ""

check_dir "$ROOT_DIR/backend/api-gateway/k8s" "api-gateway/k8s/"
check_dir "$ROOT_DIR/backend/order-service/k8s" "order-service/k8s/"
check_dir "$ROOT_DIR/backend/inventory-service/k8s" "inventory-service/k8s/"
check_dir "$ROOT_DIR/backend/notification-service/k8s" "notification-service/k8s/"

echo ""
echo "=== Checking for Old Files in k8s Root ==="
echo ""

# Check if there are any stray .yaml files in k8s root
STRAY_FILES=$(find "$K8S_DIR" -maxdepth 1 -name "*.yaml" -o -name "*.sh" 2>/dev/null | wc -l)
if [ "$STRAY_FILES" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No stray files in k8s root directory"
else
    echo -e "${YELLOW}⚠${NC} Found $STRAY_FILES potential stray files in k8s root"
    find "$K8S_DIR" -maxdepth 1 -name "*.yaml" -o -name "*.sh" 2>/dev/null | while read file; do
        echo -e "  ${YELLOW}→${NC} $(basename "$file")"
    done
    ((WARNINGS++))
fi

echo ""
echo "=== Verifying deploy.sh Paths ==="
echo ""

# Check if deploy.sh references the correct paths
if grep -q "\$K8S_DIR/manifests/" "$K8S_DIR/scripts/deploy.sh"; then
    echo -e "${GREEN}✓${NC} deploy.sh uses correct manifest paths"
else
    echo -e "${RED}✗${NC} deploy.sh does NOT use correct manifest paths"
    ((ERRORS++))
fi

if grep -q "\$K8S_DIR/infrastructure/" "$K8S_DIR/scripts/deploy.sh"; then
    echo -e "${GREEN}✓${NC} deploy.sh uses correct infrastructure paths"
else
    echo -e "${RED}✗${NC} deploy.sh does NOT use correct infrastructure paths"
    ((ERRORS++))
fi

if grep -q "\$ROOT_DIR/backend/" "$K8S_DIR/scripts/deploy.sh"; then
    echo -e "${GREEN}✓${NC} deploy.sh uses correct backend service paths"
else
    echo -e "${RED}✗${NC} deploy.sh does NOT use correct backend service paths"
    ((ERRORS++))
fi

echo ""
echo "================================================"
echo "  Verification Results"
echo "================================================"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠  $WARNINGS warnings found (non-critical)${NC}"
    fi
    echo ""
    echo "The k8s directory structure is properly reorganized."
    echo "You can safely use: ./k8s/scripts/deploy.sh"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $ERRORS errors found!${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠  $WARNINGS warnings found${NC}"
    fi
    echo ""
    echo "Please fix the errors above before deploying."
    echo ""
    exit 1
fi
