import requests
import json

def test_streaming():
    url = "http://localhost:5001/chat"
    payload = {
        "message": "Say 'Streaming is working!' and explain why in one sentence.",
        "session_id": "test_streaming_session",
        "user_id": "test_user"
    }
    
    print("--- Testing Streaming Backend ---")
    try:
        response = requests.post(url, json=payload, stream=True)
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            print(response.text)
            return

        print("Response stream:")
        full_text = ""
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith('data: '):
                    token = decoded_line.replace('data: ', '')
                    print(token, end='', flush=True)
                    full_text += token
        
        print("\n\n--- Stream Completed ---")
        if "Streaming is working!" in full_text:
            print("SUCCESS: Streaming tokens received correctly.")
        else:
            print("FAILURE: Expected text not found in stream.")
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_streaming()
