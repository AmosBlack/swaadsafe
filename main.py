import os
from pathlib import Path
from sarvamai import SarvamAI

# Load .env into os.environ if present
env_file = Path(__file__).resolve().parent / ".env"
if env_file.exists():
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip().strip("'\""))

client = SarvamAI(api_subscription_key=os.environ.get("SARVAM_API_KEY"))

response = client.chat.completions(
    model="sarvam-105b-conversations",
    messages=[
        {"role": "user", "content": "Hello! Give a brief one-sentence greeting."}
    ],
)

print(response.choices[0].message.content)
