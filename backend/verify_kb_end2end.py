import os
import requests
import time

def test_upload_and_query():
    backend_url = "http://localhost:5001"
    
    # Create a dummy text file
    test_filename = "neural_link_protocol.txt"
    with open(test_filename, "w") as f:
        f.write("The Neural Link Protocol facilitates high-bandwidth communication between human consciousness and AI systems. " * 20)
        f.write("\n\nSecurity clearance level: ALPHA-9.")

    print(f"--- Testing File Upload ---")
    with open(test_filename, "rb") as f:
        files = {"file": f}
        data = {
            "session_id": "session-unique-123",
            "user_id": "user-unique-456"
        }
        upload_resp = requests.post(f"{backend_url}/upload", files=files, data=data)
        print(f"Upload Status: {upload_resp.status_code}")
        print(f"Upload Response: {upload_resp.json()}")

    if upload_resp.status_code == 200:
        print(f"\n--- Testing Query Retrieval ---")
        chat_payload = {
            "message": "What is the security clearance level for the Neural Link Protocol?",
            "session_id": "session-unique-123",
            "user_id": "user-unique-456"
        }
        
        chat_resp = requests.post(f"{backend_url}/chat", json=chat_payload, stream=True)
        print("Bot's Response: ", end='', flush=True)
        full_text = ""
        for line in chat_resp.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith('data: '):
                    token = decoded_line.replace('data: ', '')
                    print(token, end='', flush=True)
                    full_text += token
        print()
        
        if "ALPHA-9" in full_text:
            print("\nSUCCESS: Knowledge base context was successfully retrieved and used.")
        else:
            print("\nFAILURE: Context not found in response.")

    # Cleanup
    if os.path.exists(test_filename):
        os.remove(test_filename)

if __name__ == "__main__":
    test_upload_and_query()
