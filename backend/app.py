from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from google import genai
import os
from dotenv import load_dotenv
import chat_memory
import user_memory
import knowledge_base
import agent_tools
from logger import logger
from werkzeug.utils import secure_filename

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'txt', 'docx'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ---------------------------------------------------------------------------
# In-memory session storage
# Structure: { session_id: [ {"role": "user"|"assistant", "content": "..."}, ... ] }
# ---------------------------------------------------------------------------
chat_sessions: dict[str, list[dict]] = {}
MAX_HISTORY = 15  # Max messages sent to the AI model to control token usage

api_key = os.getenv('GEMINI_API_KEY', '').strip()
if not api_key:
    # Fallback to checking GOOGLE_API_KEY as some SDK versions prefer it
    api_key = os.getenv('GOOGLE_API_KEY', '').strip()

if not api_key:
    raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY environment variable not set in .env")

# Basic diagnostic (will only show first/last characters for security)
logger.info(f"Loaded API Key starting with: {api_key[:5]}... and ending with: ...{api_key[-4:]}")

client = genai.Client(api_key=api_key)

available_models = [m.name for m in client.models.list()]
MODEL_NAME = None
for m in available_models:
    if 'flash' in m or 'gemini' in m:
        MODEL_NAME = m
        break

if not MODEL_NAME:
    raise ValueError("No suitable Gemini model found.")


@app.route('/')
def index():
    return jsonify({
        "status": "success",
        "message": "Gemini API is running! The frontend is hosted separately. "
                   "Please access the React app, usually at http://localhost:5173"
    })


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Get optional session/user IDs for metadata
        session_id = request.form.get('session_id', '')
        user_id = request.form.get('user_id', '')
        
        # Process and store in knowledge base
        success = knowledge_base.process_file_and_store(filepath, filename, session_id, user_id)
        
        # Optionally remove the file after processing
        # os.remove(filepath)
        
        if success:
            return jsonify({'message': f'File {filename} uploaded and processed successfully.'})
        else:
            return jsonify({'error': f'Failed to process {filename}'}), 500
    
    return jsonify({'error': 'File type not allowed'}), 400


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    logger.info(f"Chat request received: {data}")
    user_message = data.get('message', '').strip()
    session_id = data.get('session_id', '').strip()
    user_id = data.get('user_id', '').strip() or session_id

    if not user_message:
        return jsonify({'error': 'No message provided'}), 400
    if not session_id:
        return jsonify({'error': 'No session_id provided'}), 400

    try:
        # --- Initialize session ---
        if session_id not in chat_sessions:
            chat_sessions[session_id] = []

        # 1. Append the user message to the session history
        chat_sessions[session_id].append({"role": "user", "content": user_message})

        # 1b. Extra facts from the user message
        profile = user_memory.get_memory(user_id)
        profile = user_memory.extract_facts(user_message, profile)
        user_memory.save_memory(user_id, profile)

        # 2. Retrieve context
        context_interactions = chat_memory.get_relevant_context(user_message, k=3)
        context_string = "\n\n".join(context_interactions)
        kb_chunks = knowledge_base.query_knowledge_base(user_message, k=5)
        kb_context = "\n\n".join(kb_chunks)

        # 3. Build history string
        recent_history = chat_sessions[session_id][-MAX_HISTORY:]
        conversation_lines = []
        for msg in recent_history:
            role_label = "User" if msg["role"] == "user" else "Assistant"
            conversation_lines.append(f"{role_label}: {msg['content']}")
        conversation_history = "\n".join(conversation_lines)

        # 4. Construct prompt
        prompt_parts = [
            "You are a helpful AI assistant. Answer the user's latest message using the conversation history, user memory, and any relevant context provided below. Personalise your responses using the user's known details. If the relevant past context is provided, use it to inform your answer but don't explicitly mention 'context' unless asked."
        ]
        memory_string = user_memory.format_memory_for_prompt(profile)
        if memory_string:
            prompt_parts.append(f"### User Profile/Memory:\n{memory_string}")
        if context_string:
            prompt_parts.append(f"### Relevant Past Context:\n{context_string}")
        if kb_context:
            prompt_parts.append(f"### Knowledge Base Context (from uploaded files):\n{kb_context}")
        
        prompt_parts.append(f"### Recent Conversation History:\n{conversation_history}")
        prompt_parts.append(f"### Current User Message:\n{user_message}")

        prompt = "\n\n".join(prompt_parts)

        def generate():
            full_response = ""
            try:
                # Use generating content in a loop to handle multiple tool turns
                current_contents = prompt
                
                while True:
                    response = client.models.generate_content(
                        model=MODEL_NAME,
                        contents=current_contents,
                        config={'tools': agent_tools.tools}
                    )
                    
                    # Check for function calls
                    if response.candidates and response.candidates[0].content.parts:
                        parts = response.candidates[0].content.parts
                        func_calls = [p.function_call for p in parts if p.function_call]
                        
                        if func_calls:
                            # We have tool calls, execute them and continue the loop
                            # Note: For simplicity, handling the first one. For more complex, handle all.
                            func_call = func_calls[0]
                            func_name = func_call.name
                            args = func_call.args
                            
                            # Execute the tool
                            if hasattr(agent_tools, func_name):
                                tool_func = getattr(agent_tools, func_name)
                                result = tool_func(**args)
                                
                                # Add the tool call and result to current contents (conversation history)
                                # In a real agent, you'd add this to the model's message list
                                # Here we append to the prompt for simplicity in this demo
                                tool_result_msg = f"\n[AI calls {func_name} with {args} -> Result: {result}]\n"
                                current_contents += tool_result_msg
                                continue
                            else:
                                yield f"data: Error: Tool {func_name} not found.\n\n"
                                break
                        
                        # If no more function calls, we should have text
                        text = response.text
                        if text:
                            full_response = text
                            # For streaming UX, we yield word by word even if it's not a real stream from the model
                            # (Since manual tool calling with generate_content is not natively streaming)
                            words = text.split(' ')
                            for i, word in enumerate(words):
                                yield f"data: {word + (' ' if i < len(words)-1 else '')}\n\n"
                                import time
                                time.sleep(0.05)
                        break
                    else:
                        break
                
                # 6. Once finished, update session history and long-term memory
                chat_sessions[session_id].append({"role": "assistant", "content": full_response})
                chat_memory.add_interaction(user_message, full_response, session_id=session_id)
                
            except Exception as e:
                logger.exception(f"Agent loop error: {e}")
                error_msg = str(e)
                yield f"data: [ERROR]: {error_msg}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        logger.error(f"Error in /chat initialization: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5001)

