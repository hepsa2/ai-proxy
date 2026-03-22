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
