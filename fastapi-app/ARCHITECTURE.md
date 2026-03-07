# FastAPI Database Integration - Complete Guide

## Architecture Overview

This FastAPI application uses a clean architecture pattern with:

1. **Models** (`app/models/`) - SQLAlchemy ORM models (database tables)
2. **Schemas** (`app/schemas/`) - Pydantic models (validation & serialization)
3. **Repositories** (`app/repositories/`) - Data access layer (CRUD operations)
4. **Endpoints** (`app/api/v1/endpoints/`) - API routes (HTTP handlers)

## File Structure

```
fastapi-app/
├── app/
│   ├── core/
│   │   ├── config.py          # Settings & configuration
│   │   └── database.py         # Database connection & session management
│   ├── models/
│   │   └── user.py             # SQLAlchemy User model
│   ├── schemas/
│   │   └── user.py             # Pydantic schemas (UserCreate, UserUpdate, UserResponse)
│   ├── repositories/
│   │   └── user_repository.py  # CRUD operations for User
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── health.py   # Health check endpoint
│   │       │   └── users.py    # User CRUD endpoints
│   │       └── router.py        # API router configuration
│   └── main.py                  # FastAPI application entry point
├── alembic/                     # Database migrations
│   ├── versions/
│   │   └── 001_initial.py      # Initial migration
│   └── env.py                   # Alembic configuration
├── alembic.ini                   # Alembic settings
├── requirements.txt              # Python dependencies
└── DATABASE_SETUP.md             # Setup instructions
```

## Key Components Explained

### 1. Database Connection (`app/core/database.py`)

- **AsyncSessionLocal**: Creates async database sessions
- **get_db()**: Dependency injection for database sessions
- **Base**: SQLAlchemy declarative base for models

### 2. Model (`app/models/user.py`)

SQLAlchemy model representing the `users` table:
- Fields: id, email, username, full_name, hashed_password, is_active, etc.
- Indexes on email and username for fast lookups

### 3. Schemas (`app/schemas/user.py`)

Pydantic models for validation:
- **UserCreate**: Required fields for creating a user
- **UserUpdate**: Optional fields for updating a user
- **UserResponse**: Fields returned in API responses (excludes password)

### 4. Repository (`app/repositories/user_repository.py`)

Data access layer with methods:
- `create()` - Create new user
- `get_by_id()` - Get user by ID
- `get_by_email()` - Get user by email
- `get_by_username()` - Get user by username
- `get_all()` - List users with pagination
- `update()` - Update user
- `delete()` - Delete user
- `count()` - Count users

### 5. Endpoints (`app/api/v1/endpoints/users.py`)

RESTful API endpoints:
- `POST /api/v1/users` - Create user
- `GET /api/v1/users` - List users (with pagination)
- `GET /api/v1/users/{id}` - Get user by ID
- `PUT /api/v1/users/{id}` - Update user
- `DELETE /api/v1/users/{id}` - Delete user

## Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up database:**
   ```bash
   # Create PostgreSQL database
   createdb fastapi_db
   
   # Run migrations
   alembic upgrade head
   ```

3. **Start the server:**
   ```bash
   uvicorn app.main:app --reload
   ```

4. **Access API docs:**
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## Adding a New Model

To add a new model (e.g., `Product`):

1. **Create model** (`app/models/product.py`):
   ```python
   from app.core.database import Base
   from sqlalchemy import Column, Integer, String, Float
   
   class Product(Base):
       __tablename__ = "products"
       id = Column(Integer, primary_key=True)
       name = Column(String, nullable=False)
       price = Column(Float, nullable=False)
   ```

2. **Create schemas** (`app/schemas/product.py`):
   ```python
   from pydantic import BaseModel
   
   class ProductCreate(BaseModel):
       name: str
       price: float
   
   class ProductResponse(BaseModel):
       id: int
       name: str
       price: float
   ```

3. **Create repository** (`app/repositories/product_repository.py`):
   ```python
   from app.models.product import Product
   from app.schemas.product import ProductCreate
   
   class ProductRepository:
       async def create(self, product_data: ProductCreate):
           # Implementation
   ```

4. **Create endpoints** (`app/api/v1/endpoints/products.py`):
   ```python
   from fastapi import APIRouter, Depends
   from app.repositories.product_repository import ProductRepository
   
   router = APIRouter()
   
   @router.post("/")
   async def create_product(...):
       # Implementation
   ```

5. **Add to router** (`app/api/v1/router.py`):
   ```python
   from app.api.v1.endpoints import products
   api_router.include_router(products.router, prefix="/products", tags=["products"])
   ```

6. **Create migration:**
   ```bash
   alembic revision --autogenerate -m "Add products table"
   alembic upgrade head
   ```

## Best Practices

1. **Always use repositories** - Never access models directly in endpoints
2. **Validate with schemas** - Use Pydantic schemas for all input/output
3. **Handle errors** - Use HTTPException for proper error responses
4. **Use async/await** - All database operations are async
5. **Transaction management** - Database sessions auto-commit/rollback via dependency
