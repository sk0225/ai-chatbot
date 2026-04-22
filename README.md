# GenAI WebUI

A full-stack, AI-powered interactive chat web application utilizing Google's Gemini models for intelligent responses. The project pairs a modern React + Vite frontend with a robust Python Flask backend, featuring persistent multi-session chat, personalized user memory, and Retrieval-Augmented Generation (RAG) capabilities with file uploads.

## Features at a Glance

- **Conversational AI via Gemini:** Utilizes the Google `genai` SDK for high-quality LLM-driven responses, with built-in streaming support for a seamless user experience.
- **Retrieval-Augmented Generation (RAG):** Upload `.pdf`, `.docx`, or `.txt` files directly in the chat. The system automatically extracts, chunks, and semantically stores the content.
- **Dual Vector Storage (ChromaDB):**
  - **Knowledge Base (`knowledge_base.py`):** Embeds and indexes uploaded documents for context-aware querying.
  - **Chat Memory (`chat_memory.py`):** Semantically stores past conversational contexts using `sentence-transformers` (`all-MiniLM-L6-v2`) to pull up relevant past dialogue efficiently.
- **User Memory Extraction (`user_memory.py`):** Automatically extracts and updates personal facts about the user during the conversation into a living profile.
- **Agent Tools / Function Calling:** Supports dynamic AI tool execution (via `agent_tools.py`) directly integrated with Gemini's function calling logic.
- **Persistent Storage:** MongoDB securely keeps track of chat IDs, session metadata, sidebar histories, and raw message logs.
- **Beautiful Frontend:** Clean, responsive UI built with React 19, Tailwind CSS, Framer Motion animations, and React Markdown for rich text rendering.

---

## 🛠️ Tech Stack

**Frontend**
* **Framework:** React 19 (Initialized with Vite)
* **Styling:** Tailwind CSS (Utility-first UI styling)
* **Icons & Typology:** Lucide React, Tailwind Typography plugin
* **Animations:** Framer Motion
* **Rich Text:** React Markdown

**Backend**
* **Language:** Python 3
* **Framework:** Flask & Flask-CORS
* **LLM Engine:** Google GenAI API (Gemini models)
* **Document Parsing:** PyPDF2 (PDFs), python-docx (Word documents)
* **Embeddings & Search:** `sentence-transformers`

**Databases & Storage**
* **Vector Database:** ChromaDB (Local persistent system for RAG & memory loops)
* **Application Database:** MongoDB (Powered by `pymongo` for session/user management)

---

## 🚀 Setting Up the Project

### Prerequisites
Make sure your machine has the following:
- **Python (3.8+)**
- **Node.js (v16+)**
- **MongoDB** (Running locally on `mongodb://localhost:27017` or configurable via an atlas string).

### 1. Database Setup (MongoDB)
Ensure the MongoDB service is actively running on your machine. By default, the app looks for `mongodb://localhost:27017`.

### 2. Backend Setup
First, handle the backend environment:
1. Open a terminal inside the `backend/` folder.
2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   ```
3. **Activate the virtual environment**:
   - On Windows: `venv\Scripts\activate`
   - On macOS/Linux: `source venv/bin/activate`
4. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
5. **Configure Environment Variables**:
   Create a `.env` file in the `backend/` directory. Add your keys:
   ```env
   # Required: Google Gemini API Key
   GEMINI_API_KEY=your_gemini_api_key_here

   # Optional: Only add if you aren't using the default localhost MongoDB
   MONGO_URI=mongodb://localhost:27017
   ```
6. **Start the backend Server**:
   ```bash
   python app.py
   ```
   *(The API will be available at `http://127.0.0.1:5000`)*

### 3. Frontend Setup
Now, start the user interface:
1. Open a new terminal inside the `frontend/` folder.
2. **Install Node modules**:
   ```bash
   npm install
   ```
3. **Start the development server**:
   ```bash
   npm run dev
   ```

### 4. Access the Web UI
The frontend terminal output will provide a local address (usually `http://localhost:5173`). Open this URL in your web browser to start chatting!

---

## 🏗️ Core Architecture Concepts

- **File Upload (`/upload`)**: Upon receiving a file, the API reads it (via `PyPDF2` or `python-docx`), splits the text into ~500-character overlapping chunks, assigns metadata, embeds them, and injects them into the ChromaDB `knowledge_base` collection.
- **Message Pipeline (`/chat`)**: When the user sends a message, the server:
  1. Stores the raw text in MongoDB.
  2. Synthesizes a factual profile utilizing `user_memory`.
  3. Queries ChromaDB's `chat_memory` for the top 3 semantically akin conversational contexts.
  4. Queries ChromaDB's `knowledge_base` for the top 5 relevant file chunks.
  5. Assembles all elements into a rich prompt format for Gemini.
  6. Evaluates and executes any underlying tool requests via Gemini function calls.
  7. Streams the response back to the React UI as Server-Sent Events (SSE).
