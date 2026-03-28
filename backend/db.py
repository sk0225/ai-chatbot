from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
from logger import logger

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = "chatbot"
COLLECTION_NAME = "chats"

try:
    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]
    chats_collection = db[COLLECTION_NAME]
    # Ensure indexes for faster search
    chats_collection.create_index("chat_id", unique=True)
    logger.info("Connected to MongoDB successfully.")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    raise e

def create_chat(chat_id, title="New Chat"):
    chat_doc = {
        "chat_id": chat_id,
        "title": title,
        "created_at": datetime.utcnow(),
        "messages": []
    }
    chats_collection.insert_one(chat_doc)
    return chat_doc

def add_message(chat_id, role, content):
    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.utcnow()
    }
    result = chats_collection.update_one(
        {"chat_id": chat_id},
        {"$push": {"messages": message}}
    )
    if result.matched_count == 0:
        # If chat doesn't exist, create it lazily
        create_chat(chat_id, title=content[:40] + ("..." if len(content) > 40 else ""))
        chats_collection.update_one(
            {"chat_id": chat_id},
            {"$push": {"messages": message}}
        )
    return message

def get_all_chats():
    # Return brief info for sidebar
    chats = chats_collection.find({}, {"chat_id": 1, "title": 1, "created_at": 1, "_id": 0}).sort("created_at", -1)
    return list(chats)

def get_chat_history(chat_id):
    chat = chats_collection.find_one({"chat_id": chat_id}, {"_id": 0})
    return chat

def delete_chat(chat_id):
    return chats_collection.delete_one({"chat_id": chat_id})

def update_chat_title(chat_id, title):
    return chats_collection.update_one({"chat_id": chat_id}, {"$set": {"title": title}})
