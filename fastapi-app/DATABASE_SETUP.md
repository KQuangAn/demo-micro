# Database Setup Guide

## 1. Install PostgreSQL

Make sure PostgreSQL is installed and running on your system.

## 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE fastapi_db;

# Exit psql
\q
```

## 3. Configure Environment

Copy `.env.example` to `.env` and update the `DATABASE_URL` if needed:

```bash
cp .env.example .env
```

## 4. Install Dependencies

```bash
pip install -r requirements.txt
```

## 5. Run Migrations

```bash
# Create initial migration (if needed)
alembic revision --autogenerate -m "Initial migration"

# Apply migrations
alembic upgrade head
```

## 6. Start the Application

```bash
uvicorn app.main:app --reload
```

## API Endpoints

Once running, you can access:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Users API**: http://localhost:8000/api/v1/users

### Example CRUD Operations

**Create User:**
```bash
curl -X POST "http://localhost:8000/api/v1/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "johndoe",
    "full_name": "John Doe",
    "password": "securepassword123"
  }'
```

**Get All Users:**
```bash
curl "http://localhost:8000/api/v1/users?skip=0&limit=10"
```

**Get User by ID:**
```bash
curl "http://localhost:8000/api/v1/users/1"
```

**Update User:**
```bash
curl -X PUT "http://localhost:8000/api/v1/users/1" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Doe",
    "is_active": true
  }'
```

**Delete User:**
```bash
curl -X DELETE "http://localhost:8000/api/v1/users/1"
```
