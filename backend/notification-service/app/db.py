from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI')
MONGODB_DB = os.getenv('MONGODB_DB')

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB]

try:
    client.admin.command('ping')
    print("MongoDB connection successful!")
except Exception as e:
    print(f"Failed to connect to MongoDB: {e}")