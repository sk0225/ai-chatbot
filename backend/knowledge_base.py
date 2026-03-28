import os
import uuid
import chromadb
from chromadb.utils import embedding_functions
from PyPDF2 import PdfReader
from docx import Document
from logger import setup_logger

logger = setup_logger("knowledge_base")

# Initialize ChromaDB client and collection for Knowledge Base
client = chromadb.PersistentClient(path="./chroma_db")

# Use same embedding function as chat_memory for consistency
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

kb_collection = client.get_or_create_collection(
    name="knowledge_base",
    embedding_function=sentence_transformer_ef
)

def extract_text_from_pdf(filepath):
    text = ""
    try:
        reader = PdfReader(filepath)
        for page in reader.pages:
            text += page.extract_text() or ""
    except Exception as e:
        logger.error(f"Error extracting PDF: {e}")
    return text

def extract_text_from_docx(filepath):
    text = ""
    try:
        doc = Document(filepath)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        logger.error(f"Error extracting DOCX: {e}")
    return text

def extract_text_from_txt(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error extracting TXT: {e}")
        return ""

def chunk_text(text, chunk_size=500, overlap=50):
    """Splits text into chunks (~500 chars) with a specified overlap."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += (chunk_size - overlap)
    return chunks

def process_file_and_store(filepath, filename, session_id="", user_id=""):
    """Processes a file, extracts text, chunks it, and stores in ChromaDB with metadata."""
    ext = filename.split('.')[-1].lower()
    
    if ext == 'pdf':
        text = extract_text_from_pdf(filepath)
    elif ext == 'docx':
        text = extract_text_from_docx(filepath)
    elif ext == 'txt':
        text = extract_text_from_txt(filepath)
    else:
        logger.warning(f"Unsupported file type attempt: {ext} for {filename}")
        return False

    if not text.strip():
        logger.warning(f"No text extracted from {filename}")
        return False

    chunks = chunk_text(text)
    ids = [str(uuid.uuid4()) for _ in chunks]
    metadatas = [{
        "source": filename, 
        "chunk_index": i,
        "session_id": session_id,
        "user_id": user_id
    } for i in range(len(chunks))]

    try:
        kb_collection.add(
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )
        logger.info(f"Successfully added {len(chunks)} chunks from {filename} to Knowledge Base (session: {session_id}).")
        return True
    except Exception as e:
        logger.error(f"Error adding to Knowledge Base: {e}")
        return False

def query_knowledge_base(query, k=5):
    """Retrieves relevant chunks from the Knowledge Base."""
    if kb_collection.count() == 0:
        return []

    try:
        results = kb_collection.query(
            query_texts=[query],
            n_results=min(k, kb_collection.count())
        )
        
        if results['documents']:
            return results['documents'][0]
    except Exception as e:
        logger.error(f"Error querying Knowledge Base: {e}")
    
    return []
