import requests

url = "http://localhost:3000/api/bot/events/1"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "13f0868c-0a20-4b17-a3f5-bac5c6dee4d0"
}
data = {
    "status": "Completed",
    "editor": "Bot",
    "changes": "Status updated to Completed"
}

response = requests.put(url, headers=headers, json=data)
print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")
