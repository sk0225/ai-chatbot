import knowledge_base
import os

def test_kb():
    print("--- Starting Knowledge Base Verification ---")
    
    # 1. Create a dummy txt file
    test_filename = "test_knowledge.txt"
    test_content = """
    Quantum Entanglement is a physical phenomenon that occurs when a group of particles are generated, 
    interact, or share spatial proximity such that the quantum state of each particle cannot be 
    described independently of the state of the others, even when the particles are separated by 
    a large distance.
    """
    with open(test_filename, "w", encoding="utf-8") as f:
        f.write(test_content)
    
    print(f"Processing file: {test_filename}")
    success = knowledge_base.process_file_and_store(test_filename, test_filename)
    
    if success:
        print("SUCCESS: File processed and stored.")
        
        # 2. Query for relevant knowledge
        query = "What is quantum entanglement?"
        print(f"Querying for: '{query}'")
        chunks = knowledge_base.query_knowledge_base(query, k=1)
        
        if chunks:
            print("Retrieved Knowledge:")
            print(f"- {chunks[0]}")
            
            if "physical phenomenon" in chunks[0]:
                print("\nSUCCESS: Relevant knowledge retrieved correctly!")
            else:
                print("\nFAILURE: Knowledge retrieved but content doesn't match.")
        else:
            print("\nFAILURE: No knowledge retrieved.")
    else:
        print("FAILURE: File processing failed.")
    
    # Clean up
    if os.path.exists(test_filename):
        os.remove(test_filename)

if __name__ == "__main__":
    test_kb()
