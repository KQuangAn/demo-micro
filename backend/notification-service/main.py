from contextlib import asynccontextmanager
from datetime import datetime
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import strawberry
from strawberry.fastapi import GraphQLRouter
from app.db import db
from app.models import Notification
from app.services.sqs_listener import receive_messages

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@strawberry.type
class NotificationType:
    id : str
    user_id: int
    order_id: int
    type: str
    message: str
    status: str 
    created_at: datetime 
    updated_at: datetime 

@strawberry.type
class Query:
    notifications: list[NotificationType] = strawberry.field(resolver=lambda: list(db.notifications.find()))

@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_notification(self, message: str, recipient: str) -> NotificationType:
        notification = Notification(order_id=1, type="1",status="1",message=message, user_id=recipient)
        res = db.notifications.insert_one(notification.to_dict())
        return NotificationType(id= res.inserted_id, order_id=notification.order_id, type=notification.type,status=notification.status, message=notification.message, user_id=recipient , created_at=notification.created_at, updated_at=notification.updated_at)

schema = strawberry.Schema(query=Query, mutation=Mutation)
graphql_app = GraphQLRouter(schema)

app.include_router(graphql_app, prefix="/graphql")

def start_sqs_listener():
    while True:
        receive_messages()

@asynccontextmanager
async def lifespan(app: FastAPI):
    listener_thread = threading.Thread(target=start_sqs_listener, daemon=True)
    listener_thread.start()
    print("SQS listener started.")

    yield  # This will pause here until the app shuts down

    # Cleanup resources if necessary
    print("Shutting down...")
    
app = FastAPI(lifespan=lifespan)