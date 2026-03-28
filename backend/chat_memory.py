import chromadb
from chromadb.utils import embedding_functions
import uuid
from logger import setup_logger

logger = setup_logger("chat_memory")

# Initialize ChromaDB client.
# This will create a persistent database in the './chroma_db' directory.
client = chromadb.PersistentClient(path="./chroma_db")

# Use sentence-transformers embedding function
# all-MiniLM-L6-v2 is the default fast and efficient model
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

# Get or create a collection for storing our chat interactions
collection = client.get_or_create_collection(
    name="chat_history",
    embedding_function=sentence_transformer_ef
)

def add_interaction(user_message: str, assistant_response: str, session_id: str = ""):
    """
    Stores a user message and assistant response in the vector database.
    Optionally associates the interaction with a session_id.
    """
    # Create a unique ID for this interaction using uuid4
    interaction_id = str(uuid.uuid4())

    metadata = {
        "role": "user",
        "response": assistant_response,
        "session_id": session_id if session_id else "anonymous"
    }

    try:
        # Store the user's message as the embedded document
        # and keep the assistant's response + session info in the metadata
        collection.add(
            documents=[user_message],
            metadatas=[metadata],
            ids=[interaction_id]
        )
        logger.info(f"Added interaction to memory: {interaction_id} (session: {session_id or 'anonymous'})")
    except Exception as e:
        logger.error(f"Error adding interaction to memory: {e}")

def get_relevant_context(query: str, k: int = 3) -> list:
    """
    Retrieves the k most relevant past conversations based on the user's query.
    Returns a list of formatted strings.
    """
    if collection.count() == 0:
        return []

    # Query ChromaDB for the closest matching previous user messages
    results = collection.query(
        query_texts=[query],
        n_results=min(k, collection.count())
    )

    context = []
    
    # Results are returned as lists of lists (since we can query multiple texts at once).
    # We only queried one text, so we take the first list [0] from documents and metadatas.
    if results['documents'] and len(results['documents'][0]) > 0:
        documents = results['documents'][0]
        metadatas = results['metadatas'][0]
        
        for i in range(len(documents)):
            past_user_msg = documents[i]
            past_bot_msg = metadatas[i].get('response', '')
            
            # Format the past interaction
            interaction = f"User: {past_user_msg}\nAssistant: {past_bot_msg}"
            context.append(interaction)
            
    return context
