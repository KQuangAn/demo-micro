# FastAPI Microservice

A production-ready FastAPI application template.

## Features
- **FastAPI**: Modern, fast (high-performance) web framework for building APIs.
- **Production Ready**: Configured with Gunicorn and Uvicorn workers.
- **Structured Layout**: Organized by core, api, models, and schemas.
- **Dockerized**: Ready for containerized deployment.
- **Environment Management**: Using `pydantic-settings` for robust configuration.

## Getting Started

### Local Development
1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Running with Docker
```bash
docker build -t fastapi-app .
docker run -p 8000:8000 fastapi-app
```

## API Documentation
Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
