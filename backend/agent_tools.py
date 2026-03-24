import random
import re

def get_weather(city: str) -> str:
    """Retrieves the current weather for a specified city. Use this when the user asks about weather."""
    print(f"[Agent Tool] Calling get_weather for: {city}")
    conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Stormy"]
    temp = random.randint(15, 35)
    return f"The weather in {city} is currently {random.choice(conditions)} with a temperature of {temp}°C."

def calculate(expression: str) -> str:
    """Evaluates a mathematical expression. Use this for math problems."""
    print(f"[Agent Tool] Calling calculate for: {expression}")
    try:
        # Basic security check: only allow numbers and math operators
        if re.match(r'^[0-9+\-*/().\s]*$', expression):
            # Using eval safely for this demo, in production use a proper parser
            result = eval(expression)
            return f"The result of {expression} is {result}."
        else:
            return "Error: Invalid characters in mathematical expression."
    except Exception as e:
        return f"Error calculating expression: {str(e)}"

def web_search(query: str) -> str:
    """Performs a web search to find latest information. Use this for news or general knowledge queries."""
    print(f"[Agent Tool] Calling web_search for: {query}")
    # Mocking search results
    mock_results = [
        f"Result 1: Latest news on {query} - AI breakthroughs continue to accelerate.",
        f"Result 2: Wikipedia - {query} info: Overview of the topic and its history.",
        f"Result 3: Reddit - Users are discussing {query} in various tech subreddits."
    ]
    return " \n".join(mock_results)

# List of tools to be registered with the AI model
tools = [get_weather, calculate, web_search]
