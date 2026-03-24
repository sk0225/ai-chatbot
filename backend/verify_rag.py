import chat_memory
import time

def test_rag():
    print("--- Starting RAG Verification ---")
    
    # 1. Add a unique interaction
    test_msg = "The secret code word is BANANA."
    test_response = "Got it! I will remember that the code word is BANANA."
    print(f"Adding interaction: '{test_msg}'")
    chat_memory.add_interaction(test_msg, test_response, session_id="test_session")
    
    # Wait a bit for ChromaDB to sync (though it's usually instant)
    time.sleep(1)
    
    # 2. Query for relevant context
    query = "What is the secret code word?"
    print(f"Querying for: '{query}'")
    context = chat_memory.get_relevant_context(query, k=1)
    
    if context:
        print("Retrieved Context:")
        for interaction in context:
            print(f"- {interaction}")
        
        if "BANANA" in context[0]:
            print("\nSUCCESS: Relevant memory retrieved correctly!")
        else:
            print("\nFAILURE: Context retrieved but content doesn't match.")
    else:
        print("\nFAILURE: No context retrieved.")

if __name__ == "__main__":
    test_rag()
