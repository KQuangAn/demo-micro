#!/bin/bash

# Cleanup script - resets the LocalStack environment

echo "=================================================="
echo "  DynamoDB LocalStack - Cleanup"
echo "=================================================="

echo ""
echo "This will:"
echo "  1. Stop LocalStack containers"
echo "  2. Remove all volumes and data"
echo "  3. Clean up local data directory"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Stopping LocalStack..."
docker-compose down -v

echo "Removing local data..."
rm -rf localstack-data/

echo ""
echo "✓ Cleanup complete!"
echo ""
echo "To start fresh, run: ./setup.sh"
