# ai-proxy
### This project is a lightweight AI assistant setup with a Railway free-tier backend and a simple frontend integration, allowing you to embed an AI chatbot into any webpage.
## Architecture Overview
Backend: Node.js + Express, hosted on Railway (free plan)
- Handles requests from frontend
- Rate limiting and concurrent request queue
- Token-based access control
- User-Agent check to prevent scripts abuse
- Integrates with OpenRouter API via OPENROUTER_KEY
- Loads additional knowledge from local knowledge folder (optional)

Frontend: Simple HTML + JavaScript
- Sends POST requests to backend API
- Adds Authorization token in headers
- Displays AI responses dynamically
- Compatible with multiple allowed origins

## Features
- Lightweight and easy to deploy on Railway free plan
- Token-based access for security
- Origin and UA checking to prevent misuse
Rate limiting: up to 20 requests per minute per IP
- Concurrent request queue to avoid overloading
## Backend Setup (Railway Free Tier)
- Create a Railway project (free tier)
- Add environment variables:
- - OPENROUTER_KEY: Your OpenRouter API key
- - SECRET_TOKEN: Your frontend access token (e.g., abc123)
- Deploy index.js to Railway
- Make sure CORS allowed origins match your frontend pages:

[
  "https://hepsa2.github.io",
  "https://fet.codeberg.page",
  "https://star.icu"
]
## Frontend Setup:
1. Embed this script in your HTML page
```js
<script>
const API_URL = "YOUR_RAILWAY_BACKEND_URL/ai";
const API_TOKEN = "abc123"; // match SECRET_TOKEN in backend

document.getElementById("ai-send").onclick = async () => {
  const prompt = document.getElementById("ai-prompt").value.trim();
  if (!prompt) return alert('Please enter a question');
  const responseEl = document.getElementById("ai-response");
  responseEl.textContent = 'AI is thinking...';
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    const data = await res.json();
    responseEl.textContent = data.result || JSON.stringify(data.detail, null, 2) || data.error || "(No response)";
    responseEl.scrollTop = responseEl.scrollHeight;
  } catch(err) {
    responseEl.textContent = "Request failed: " + err.message;
  }
};
</script>
```
2. Make sure the <textarea> for the prompt and a <pre> element for responses exist:
<textarea id="ai-prompt"></textarea>
<button id="ai-send">Send</button>
<pre id="ai-response"></pre>
## Security Measures
- Token-based authentication (SECRET_TOKEN)
- CORS restricted to allowed frontend domains
- User-Agent check to block bots/scripts
- Rate limiting per IP
- Concurrent request queue to prevent overload

## Notes
- Works well on free-tier Railway, lightweight and suitable for static frontend pages
- You can add .txt files in the knowledge folder to provide extra context for AI responses
- For production use, consider additional logging, HTTPS enforcement, and stricter token management

