import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("GOOGLE_API_KEY")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
response = requests.get(url)
print("Status Code:", response.status_code)
if response.status_code == 200:
    data = response.json()
    models = [m['name'] for m in data.get('models', []) if 'embedContent' in m.get('supportedGenerationMethods', [])]
    print("Embedding models supported:", models)
else:
    print(response.text)
