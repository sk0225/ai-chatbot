import requests
import json

def test_agent_tools():
    url = "http://localhost:5001/chat"
    
    test_queries = [
        "What is the weather in London?",
        "What is (25 * 4) + 50?",
        "Search for 'best pizza in New York'"
    ]
    
    import time
    for query in test_queries:
        print(f"\n--- Testing Query: '{query}' ---")
        time.sleep(5)
        payload = {
            "message": query,
            "session_id": "test_agent_session",
            "user_id": "test_user"
        }
        
        try:
            response = requests.post(url, json=payload, stream=True)
            if response.status_code != 200:
                print(f"Error: {response.status_code}")
                continue

            print("Bot's Response: ", end='', flush=True)
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith('data: '):
                        token = decoded_line.replace('data: ', '')
                        print(token, end='', flush=True)
            print()
            
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    test_agent_tools()
