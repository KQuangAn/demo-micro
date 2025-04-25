from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI')

client = MongoClient(MONGODB_URI)
db = client.notifications

try:
    client.admin.command('ping')
    print("MongoDB connection successful!")
except Exception as e:
    print(f"Failed to connect to MongoDB: {e}")