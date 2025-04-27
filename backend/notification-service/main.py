from contextlib import asynccontextmanager
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from strawberry.fastapi import GraphQLRouter
from app.services.sqs_listener import receive_messages
from app.graphql.types import schema

@asynccontextmanager
async def lifespan(app: FastAPI):
    listener_thread = threading.Thread(target=start_sqs_listener, daemon=True)
    listener_thread.start()
    print("SQS listener started.")
    
    yield  

    print("Shutting down...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graphql_app = GraphQLRouter(schema)
app.include_router(graphql_app, prefix="/graphql")

def start_sqs_listener():
    while True:
        receive_messages()

@app.get("/schema", response_class=PlainTextResponse)
def get_schema():
    return schema.as_str()